/** Shared typed contracts for the Flue/Pi evidence remediation platform. */
export type Risk = 'low' | 'medium' | 'high';
export type HypothesisStatus =
  | 'open'
  | 'localized'
  | 'patched'
  | 'verified'
  | 'rejected'
  | 'accepted_risk';

export interface RemediationPayload {
  workspace: string;
  user: string;
  tenant: string;
  issue?: string;
}

export interface Hypothesis {
  id: string;
  title: string;
  affectedFile: string;
  affectedSymbol: string;
  evidence: string[];
  status: HypothesisStatus;
  severity: Risk;
  requiredChecks: string[];
}

export interface EvidenceNode {
  id: string;
  kind:
    | 'source'
    | 'test'
    | 'policy'
    | 'data'
    | 'agent'
    | 'verification'
    | 'impact';
  summary: string;
  location?: string;
  linkedHypotheses?: string[];
}

export interface PatchCandidate {
  id: string;
  hypothesisId: string;
  affectedFile: string;
  strategy: 'minimal_guard' | 'input_validation' | 'reject';
  status: 'proposed' | 'applied' | 'rejected';
  rationale: string;
}

export interface ImpactEdge {
  from: string;
  to: string;
  reason: string;
}

export interface PolicyInput {
  user: string;
  tenant: string;
  tool: string;
  risk: Risk;
  resource: string;
}

export interface PolicyDecision {
  allow: boolean;
  requires_approval: boolean;
  reasons: string[];
}

export interface VerificationResult {
  passed: boolean;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface DataQueryResult {
  metric: string;
  rows: Array<Record<string, unknown>>;
  piiDetected: boolean;
  redactedText: string;
  rejectedUnsafeSql: boolean;
  rejectedMutationSql: boolean;
  rejectedMultiStatementSql: boolean;
}

export interface ClosureResult {
  closed: boolean;
  reasons: string[];
  openHypotheses: string[];
  verifiedHypotheses: string[];
}

export interface RemediationResult {
  status: 'passed' | 'needs_review' | 'failed';
  agentSummary: string;
  hypotheses: Hypothesis[];
  closure: ClosureResult;
  policyDecision: PolicyDecision;
  verification: VerificationResult;
  dataQuery: DataQueryResult;
  auditLog: string;
  ledgerPath: string;
  tracePath: string;
  flueGatewayRequests: number;
}
