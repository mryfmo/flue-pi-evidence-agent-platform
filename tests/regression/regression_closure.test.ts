import { describe, expect, it } from 'vitest';
import {
  prepareWorkspace,
  proposePatchCandidates,
  scanWorkspace,
  applySelectedPatches,
} from '../../src/lib/code.ts';

describe('regression closure rescan', () => {
  it('does not re-open hypotheses after selected patches are applied', async () => {
    const workspace = await prepareWorkspace('sample_repos/buggy_multi');
    const firstScan = await scanWorkspace(workspace);
    await applySelectedPatches(workspace, proposePatchCandidates(firstScan));
    const secondScan = await scanWorkspace(workspace);
    expect(secondScan).toEqual([]);
  });
});
