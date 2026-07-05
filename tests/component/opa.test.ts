import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { evaluatePolicy } from '../../src/lib/opa.ts';

describe('OPA Rego policy gate', () => {
  it('allows bounded patching for authorized engineer in tenant', async () => {
    const decision = await evaluatePolicy({
      user: 'engineer',
      tenant: 'acme',
      tool: 'apply_patch',
      risk: 'medium',
      resource: 'repo',
    });
    expect(decision).toMatchObject({ allow: true, requires_approval: false });
  });

  it('denies guest and raw SQL tools', async () => {
    await expect(
      evaluatePolicy({
        user: 'guest',
        tenant: 'acme',
        tool: 'apply_patch',
        risk: 'medium',
        resource: 'repo',
      }),
    ).resolves.toMatchObject({ allow: false });
    await expect(
      evaluatePolicy({
        user: 'engineer',
        tenant: 'acme',
        tool: 'raw_sql',
        risk: 'medium',
        resource: 'warehouse',
      }),
    ).resolves.toMatchObject({ allow: false });
  });

  it('denies acme when the tenant allowlist is empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eap-tenants-'));
    const tenantsPath = join(dir, 'tenants.json');
    await writeFile(
      tenantsPath,
      JSON.stringify({ eap: { tenants: { allowed: [] } } }),
      'utf8',
    );

    const decision = await evaluatePolicy(
      {
        user: 'engineer',
        tenant: 'acme',
        tool: 'apply_patch',
        risk: 'medium',
        resource: 'repo',
      },
      'policy/agent.rego',
      'data.eap.agent',
      tenantsPath,
    );

    expect(decision.allow).toBe(false);
    expect(decision.reasons).toContain('tenant_mismatch');
  });

  it('fails closed when the OPA binary is unavailable', async () => {
    vi.stubEnv('EAP_OPA_BINARY', '/definitely/missing/opa');
    const decision = await evaluatePolicy({
      user: 'engineer',
      tenant: 'acme',
      tool: 'apply_patch',
      risk: 'medium',
      resource: 'repo',
    });
    expect(decision.allow).toBe(false);
    expect(decision.requires_approval).toBe(true);
    expect(decision.reasons[0]).toContain('policy_unavailable');
    vi.unstubAllEnvs();
  });
});
