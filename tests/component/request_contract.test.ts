import { readFileSync } from 'node:fs';
import Ajv2020Module from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import {
  createRemediationApp,
  type RemediationInvocation,
  type TrustedRequestContext,
} from '../../src/app.ts';

const identity: TrustedRequestContext = {
  identity_context: {
    subject_id: 'sub-123',
    principal_type: 'authenticated',
    tenant_memberships: ['acme'],
    roles: ['software_engineer'],
    issuer: 'flue-pi-identity-authority',
    audience: 'flue-pi-agent-policy',
    verification: {
      status: 'verified',
      owner: 'flue-pi-platform-gateway',
    },
    request_binding: { id: 'req-123' },
  },
  request_context: { tenant: 'acme', binding_id: 'req-123' },
};

const Ajv2020 = Ajv2020Module as unknown as new (options: {
  strict: boolean;
}) => {
  compile(schema: unknown): ((value: unknown) => boolean) & {
    errors?: unknown;
  };
};

function harness(...values: [unknown?]) {
  const trusted = values.length === 0 ? identity : values[0];
  const calls: RemediationInvocation[] = [];
  const privateCalls: Request[] = [];
  const app = createRemediationApp({
    trustedRequestContext: () => trusted,
    privateFlueApp: {
      fetch: async (privateRequest) => {
        privateCalls.push(privateRequest);
        return Response.json({ status: 'unexpected' });
      },
    },
    invokeRemediation: async (invocation) => {
      calls.push(invocation);
      return Response.json({ status: 'accepted' });
    },
  });
  return { app, calls, privateCalls };
}

function request(
  body: BodyInit | null,
  headers: HeadersInit = { 'content-type': 'application/json' },
) {
  return new Request('http://localhost/v1/remediations', {
    method: 'POST',
    headers,
    body,
  });
}

async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  const payload = await response.json();
  expect(payload).toEqual({
    version: 1,
    error: {
      code,
      message: expect.any(String),
      request_id: expect.any(String),
    },
  });
  expect(JSON.stringify(payload)).not.toMatch(
    /stack|\/Users\/|workspace-secret|subject-secret/,
  );
}

describe('remediation HTTP request contract', () => {
  it('accepts one valid versioned request', async () => {
    const { app, calls } = harness();
    const response = await app.request(
      request(JSON.stringify({ version: 1, workspace: 'repo', issue: 'fix' }), {
        'content-type': 'Application/JSON; charset="utf-8"',
      }),
    );

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      request: { version: 1, workspace: 'repo', issue: 'fix' },
      trusted: identity,
    });
    expect(calls[0]?.trusted).toBe(identity);
  });

  it('dispatches one valid request through the default private Flue app', async () => {
    const privateCalls: Request[] = [];
    const app = createRemediationApp({
      trustedRequestContext: () => identity,
      privateFlueApp: {
        fetch: async (privateRequest) => {
          privateCalls.push(privateRequest);
          return Response.json({ status: 'accepted' });
        },
      },
    });
    const response = await app.request(
      request(JSON.stringify({ version: 1, workspace: 'repo' })),
    );

    expect(response.status).toBe(200);
    expect(privateCalls).toHaveLength(1);
    expect(new URL(privateCalls[0]?.url ?? '').pathname).toBe(
      '/workflows/remediate',
    );
    expect(new URL(privateCalls[0]?.url ?? '').search).toBe('?wait=result');
    expect(await privateCalls[0]?.json()).toEqual({
      request: { version: 1, workspace: 'repo' },
      trusted: identity,
    });
  });

  it('does not read a body before media-type or declared-size rejection', async () => {
    class PoisonBodyRequest extends Request {
      override get body(): Request['body'] {
        throw new Error('body was read');
      }
    }
    for (const headers of [
      {},
      { 'content-type': 'application/json', 'content-length': '65537' },
    ]) {
      const { app, calls } = harness();
      const response = await app.request(
        new PoisonBodyRequest('http://localhost/v1/remediations', {
          method: 'POST',
          headers,
        }),
      );
      expect([413, 415]).toContain(response.status);
      expect(calls).toHaveLength(0);
    }
  });

  it('does not expose the unvalidated Flue workflow route', async () => {
    for (const path of [
      '/workflows/remediate',
      '/workflows/remediate/',
      '/workflows/remediate/suffix',
      '/workflows/remediate-suffix',
      '/workflows/%72emediate',
      '/workflows/%2572emediate',
      '/workflows%2Fremediate',
      '/workflows//remediate',
      '/not-public',
    ]) {
      const { app, calls, privateCalls } = harness();
      const response = await app.request(
        new Request(`http://localhost${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workspace: 'repo',
            user: 'forged',
            tenant: 'acme',
          }),
        }),
      );
      await expectError(response, 404, 'not_found');
      expect(calls, path).toHaveLength(0);
      expect(privateCalls, path).toHaveLength(0);
    }
  });

  it('rejects duplicate Content-Type parameter names', async () => {
    for (const contentType of [
      'application/json; charset=utf-8; charset=utf-8',
      'application/json; Charset=utf-8; CHARSET=utf-16',
    ]) {
      const { app, calls } = harness();
      const response = await app.request(
        request(JSON.stringify({ version: 1, workspace: 'repo' }), {
          'content-type': contentType,
        }),
      );
      await expectError(response, 415, 'unsupported_media_type');
      expect(calls).toHaveLength(0);
    }
  });

  it('closes downstream failures without exposing internals', async () => {
    const app = createRemediationApp({
      trustedRequestContext: () => identity,
      invokeRemediation: async () => {
        throw new Error('/Users/private/stack');
      },
    });
    const response = await app.request(
      request(JSON.stringify({ version: 1, workspace: 'repo' })),
    );
    await expectError(response, 500, 'internal_error');
  });

  it('rejects invalid requests before side effects', async () => {
    const invalid: Array<{
      name: string;
      body: BodyInit | null;
      headers?: HeadersInit;
      status: number;
      code: string;
    }> = [
      {
        name: 'missing content type',
        body: '{}',
        headers: {},
        status: 415,
        code: 'unsupported_media_type',
      },
      {
        name: 'wrong content type',
        body: '{}',
        headers: { 'content-type': 'text/plain' },
        status: 415,
        code: 'unsupported_media_type',
      },
      {
        name: 'ambiguous content type',
        body: '{}',
        headers: {
          'content-type': 'application/json, application/json',
        },
        status: 415,
        code: 'unsupported_media_type',
      },
      {
        name: 'malformed content type',
        body: '{}',
        headers: { 'content-type': 'application/json; charset' },
        status: 415,
        code: 'unsupported_media_type',
      },
      {
        name: 'declared oversized',
        body: '{}',
        headers: {
          'content-type': 'application/json',
          'content-length': '65537',
        },
        status: 413,
        code: 'payload_too_large',
      },
      {
        name: 'malformed content length',
        body: '{}',
        headers: {
          'content-type': 'application/json',
          'content-length': '1, 1',
        },
        status: 400,
        code: 'invalid_request',
      },
      {
        name: 'invalid UTF-8',
        body: new Uint8Array([0xff]),
        status: 400,
        code: 'invalid_request',
      },
      {
        name: 'empty body',
        body: '',
        status: 400,
        code: 'invalid_request',
      },
      {
        name: 'multiple JSON values',
        body: '{} {}',
        status: 400,
        code: 'invalid_request',
      },
      {
        name: 'truncated JSON',
        body: '{"version":1',
        status: 400,
        code: 'invalid_request',
      },
      ...[
        null,
        [],
        'scalar',
        {},
        { version: '1', workspace: 'repo' },
        { version: 2, workspace: 'repo' },
        { version: 1, workspace: 1 },
        { version: 1, workspace: '' },
        { version: 1, workspace: 'x'.repeat(4097) },
        { version: 1, workspace: 'repo', issue: 1 },
        { version: 1, workspace: 'repo', issue: 'x'.repeat(8193) },
        { version: 1, workspace: 'repo', extra: true },
        { version: 1, workspace: '\ud800' },
        { version: 1, workspace: 'repo', issue: '\udfff' },
        { version: true, workspace: 'repo' },
      ].map((value, index) => ({
        name: `invalid JSON shape ${index}`,
        body: JSON.stringify(value),
        status: 400,
        code: 'invalid_request',
      })),
    ];

    for (const candidate of invalid) {
      const { app, calls } = harness();
      const response = await app.request(
        request(candidate.body, candidate.headers),
      );
      await expectError(response, candidate.status, candidate.code);
      expect(calls, candidate.name).toHaveLength(0);
    }
  });

  it('rejects body identity forgery', async () => {
    for (const field of ['user', 'tenant', 'roles', 'identity', 'provenance']) {
      const { app, calls } = harness();
      const response = await app.request(
        request(
          JSON.stringify({ version: 1, workspace: 'repo', [field]: 'forged' }),
        ),
      );
      await expectError(response, 400, 'invalid_request');
      expect(calls).toHaveLength(0);
    }
  });

  it('enforces actual raw byte limits even when Content-Length understates', async () => {
    for (const [size, expectedStatus] of [
      [65_536, 400],
      [65_537, 413],
    ] as const) {
      const { app, calls } = harness();
      const response = await app.request(
        request(new Uint8Array(size).fill(0x20), {
          'content-type': 'application/json',
          'content-length': '1',
        }),
      );
      await expectError(
        response,
        expectedStatus,
        expectedStatus === 413 ? 'payload_too_large' : 'invalid_request',
      );
      expect(calls).toHaveLength(0);
    }
  });

  it('uses Unicode code points and agrees with the JSON Schema matrix', async () => {
    const schema = JSON.parse(
      readFileSync('schemas/remediation-request.schema.json', 'utf8'),
    );
    const validate = new Ajv2020({ strict: true }).compile(schema);
    const astral = '\u{1f680}';
    const matrix: Array<{
      candidate: Record<string, unknown>;
      expected: boolean;
    }> = [
      {
        candidate: {
          version: 1,
          workspace: astral.repeat(4096),
          issue: astral.repeat(8192),
        },
        expected: true,
      },
      {
        candidate: { version: 1, workspace: astral.repeat(4097) },
        expected: false,
      },
      {
        candidate: {
          version: 1,
          workspace: 'repo',
          issue: astral.repeat(8193),
        },
        expected: false,
      },
      { candidate: { version: 1, workspace: 'repo' }, expected: true },
      {
        candidate: { version: 1, workspace: 'repo', unknown: true },
        expected: false,
      },
    ];

    for (const { candidate, expected } of matrix) {
      const { app, calls } = harness();
      const response = await app.request(request(JSON.stringify(candidate)));
      const runtimeAccepted = response.status === 200;
      expect(runtimeAccepted).toBe(expected);
      expect(validate(candidate)).toBe(expected);
      expect(calls).toHaveLength(expected ? 1 : 0);
    }
  });

  it('denies every incomplete or forged trusted identity tuple', async () => {
    const candidates: unknown[] = [
      undefined,
      {},
      {
        ...identity,
        identity_context: {
          ...identity.identity_context,
          principal_type: 'anonymous',
        },
      },
      {
        ...identity,
        identity_context: { ...identity.identity_context, issuer: 'wrong' },
      },
      {
        ...identity,
        identity_context: { ...identity.identity_context, audience: 'wrong' },
      },
      {
        ...identity,
        identity_context: {
          ...identity.identity_context,
          verification: { status: 'unverified', owner: 'caller' },
        },
      },
      {
        ...identity,
        identity_context: { ...identity.identity_context, roles: [] },
      },
      {
        ...identity,
        identity_context: {
          ...identity.identity_context,
          roles: ['data_analyst'],
        },
      },
      {
        ...identity,
        identity_context: {
          ...identity.identity_context,
          tenant_memberships: ['other'],
        },
      },
      { ...identity, request_context: { tenant: 'acme', binding_id: 'other' } },
    ];

    for (const candidate of candidates) {
      const { app, calls } = harness(candidate);
      const response = await app.request(
        request(JSON.stringify({ version: 1, workspace: 'workspace-secret' })),
      );
      expect([401, 403]).toContain(response.status);
      const payload = await response.text();
      expect(payload).not.toContain('workspace-secret');
      expect(payload).not.toContain('sub-123');
      expect(calls).toHaveLength(0);
    }
  });
});
