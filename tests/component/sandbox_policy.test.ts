import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluatePolicy } from '../../src/lib/opa.ts';

const policyPath = 'policy/sandbox.rego';
const query = 'data.eap.sandbox';

describe('eap.sandbox policy', () => {
  it('allows acme tenants with denied egress and no environment variables', async () => {
    await expect(
      evaluatePolicy(
        {
          tenant: 'acme',
          image: {
            name: 'opensandbox/code-interpreter',
            tag: 'v1.1.0',
            digest:
              'sha256:133a3c1720dd52291a019740c2987e7164ea6de79e23d8198798e58950ae2e6e',
          },
          egress: 'deny',
          policy_id: '',
          env_keys: [],
        },
        policyPath,
        query,
      ),
    ).resolves.toMatchObject({
      allow: true,
      requires_approval: false,
      reasons: ['ok'],
    });
  });

  it('denies non-acme tenants', async () => {
    const decision = await evaluatePolicy(
      {
        tenant: 'other',
        image: {
          name: 'opensandbox/code-interpreter',
          tag: 'v1.1.0',
          digest: 'sha256:test',
        },
        egress: 'deny',
        policy_id: '',
        env_keys: [],
      },
      policyPath,
      query,
    );

    expect(decision.allow).toBe(false);
    expect(decision.requires_approval).toBe(false);
    expect(decision.reasons).toContain('tenant_mismatch');
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
        tenant: 'acme',
        image: {
          name: 'opensandbox/code-interpreter',
          tag: 'v1.1.0',
          digest: 'sha256:test',
        },
        egress: 'deny',
        policy_id: '',
        env_keys: [],
      },
      policyPath,
      query,
      tenantsPath,
    );

    expect(decision.allow).toBe(false);
    expect(decision.reasons).toContain('tenant_mismatch');
  });

  it('denies open egress without an allowlisted policy', async () => {
    const decision = await evaluatePolicy(
      {
        tenant: 'acme',
        image: {
          name: 'opensandbox/code-interpreter',
          tag: 'v1.1.0',
          digest: 'sha256:test',
        },
        egress: 'allow',
        policy_id: 'not-allowlisted',
        env_keys: [],
      },
      policyPath,
      query,
    );

    expect(decision.allow).toBe(false);
    expect(decision.reasons).toContain('egress_not_denied');
  });

  it('denies environment variables that are not allowlisted', async () => {
    const decision = await evaluatePolicy(
      {
        tenant: 'acme',
        image: {
          name: 'opensandbox/code-interpreter',
          tag: 'v1.1.0',
          digest: 'sha256:test',
        },
        egress: 'deny',
        policy_id: '',
        env_keys: ['SECRET_TOKEN'],
      },
      policyPath,
      query,
    );

    expect(decision.allow).toBe(false);
    expect(decision.reasons).toContain('env_key_not_allowed');
  });

  it('fails closed when the policy cannot be evaluated', async () => {
    await expect(
      evaluatePolicy(
        {
          tenant: 'acme',
          egress: 'deny',
          policy_id: '',
          env_keys: [],
        },
        'policy/missing-sandbox.rego',
        query,
      ),
    ).resolves.toMatchObject({
      allow: false,
      requires_approval: true,
    });
  });
});
