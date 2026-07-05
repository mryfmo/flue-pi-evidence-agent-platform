import { describe, expect, it } from 'vitest';
import {
  addEvidence,
  addHypotheses,
  addPatchCandidate,
  closureGate,
  createLedger,
  markHypothesesVerified,
} from '../../src/lib/ledger.ts';
import type { Hypothesis, VerificationResult } from '../../src/lib/types.ts';

const hypothesis: Hypothesis = {
  id: 'HYP-1',
  title: 'demo',
  affectedFile: 'app.py',
  affectedSymbol: 'demo',
  evidence: ['source'],
  status: 'localized',
  severity: 'medium',
  requiredChecks: ['pytest'],
};
const verification: VerificationResult = {
  passed: true,
  command: 'pytest',
  stdout: 'passed',
  stderr: '',
  exitCode: 0,
};

describe('hypothesis ledger closure gate', () => {
  it('keeps a run open until all required evidence classes are present', () => {
    let ledger = createLedger('run-test');
    ledger = addHypotheses(ledger, [hypothesis]);
    ledger = addPatchCandidate(ledger, {
      id: 'PATCH-HYP-1',
      hypothesisId: 'HYP-1',
      affectedFile: 'app.py',
      strategy: 'minimal_guard',
      status: 'applied',
      rationale: 'demo',
    });
    ledger = markHypothesesVerified(ledger, verification);
    expect(closureGate(ledger).closed).toBe(false);
    ledger = addEvidence(ledger, {
      id: 'EV-S',
      kind: 'source',
      summary: 'source',
    });
    ledger = addEvidence(ledger, {
      id: 'EV-P',
      kind: 'policy',
      summary: 'policy',
    });
    ledger = addEvidence(ledger, {
      id: 'EV-V',
      kind: 'verification',
      summary: 'verify',
    });
    ledger = addEvidence(ledger, { id: 'EV-D', kind: 'data', summary: 'data' });
    expect(closureGate(ledger)).toMatchObject({ closed: true });
  });
});
