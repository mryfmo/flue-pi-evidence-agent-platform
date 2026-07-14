import { readFile, mkdtemp } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  callProductionGateway,
  type ProductionGatewayRequest,
} from '../../src/lib/productionGateway.ts';
import type { RoutingPolicyDocument } from '../../src/lib/router.ts';
import { listenLoopback } from '../helpers/loopback-server.ts';

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

async function startMockProvider(responseText = 'verified summary') {
  const requests: unknown[] = [];
  const server = createServer(async (req, res) => {
    requests.push(await readJson(req));
    res.writeHead(200, {
      'content-type': 'application/json',
      'x-litellm-response-cost': '0.0012',
    });
    res.end(
      JSON.stringify({
        choices: [{ message: { content: responseText } }],
        usage: { prompt_tokens: 4, completion_tokens: 2, total_tokens: 6 },
      }),
    );
  });
  const address = await listenLoopback(server);
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function request(
  content = 'Summarize the verified evidence.',
): Promise<ProductionGatewayRequest> {
  const dir = await mkdtemp(join(tmpdir(), 'llm-contract-audit-'));
  return {
    tenant: 'acme',
    user: 'engineer',
    task_kind: 'verified_evidence_summary',
    cost_budget: 'standard',
    latency_target: 'interactive',
    messages: [{ role: 'user', content }],
    audit_id: 'audit-contract',
    trace_id: 'trace-contract',
    audit_log_path: join(dir, 'audit.jsonl'),
  };
}

describe('llm_contract production gateway', () => {
  it('uses guard-produced internal classification on the fixed prod route', async () => {
    const mock = await startMockProvider('contract ok');
    try {
      vi.stubEnv('PI_PROVIDER', 'prod');
      vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
      vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

      const result = await callProductionGateway(await request());

      expect(result).toMatchObject({
        ok: true,
        provider: 'litellm',
        content: 'contract ok',
        usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
        routing_decision: {
          route_id: 'acme-internal-summary-main',
          data_classification: 'internal',
        },
      });
      if (!result.ok) throw new Error('expected gateway success');
      expect(['worker-main', 'worker-fast']).toContain(result.model_id);
      expect(mock.requests).toHaveLength(1);
      expect(mock.requests[0]).toMatchObject({
        metadata: { tenant: 'acme', data_class: 'internal' },
      });
    } finally {
      await mock.close();
      vi.unstubAllEnvs();
    }
  });

  it('writes guard classification and digests without raw content', async () => {
    vi.stubEnv('PI_PROVIDER', 'local');
    const gatewayRequest = await request();

    await callProductionGateway(gatewayRequest);
    const audit = await readFile(gatewayRequest.audit_log_path, 'utf8');

    expect(audit).toContain('audit-contract');
    expect(audit).toContain('trace-contract');
    expect(audit).toContain('"data_classification":"internal"');
    expect(audit).toContain('request_digest');
    expect(audit).toContain('response_digest');
    expect(audit).not.toContain('Summarize the verified evidence.');
    vi.unstubAllEnvs();
  });

  it('denies confidential external data without accepting caller approval', async () => {
    const mock = await startMockProvider();
    try {
      vi.stubEnv('PI_PROVIDER', 'prod');
      vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
      vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');
      const untrusted = {
        ...(await request('Contact alice@example.com')),
        approval_ref: 'caller-approval',
        data_classification: 'internal',
        routing_policy_path: '/tmp/caller-policy.json',
      };

      const result = await callProductionGateway(untrusted);

      expect(result).toMatchObject({
        ok: false,
        reason: expect.stringContaining('confidential_requires_approval'),
        routing_decision: {
          route_id: 'acme-confidential-summary-heavy',
          data_classification: 'confidential',
        },
      });
      expect(mock.requests).toHaveLength(0);
    } finally {
      await mock.close();
      vi.unstubAllEnvs();
    }
  });

  it('denies restricted external data before provider dispatch', async () => {
    const mock = await startMockProvider();
    try {
      vi.stubEnv('PI_PROVIDER', 'prod');
      vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
      vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

      const result = await callProductionGateway(
        await request('token=12345678secret'),
      );

      expect(result).toMatchObject({
        ok: false,
        reason: expect.stringContaining('restricted_external_provider'),
        routing_decision: { data_classification: 'restricted' },
      });
      expect(mock.requests).toHaveLength(0);
    } finally {
      await mock.close();
      vi.unstubAllEnvs();
    }
  });

  it('ignores caller scalar classification and uses guard output everywhere', async () => {
    const mock = await startMockProvider();
    try {
      vi.stubEnv('PI_PROVIDER', 'prod');
      vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
      vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');
      const untrusted = {
        ...(await request()),
        data_classification: 'restricted',
      };

      const result = await callProductionGateway(untrusted);

      expect(result).toMatchObject({
        ok: true,
        routing_decision: { data_classification: 'internal' },
      });
      expect(mock.requests[0]).toMatchObject({
        metadata: { data_class: 'internal' },
      });
    } finally {
      await mock.close();
      vi.unstubAllEnvs();
    }
  });

  it('fails guard errors as classification_unavailable with zero dispatch', async () => {
    const mock = await startMockProvider();
    try {
      vi.stubEnv('PI_PROVIDER', 'prod');
      vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
      vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

      await expect(
        callProductionGateway({ ...(await request()), messages: [] }),
      ).resolves.toEqual({
        ok: false,
        reason: 'classification_unavailable',
      });
      expect(mock.requests).toHaveLength(0);
    } finally {
      await mock.close();
      vi.unstubAllEnvs();
    }
  });

  it('fails tenant mismatch and missing provider secrets before dispatch', async () => {
    const mock = await startMockProvider();
    try {
      vi.stubEnv('PI_PROVIDER', 'prod');
      vi.stubEnv('LITELLM_BASE_URL', mock.baseUrl);
      vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');
      const wrongTenant = { ...(await request()), tenant: 'other' };
      await expect(callProductionGateway(wrongTenant)).resolves.toMatchObject({
        ok: false,
        reason: expect.stringContaining('tenant_mismatch'),
      });
      expect(mock.requests).toHaveLength(0);

      vi.stubEnv('LITELLM_VIRTUAL_KEY', '');
      await expect(
        callProductionGateway(await request()),
      ).resolves.toMatchObject({
        ok: false,
        reason: 'provider_env_unavailable',
      });
      expect(mock.requests).toHaveLength(0);
    } finally {
      await mock.close();
      vi.unstubAllEnvs();
    }
  });

  it('keeps the fixed local provider path deterministic after guard verification', async () => {
    vi.stubEnv('PI_PROVIDER', 'local');
    await expect(callProductionGateway(await request())).resolves.toMatchObject(
      {
        ok: true,
        provider: 'local',
        model_id: 'fixbot',
        content: 'deterministic-fallback',
        routing_decision: {
          route_id: 'acme-internal-summary-fast',
          data_classification: 'internal',
        },
      },
    );
    vi.unstubAllEnvs();
  });

  it('requires routing.prod.json to be a direct flat policy document', () => {
    const prodPolicyText = readFileSync('policy/routing.prod.json', 'utf8');
    const prodPolicy = JSON.parse(prodPolicyText) as RoutingPolicyDocument;

    expect(prodPolicy).not.toHaveProperty('routing_prod');
    expect(prodPolicyText).not.toMatch(/openai|anthropic|vllm/i);
    expect(JSON.stringify(prodPolicy.routes)).not.toContain(
      'deterministic-fallback',
    );
    expect(Object.keys(prodPolicy.providers)).toEqual(['litellm']);
  });
});
