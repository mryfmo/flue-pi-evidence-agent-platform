/** Durable hypothesis ledger and evidence graph for closure-gated remediation. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type {
  ClosureResult,
  EvidenceNode,
  Hypothesis,
  ImpactEdge,
  PatchCandidate,
  VerificationResult,
} from './types.ts';

export interface LedgerState {
  runId: string;
  hypotheses: Hypothesis[];
  evidence: EvidenceNode[];
  patches: PatchCandidate[];
  impactGraph: ImpactEdge[];
  verifications: VerificationResult[];
}

export function createLedger(runId: string): LedgerState {
  return {
    runId,
    hypotheses: [],
    evidence: [],
    patches: [],
    impactGraph: [],
    verifications: [],
  };
}

export function addHypotheses(
  ledger: LedgerState,
  hypotheses: Hypothesis[],
): LedgerState {
  const known = new Set(ledger.hypotheses.map((item) => item.id));
  return {
    ...ledger,
    hypotheses: [
      ...ledger.hypotheses,
      ...hypotheses.filter((item) => !known.has(item.id)),
    ],
  };
}

export function addEvidence(
  ledger: LedgerState,
  evidence: EvidenceNode,
): LedgerState {
  return { ...ledger, evidence: [...ledger.evidence, evidence] };
}

export function addPatchCandidate(
  ledger: LedgerState,
  patch: PatchCandidate,
): LedgerState {
  return { ...ledger, patches: [...ledger.patches, patch] };
}

export function markPatchApplied(
  ledger: LedgerState,
  patchId: string,
): LedgerState {
  return {
    ...ledger,
    patches: ledger.patches.map((patch) =>
      patch.id === patchId ? { ...patch, status: 'applied' as const } : patch,
    ),
  };
}

export function addImpactEdge(
  ledger: LedgerState,
  edge: ImpactEdge,
): LedgerState {
  return { ...ledger, impactGraph: [...ledger.impactGraph, edge] };
}

export function markHypothesesPatched(
  ledger: LedgerState,
  hypothesisIds: string[],
): LedgerState {
  const ids = new Set(hypothesisIds);
  return {
    ...ledger,
    hypotheses: ledger.hypotheses.map((item) =>
      ids.has(item.id) ? { ...item, status: 'patched' as const } : item,
    ),
  };
}

export function markHypothesesVerified(
  ledger: LedgerState,
  verification: VerificationResult,
): LedgerState {
  const verified = verification.passed
    ? ledger.hypotheses.map((item) => ({
        ...item,
        status: 'verified' as const,
      }))
    : ledger.hypotheses;
  return {
    ...ledger,
    hypotheses: verified,
    verifications: [...ledger.verifications, verification],
  };
}

export function closureGate(ledger: LedgerState): ClosureResult {
  const reasons: string[] = [];
  const open = ledger.hypotheses.filter((item) => item.status !== 'verified');
  const verified = ledger.hypotheses.filter(
    (item) => item.status === 'verified',
  );
  if (ledger.hypotheses.length === 0) reasons.push('no_hypotheses_registered');
  if (open.length > 0)
    reasons.push(`open_hypotheses:${open.map((h) => h.id).join(',')}`);
  if (!ledger.verifications.some((item) => item.passed))
    reasons.push('no_passing_verification');
  if (!ledger.evidence.some((item) => item.kind === 'source'))
    reasons.push('missing_source_evidence');
  if (!ledger.evidence.some((item) => item.kind === 'policy'))
    reasons.push('missing_policy_evidence');
  if (!ledger.evidence.some((item) => item.kind === 'verification'))
    reasons.push('missing_verification_evidence');
  if (!ledger.evidence.some((item) => item.kind === 'data'))
    reasons.push('missing_data_guard_evidence');
  if (ledger.patches.length < ledger.hypotheses.length)
    reasons.push('not_enough_patch_candidates');
  return {
    closed: reasons.length === 0,
    reasons,
    openHypotheses: open.map((item) => item.id),
    verifiedHypotheses: verified.map((item) => item.id),
  };
}

export async function saveLedger(
  path: string,
  ledger: LedgerState,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(ledger, null, 2), 'utf8');
}

export async function loadLedger(path: string): Promise<LedgerState> {
  return JSON.parse(await readFile(path, 'utf8')) as LedgerState;
}
