import { mkdtempSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callProductionGateway,
  type ProductionGatewayRequest,
} from '../../src/lib/productionGateway.ts';
import { listenLoopback } from '../helpers/loopback-server.ts';

afterEach(() => vi.unstubAllEnvs());

function request(): ProductionGatewayRequest {
  const dir = mkdtempSync(join(tmpdir(), 'llm-outage-'));
  return {
    tenant: 'acme',
    user: 'engineer',
    task_kind: 'verified_evidence_summary',
    cost_budget: 'standard',
    latency_target: 'interactive',
    messages: [{ role: 'user', content: 'Summarize verified evidence.' }],
    audit_id: 'audit-outage',
    trace_id: 'trace-outage',
    audit_log_path: join(dir, 'audit.jsonl'),
  };
}

function readAudit(path: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

describe('llm outage fail-closed behavior', () => {
  it('reaches genuine llm_unavailable after verified internal classification', async () => {
    vi.stubEnv('PI_PROVIDER', 'prod');
    vi.stubEnv('LITELLM_BASE_URL', 'http://127.0.0.1:9/v1');
    vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

    await expect(callProductionGateway(request())).resolves.toMatchObject({
      ok: false,
      reason: 'llm_unavailable',
      routing_decision: {
        route_id: 'acme-internal-summary-main',
        data_classification: 'internal',
      },
    });
  });

  it('times out a hanging provider without a success audit', async () => {
    const server = createServer((_req, _res) => {});
    const address = await listenLoopback(server);
    try {
      vi.stubEnv('PI_PROVIDER', 'prod');
      vi.stubEnv('LITELLM_BASE_URL', `http://127.0.0.1:${address.port}/v1`);
      vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');
      const gatewayRequest = request();

      await expect(
        callProductionGateway(gatewayRequest),
      ).resolves.toMatchObject({
        ok: false,
        reason: 'llm_unavailable',
      });
      expect(readAudit(gatewayRequest.audit_log_path)).not.toContain(
        'llm_gateway_call',
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('does not turn guard unavailability into a provider outage or dispatch', async () => {
    let requests = 0;
    const server = createServer((_req, res) => {
      requests += 1;
      res.end('{}');
    });
    const address = await listenLoopback(server);
    try {
      vi.stubEnv('PI_PROVIDER', 'prod');
      vi.stubEnv('LITELLM_BASE_URL', `http://127.0.0.1:${address.port}/v1`);
      vi.stubEnv('LITELLM_VIRTUAL_KEY', 'virtual-key');

      await expect(
        callProductionGateway({ ...request(), messages: [] }),
      ).resolves.toEqual({
        ok: false,
        reason: 'classification_unavailable',
      });
      expect(requests).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
