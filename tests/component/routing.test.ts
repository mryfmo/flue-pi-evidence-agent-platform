import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  authorizeRoute,
  type RoutingInput,
  type RoutingPolicyDocument,
  selectRoute,
} from '../../src/lib/router.ts';

const policyDoc = JSON.parse(
  readFileSync('policy/routing.json', 'utf8'),
) as RoutingPolicyDocument;

const internalFast: RoutingInput = {
  tenant: 'acme',
  data_classification: 'internal',
  task_kind: 'verified_evidence_summary',
  cost_budget: 'standard',
  latency_target: 'interactive',
};

describe('routing policy selection', () => {
  it('selects the exact matching route', () => {
    expect(selectRoute(internalFast, policyDoc)).toMatchObject({
      route_id: 'acme-internal-summary-fast',
      provider: 'anthropic',
      model_id: 'claude-sonnet-5',
      routing_policy_version: policyDoc.version,
    });
  });

  it('falls back to the default chain when no route matches', () => {
    expect(
      selectRoute({ ...internalFast, latency_target: 'batch' }, policyDoc),
    ).toMatchObject({
      route_id: 'default',
      provider: 'openai',
      model_id: 'gpt-5.5',
      fallback_chain: policyDoc.defaults.fallback_chain,
    });
  });

  it('returns deterministic decisions for the same input', () => {
    expect(selectRoute(internalFast, policyDoc)).toEqual(
      selectRoute(internalFast, policyDoc),
    );
  });
});

describe('routing OPA authorization', () => {
  it('allows a valid acme route', async () => {
    await expect(
      authorizeRoute(selectRoute(internalFast, policyDoc), policyDoc),
    ).resolves.toMatchObject({ allow: true, requires_approval: false });
  });

  it('denies tenant mismatch', async () => {
    await expect(
      authorizeRoute(
        selectRoute({ ...internalFast, tenant: 'other' }, policyDoc),
        policyDoc,
      ),
    ).resolves.toMatchObject({ allow: false });
  });

  it('denies restricted data routed to an external provider', async () => {
    await expect(
      authorizeRoute(
        {
          ...selectRoute(internalFast, policyDoc),
          data_classification: 'restricted',
        },
        policyDoc,
      ),
    ).resolves.toMatchObject({ allow: false });
  });

  it('fails closed when the OPA binary is unavailable', async () => {
    vi.stubEnv('EAP_OPA_BINARY', '/definitely/missing/opa');
    const decision = await authorizeRoute(
      selectRoute(internalFast, policyDoc),
      policyDoc,
    );
    expect(decision.allow).toBe(false);
    expect(decision.requires_approval).toBe(true);
    expect(decision.reasons[0]).toContain('policy_unavailable');
    vi.unstubAllEnvs();
  });
});
