import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applySelectedPatches,
  prepareWorkspace,
  proposePatchCandidates,
  scanWorkspace,
  verifyWorkspace,
} from '../../src/lib/code.ts';

describe('code remediation engine', () => {
  it('localizes two independent hypotheses and closes them with selected patches', async () => {
    const source = 'sample_repos/buggy_multi';
    const workspace = await prepareWorkspace(source);
    const localized = await scanWorkspace(workspace);
    expect(localized.map((item) => item.id).sort()).toEqual([
      'HYP-DISCOUNT-VALIDATION-001',
      'HYP-DIVIDE-ZERO-001',
    ]);
    const candidates = proposePatchCandidates(localized);
    expect(candidates).toHaveLength(4);
    const applied = await applySelectedPatches(workspace, candidates);
    expect(applied.hypothesesPatched).toHaveLength(2);
    expect(await scanWorkspace(workspace)).toHaveLength(0);
    const verification = await verifyWorkspace(workspace);
    expect(verification.passed).toBe(true);
  });

  it('fails verification on an intentionally unpatched copy', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'eap-failing-'));
    await prepareWorkspace('sample_repos/buggy_multi');
    const failing = await verifyWorkspace(workspace);
    expect(failing.passed).toBe(false);
  });
});
