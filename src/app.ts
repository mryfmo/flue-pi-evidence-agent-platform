/** Flue application entrypoint with OpenTelemetry observer registration. */
import { createOpenTelemetryObserver } from '@flue/opentelemetry';
import { observe } from '@flue/runtime';
import { flue } from '@flue/runtime/routing';
import { Hono, type Context } from 'hono';
import type {
  IdentityRole,
  RemediationInvocation,
  RemediationRequest,
  TrustedRequestContext,
} from './lib/types.ts';

export type {
  RemediationInvocation,
  RemediationRequest,
  TrustedRequestContext,
} from './lib/types.ts';

observe(createOpenTelemetryObserver());

const MAX_BODY_BYTES = 65_536;
const CONTENT_TYPE =
  /^\s*application\/json\s*(?:;\s*[!#$%&'*+.^_`|~0-9A-Za-z-]+\s*=\s*(?:[!#$%&'*+.^_`|~0-9A-Za-z-]+|"(?:[\t !#-\[\]-~]|\\[\t -~])*"))*\s*$/i;
const KNOWN_ROLES = new Set<IdentityRole>([
  'platform_engineer',
  'software_engineer',
  'data_analyst',
  'security_reviewer',
]);
const REMEDIATION_ROLES = new Set<IdentityRole>([
  'platform_engineer',
  'software_engineer',
]);

interface RemediationAppDependencies {
  trustedRequestContext?: (context: Context) => unknown;
  privateFlueApp?: Pick<ReturnType<typeof flue>, 'fetch'>;
  invokeRemediation?: (
    invocation: RemediationInvocation,
    context: Context,
  ) => Promise<Response>;
}

export function createRemediationApp(
  dependencies: RemediationAppDependencies = {},
) {
  const app = new Hono();
  const privateFlueApp = dependencies.privateFlueApp ?? flue();
  const trustedRequestContext =
    dependencies.trustedRequestContext ??
    ((context: Context) =>
      (context.env as { trustedRequestContext?: unknown } | undefined)
        ?.trustedRequestContext);
  const invokeRemediation =
    dependencies.invokeRemediation ??
    (async (invocation: RemediationInvocation, context: Context) => {
      const url = new URL('/workflows/remediate?wait=result', context.req.url);
      return privateFlueApp.fetch(
        new Request(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(invocation),
        }),
        context.env,
      );
    });

  app.get('/health', (c) => c.json({ ok: true }));
  app.post('/v1/remediations', async (c) => {
    const requestId = crypto.randomUUID();
    const contentType = c.req.header('content-type');
    if (!contentType || !validJsonContentType(contentType)) {
      return requestError(
        c,
        415,
        'unsupported_media_type',
        'Content-Type must have application/json media-type essence.',
        requestId,
      );
    }

    const declaredLength = c.req.header('content-length');
    if (declaredLength !== undefined) {
      if (!/^\d+$/.test(declaredLength)) {
        return requestError(
          c,
          400,
          'invalid_request',
          'Content-Length is malformed.',
          requestId,
        );
      }
      if (BigInt(declaredLength) > MAX_BODY_BYTES) {
        return requestError(
          c,
          413,
          'payload_too_large',
          'Request body exceeds 65536 bytes.',
          requestId,
        );
      }
    }

    let bytes: Uint8Array | undefined;
    try {
      bytes = await readBoundedBody(c.req.raw);
    } catch {
      return requestError(
        c,
        400,
        'invalid_request',
        'Request body could not be read.',
        requestId,
      );
    }
    if (!bytes) {
      return requestError(
        c,
        413,
        'payload_too_large',
        'Request body exceeds 65536 bytes.',
        requestId,
      );
    }

    let value: unknown;
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      value = JSON.parse(text);
    } catch {
      return requestError(
        c,
        400,
        'invalid_request',
        'Request body must be one valid UTF-8 JSON value.',
        requestId,
      );
    }
    const request = validateRemediationRequest(value);
    if (!request) {
      return requestError(
        c,
        400,
        'invalid_request',
        'Request body does not match remediation request version 1.',
        requestId,
      );
    }

    let trustedValue: unknown;
    try {
      trustedValue = trustedRequestContext(c);
    } catch {
      trustedValue = undefined;
    }
    const trusted = validateTrustedRequestContext(trustedValue);
    if (!trusted.ok) {
      return requestError(
        c,
        trusted.status,
        trusted.status === 401
          ? 'authentication_required'
          : 'authorization_denied',
        trusted.status === 401
          ? 'A complete verified identity is required.'
          : 'The verified identity is not authorized for this request.',
        requestId,
      );
    }

    try {
      const response = await invokeRemediation(
        { request, trusted: trusted.value },
        c,
      );
      if (response.status >= 400) {
        return requestError(
          c,
          500,
          'internal_error',
          'The remediation request could not be completed.',
          requestId,
        );
      }
      return response;
    } catch {
      return requestError(
        c,
        500,
        'internal_error',
        'The remediation request could not be completed.',
        requestId,
      );
    }
  });
  app.notFound((c) =>
    requestError(
      c,
      404,
      'not_found',
      'The requested operation was not found.',
      crypto.randomUUID(),
    ),
  );
  return app;
}

function validJsonContentType(value: string) {
  if (!CONTENT_TYPE.test(value)) return false;
  const names = new Set<string>();
  let start = value.indexOf(';');
  let quoted = false;
  let escaped = false;
  for (let index = start + 1; start !== -1 && index <= value.length; index++) {
    const character = value[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') quoted = false;
    } else if (character === '"') {
      quoted = true;
    } else if (character === ';' || index === value.length) {
      const parameter = value.slice(start + 1, index);
      const name = parameter
        .slice(0, parameter.indexOf('='))
        .trim()
        .toLowerCase();
      if (names.has(name)) return false;
      names.add(name);
      start = index;
    }
  }
  return true;
}

async function readBoundedBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function validateRemediationRequest(
  value: unknown,
): RemediationRequest | undefined {
  if (!isClosedObject(value, ['version', 'workspace', 'issue'])) return;
  if (value.version !== 1 || !Object.hasOwn(value, 'workspace')) return;
  if (!validString(value.workspace, 1, 4096)) return;
  if (Object.hasOwn(value, 'issue') && !validString(value.issue, 0, 8192))
    return;
  return value as unknown as RemediationRequest;
}

function validateTrustedRequestContext(
  value: unknown,
):
  | { ok: true; value: TrustedRequestContext }
  | { ok: false; status: 401 | 403 } {
  if (!isClosedObject(value, ['identity_context', 'request_context']))
    return { ok: false, status: 401 };
  const identity = value.identity_context;
  const request = value.request_context;
  if (
    !isClosedObject(identity, [
      'subject_id',
      'principal_type',
      'tenant_memberships',
      'roles',
      'issuer',
      'audience',
      'verification',
      'request_binding',
    ]) ||
    !isClosedObject(request, ['tenant', 'binding_id']) ||
    !isClosedObject(identity.verification, ['status', 'owner']) ||
    !isClosedObject(identity.request_binding, ['id']) ||
    !validString(identity.subject_id, 1, Number.MAX_SAFE_INTEGER) ||
    identity.principal_type !== 'authenticated' ||
    identity.issuer !== 'flue-pi-identity-authority' ||
    identity.audience !== 'flue-pi-agent-policy' ||
    identity.verification.status !== 'verified' ||
    identity.verification.owner !== 'flue-pi-platform-gateway' ||
    !validString(identity.request_binding.id, 1, Number.MAX_SAFE_INTEGER) ||
    !validString(request.tenant, 1, Number.MAX_SAFE_INTEGER) ||
    !validString(request.binding_id, 1, Number.MAX_SAFE_INTEGER) ||
    !validUniqueStringArray(identity.tenant_memberships) ||
    !Array.isArray(identity.roles) ||
    identity.roles.length === 0 ||
    new Set(identity.roles).size !== identity.roles.length ||
    !identity.roles.every((role) => KNOWN_ROLES.has(role as IdentityRole))
  ) {
    return { ok: false, status: 401 };
  }
  if (
    !identity.tenant_memberships.includes(request.tenant) ||
    identity.request_binding.id !== request.binding_id ||
    !identity.roles.some((role) => REMEDIATION_ROLES.has(role as IdentityRole))
  ) {
    return { ok: false, status: 403 };
  }
  return { ok: true, value: value as unknown as TrustedRequestContext };
}

function validString(
  value: unknown,
  min: number,
  max: number,
): value is string {
  if (typeof value !== 'string' || /[\uD800-\uDFFF]/u.test(value)) return false;
  const length = [...value].length;
  return length >= min && length <= max;
}

function validUniqueStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    new Set(value).size === value.length &&
    value.every((item) => validString(item, 1, Number.MAX_SAFE_INTEGER))
  );
}

function isClosedObject(
  value: unknown,
  allowedKeys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).every((key) => allowedKeys.includes(key))
  );
}

function requestError(
  context: Context,
  status: 400 | 401 | 403 | 404 | 413 | 415 | 500,
  code: string,
  message: string,
  requestId: string,
) {
  return context.json(
    { version: 1, error: { code, message, request_id: requestId } },
    status,
  );
}

export default createRemediationApp();
