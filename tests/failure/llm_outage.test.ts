import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callProductionGateway,
  type ProductionGatewayRequest,
} from '../../src/lib/productionGateway.ts';
import type { RoutingPolicyDocument } from '../../src/lib/router.ts';

afterEach(() => {
  vi.unstubAllEnvs();
});

async function request(
  overrides: Partial<ProductionGatewayRequest> = {},
): Promise<ProductionGatewayRequest> {
  const dir = mkdtempSync(join(tmpdir(), 'llm-outage-'));
  return {
    tenant: 'acme',
    user: 'engineer',
    data_classification: 'internal',
    task_kind: 'verified_evidence_summary',
    cost_budget: 'standard',
    latency_target: 'interactive',
    messages: [{ role: 'user', content: 'Summarize verified evidence.' }],
    audit_id: 'audit-outage',
    trace_id: 'trace-outage',
    audit_log_path: join(dir, 'audit.jsonl'),
    ...overrides,
  };
}

async function hangingBaseUrl() {
  const server = createServer((_req, _res) => {});
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('no address');
  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

function readAudit(path: string) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

describe('llm outage fail-closed behavior', () => {
  it('does not treat LiteLLM stopped on localhost as delegated success', async () => {
    vi.stubEnv('PI_PROVIDER', 'prod');
    vi.stubEnv('LITELLM_BASE_URL', 'http://127.0.0.1:9/v1');
    vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

    const result = await callProductionGateway(await request());

    expect(result).toMatchObject({
      ok: false,
      reason: 'llm_unavailable',
      routing_decision: { route_id: 'acme-internal-summary-main' },
    });
    expect(JSON.stringify(result)).not.toContain('deterministic-fallback');
  });

  it('times out a hanging LiteLLM proxy as llm_unavailable without success audit', async () => {
    const hang = await hangingBaseUrl();
    vi.stubEnv('PI_PROVIDER', 'prod');
    vi.stubEnv('LITELLM_BASE_URL', hang.baseUrl);
    vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');
    const gatewayRequest = await request();

    const result = await callProductionGateway(gatewayRequest);

    expect(result).toMatchObject({
      ok: false,
      reason: 'llm_unavailable',
    });
    expect(readAudit(gatewayRequest.audit_log_path)).not.toContain(
      'llm_gateway_call',
    );
    await hang.close();
  });

  it('keeps routing_decision and machine-readable reason when fallback chain is exhausted', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'llm-outage-policy-'));
    const policyPath = join(dir, 'routing.json');
    const policy: RoutingPolicyDocument = {
      version: 'p8-t05-outage',
      defaults: { fallback_chain: [] },
      routes: [
        {
          id: 'outage-main',
          match: {
            tenant: 'acme',
            data_classification: 'internal',
            task_kind: 'verified_evidence_summary',
            cost_budget: 'standard',
            latency_target: 'interactive',
          },
          provider: 'bad-main',
          model_id: 'worker-main',
          fallback_chain: [
            { provider: 'bad-backup', model_id: 'worker-heavy' },
          ],
        },
      ],
      providers: {
        'bad-main': {
          type: 'litellm_proxy',
          base_url_env: 'BAD_MAIN_URL',
          api_key_env: 'BAD_MAIN_KEY',
        },
        'bad-backup': {
          type: 'litellm_proxy',
          base_url_env: 'BAD_BACKUP_URL',
          api_key_env: 'BAD_BACKUP_KEY',
        },
      },
    };
    writeFileSync(policyPath, JSON.stringify(policy), 'utf8');
    vi.stubEnv('BAD_MAIN_URL', 'http://127.0.0.1:9/v1');
    vi.stubEnv('BAD_BACKUP_URL', 'http://127.0.0.1:9/v1');
    vi.stubEnv('BAD_MAIN_KEY', 'key');
    vi.stubEnv('BAD_BACKUP_KEY', 'key');

    const result = await callProductionGateway(
      await request({ routing_policy_path: policyPath }),
    );

    expect(result).toMatchObject({
      ok: false,
      reason: 'llm_unavailable',
      routing_decision: { route_id: 'outage-main' },
    });
  });
});
