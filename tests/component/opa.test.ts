import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { evaluatePolicy } from '../../src/lib/opa.ts';

const validInput = {
  identity_context: {
    subject_id: 'sub-123',
    principal_type: 'authenticated',
    tenant_memberships: ['acme'],
    roles: ['software_engineer'],
    issuer: 'flue-pi-identity-authority',
    audience: 'flue-pi-agent-policy',
    verification: { status: 'verified', owner: 'flue-pi-platform-gateway' },
    request_binding: { id: 'req-123' },
  },
  request_context: { tenant: 'acme', binding_id: 'req-123' },
  tool: 'apply_patch',
  risk: 'medium',
  resource: 'repo',
};

const deniedCases = [
  {
    name: 'body-only identity spoof',
    input: {
      user: 'engineer',
      tenant: 'acme',
      tool: 'apply_patch',
      risk: 'medium',
      resource: 'repo',
    },
    reasons: [
      'body_identity_forbidden',
      'missing_identity_context',
      'missing_request_context',
    ],
  },
  {
    name: 'unknown role',
    input: {
      ...validInput,
      identity_context: { ...validInput.identity_context, roles: ['unknown'] },
    },
    reasons: ['insufficient_role', 'unknown_role'],
  },
  {
    name: 'insufficient role',
    input: {
      ...validInput,
      identity_context: {
        ...validInput.identity_context,
        roles: ['data_analyst'],
      },
    },
    reasons: ['insufficient_role'],
  },
  {
    name: 'tenant mismatch',
    input: {
      ...validInput,
      request_context: { tenant: 'other', binding_id: 'req-123' },
    },
    reasons: ['tenant_mismatch'],
  },
  {
    name: 'raw SQL tool',
    input: { ...validInput, tool: 'raw_sql', resource: 'warehouse' },
    reasons: ['insufficient_role', 'raw_data_tool_blocked', 'unknown_tool'],
  },
  {
    name: 'shell tool',
    input: { ...validInput, tool: 'shell' },
    reasons: ['dangerous_shell', 'insufficient_role', 'unknown_tool'],
  },
  {
    name: 'unknown tool',
    input: { ...validInput, tool: 'unknown' },
    reasons: ['insufficient_role', 'unknown_tool'],
  },
];

describe('OPA Rego policy gate', () => {
  it('allows bounded patching from the canonical gateway context', async () => {
    await expect(evaluatePolicy(validInput)).resolves.toEqual({
      allow: true,
      requires_approval: false,
      reasons: ['ok'],
    });
  });

  it.each(deniedCases)('denies $name at its intended branch', async (row) => {
    const decision = await evaluatePolicy(row.input);
    expect({ ...decision, reasons: [...decision.reasons].sort() }).toEqual({
      allow: false,
      requires_approval: false,
      reasons: [...row.reasons].sort(),
    });
  });

  it('denies acme when the tenant allowlist is empty', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'eap-tenants-'));
    const tenantsPath = join(dir, 'tenants.json');
    await writeFile(
      tenantsPath,
      JSON.stringify({ eap: { tenants: { allowed: [] } } }),
      'utf8',
    );

    await expect(
      evaluatePolicy(
        validInput,
        'policy/agent.rego',
        'data.eap.agent',
        tenantsPath,
      ),
    ).resolves.toEqual({
      allow: false,
      requires_approval: false,
      reasons: ['tenant_mismatch'],
    });
  });

  it('fails closed when the OPA binary is unavailable', async () => {
    vi.stubEnv('EAP_OPA_BINARY', '/definitely/missing/opa');
    const decision = await evaluatePolicy(validInput);
    expect(decision.allow).toBe(false);
    expect(decision.requires_approval).toBe(true);
    expect(decision.reasons[0]).toContain('policy_unavailable');
    vi.unstubAllEnvs();
  });
});
