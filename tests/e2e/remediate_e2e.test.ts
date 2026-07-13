import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Flue remediation E2E workflow', () => {
  it('runs the private workflow with gateway-owned trusted context', () => {
    const invocation = {
      request: {
        version: 1,
        workspace: 'sample_repos/buggy_multi',
        issue: 'fix all localized defects',
      },
      trusted: {
        identity_context: {
          subject_id: 'engineer',
          principal_type: 'authenticated',
          tenant_memberships: ['acme'],
          roles: ['software_engineer'],
          issuer: 'flue-pi-identity-authority',
          audience: 'flue-pi-agent-policy',
          verification: {
            status: 'verified',
            owner: 'flue-pi-platform-gateway',
          },
          request_binding: { id: 'e2e-binding' },
        },
        request_context: { tenant: 'acme', binding_id: 'e2e-binding' },
      },
    };
    const out = execFileSync(
      './node_modules/node/bin/node',
      [
        'scripts/run-flue-workflow.mjs',
        'remediate',
        JSON.stringify(invocation),
        '/tmp/eap-e2e.stdout.log',
        '/tmp/eap-e2e.stderr.log',
        '"status": "passed"',
      ],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 },
    );
    expect(out).toContain('workflow-result:matched');
  });
});
