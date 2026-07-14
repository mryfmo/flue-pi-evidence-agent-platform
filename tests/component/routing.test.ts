import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  classifyMessages,
  type VerifiedClassification,
} from '../../src/lib/dataProxy.ts';
import { evaluatePolicy } from '../../src/lib/opa.ts';
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

let evidence: VerifiedClassification;

beforeAll(async () => {
  evidence = await classifyMessages([
    { role: 'user', content: 'ordinary internal text' },
  ]);
});

describe('routing policy selection', () => {
  it('selects the exact matching route', () => {
    expect(selectRoute(internalFast, policyDoc)).toMatchObject({
      route_id: 'acme-internal-summary-fast',
      provider: 'local',
      model_id: 'fixbot',
      routing_policy_version: policyDoc.version,
    });
  });

  it('falls back to the default chain when no route matches', () => {
    expect(
      selectRoute({ ...internalFast, latency_target: 'batch' }, policyDoc),
    ).toMatchObject({
      route_id: 'default',
      provider: 'local',
      model_id: 'fixbot',
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
      authorizeRoute(selectRoute(internalFast, policyDoc), policyDoc, evidence),
    ).resolves.toMatchObject({ allow: true, requires_approval: false });
  });

  it('denies tenant mismatch', async () => {
    await expect(
      authorizeRoute(
        selectRoute({ ...internalFast, tenant: 'other' }, policyDoc),
        policyDoc,
        evidence,
      ),
    ).resolves.toMatchObject({
      allow: false,
      reasons: expect.arrayContaining(['tenant_mismatch']),
    });
  });

  it('denies acme routes when the tenant allowlist is empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eap-tenants-'));
    const tenantsPath = join(dir, 'tenants.json');
    await writeFile(
      tenantsPath,
      JSON.stringify({ eap: { tenants: { allowed: [] } } }),
      'utf8',
    );

    const decision = await evaluatePolicy(
      {
        decision: {
          ...selectRoute(internalFast, policyDoc),
          classification: {
            value: 'internal',
            trust_proof: {
              producer: 'flue-pi-data-guard',
              verified_by: 'flue-pi-platform-gateway',
              evidence_kind: 'presidio-sqlglot-redaction-v1',
            },
          },
        },
        policy: policyDoc,
      },
      'policy/routing.rego',
      'data.eap.routing',
      tenantsPath,
    );

    expect(decision.allow).toBe(false);
    expect(decision.reasons).toContain('tenant_mismatch');
  });

  it('rejects a scalar classification that disagrees with guard evidence', async () => {
    await expect(
      authorizeRoute(
        {
          ...selectRoute(internalFast, policyDoc),
          data_classification: 'restricted',
        },
        policyDoc,
        evidence,
      ),
    ).resolves.toMatchObject({
      allow: false,
      reasons: ['classification_evidence_mismatch'],
    });
  });

  it('fails closed when the OPA binary is unavailable', async () => {
    vi.stubEnv('EAP_OPA_BINARY', '/definitely/missing/opa');
    const decision = await authorizeRoute(
      selectRoute(internalFast, policyDoc),
      policyDoc,
      evidence,
    );
    expect(decision.allow).toBe(false);
    expect(decision.requires_approval).toBe(true);
    expect(decision.reasons[0]).toContain('policy_unavailable');
    vi.unstubAllEnvs();
  });
});
