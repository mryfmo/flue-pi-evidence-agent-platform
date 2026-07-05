import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applySelectedPatches,
  prepareWorkspace,
  proposePatchCandidates,
  scanWorkspace,
  sourceArtifactPaths,
  verifyWorkspace,
} from '../../src/lib/code.ts';

describe('code remediation engine', () => {
  it('localizes three independent hypotheses and closes them with selected patches', async () => {
    const source = 'sample_repos/buggy_multi';
    const workspace = await prepareWorkspace(source);
    const localized = await scanWorkspace(workspace);
    expect(localized.map((item) => item.id).sort()).toEqual([
      'HYP-DICT-KEY-GUARD-001',
      'HYP-DISCOUNT-VALIDATION-001',
      'HYP-DIVIDE-ZERO-001',
    ]);
    const candidates = proposePatchCandidates(localized);
    expect(candidates).toHaveLength(6);
    expect(
      candidates.some(
        (candidate) =>
          candidate.hypothesisId === 'HYP-DICT-KEY-GUARD-001' &&
          candidate.strategy === 'minimal_guard' &&
          candidate.rationale.includes('.get()'),
      ),
    ).toBe(true);
    expect(
      candidates.some(
        (candidate) =>
          candidate.hypothesisId === 'HYP-DICT-KEY-GUARD-001' &&
          candidate.strategy === 'input_validation' &&
          candidate.rationale.includes('guard branch'),
      ),
    ).toBe(true);
    const applied = await applySelectedPatches(workspace, candidates);
    expect(applied.hypothesesPatched).toHaveLength(3);
    expect(await scanWorkspace(workspace)).toHaveLength(0);
    const verification = await verifyWorkspace(workspace);
    expect(verification.passed).toBe(true);
  });

  it('repairs the held-out fixture without source fixture edits', async () => {
    const workspace = await prepareWorkspace('sample_repos/buggy_heldout');
    const localized = await scanWorkspace(workspace);
    expect(localized.map((item) => item.id).sort()).toEqual([
      'HYP-DICT-KEY-GUARD-001',
      'HYP-DISCOUNT-VALIDATION-001',
      'HYP-DIVIDE-ZERO-001',
    ]);
    const candidates = proposePatchCandidates(localized);
    expect(candidates).toHaveLength(6);
    const applied = await applySelectedPatches(workspace, candidates);
    expect(applied.hypothesesPatched).toHaveLength(3);
    expect(await scanWorkspace(workspace)).toHaveLength(0);
    const verification = await verifyWorkspace(workspace);
    expect(verification.passed).toBe(true);
  });

  it('derives source artifact paths from localized affected files', async () => {
    const workspace = await prepareWorkspace('sample_repos/buggy_heldout');
    const localized = await scanWorkspace(workspace);
    expect(sourceArtifactPaths(workspace, localized)).toEqual(['billing.py']);
  });

  it('fails verification on an intentionally unpatched copy', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'eap-failing-'));
    await prepareWorkspace('sample_repos/buggy_multi');
    const failing = await verifyWorkspace(workspace);
    expect(failing.passed).toBe(false);
  });
});
