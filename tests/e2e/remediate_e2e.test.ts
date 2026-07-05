import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('Flue remediation E2E workflow', () => {
  it('runs issue localization, patching, verification, data guard, and closure gate', () => {
    const out = execFileSync(
      './node_modules/node/bin/node',
      [
        'scripts/run-flue-workflow.mjs',
        'remediate',
        '{"workspace":"sample_repos/buggy_multi","user":"engineer","tenant":"acme","issue":"fix all localized defects"}',
        '/tmp/eap-e2e.stdout.log',
        '/tmp/eap-e2e.stderr.log',
        '"status": "passed"',
      ],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 },
    );
    expect(out).toContain('workflow-result:matched');
  });
});
