# Hypothesis Ledger Specification

A run ledger contains:
- `runId`
- `hypotheses[]`
- `evidence[]`
- `patches[]`
- `impactGraph[]`
- `verifications[]`

## Normative closure contract

The ledger supplies the issue-scoped record defined by `schemas/remediation-closure.schema.json`. Its only closure rule is `data.eap.closure.remediation_success`; `data.eap.closure.closed` is an alias. The combined schema and canonical policy-source contract digest is `sha256:b54388e5bf8f17ef14ca4a5facf4103c48502ae52be35f70142a9d2cf9391b00`. Candidate IDs and hypothesis IDs are interpreted within that record, and duplicate IDs fail closed.

The ledger is stored as JSON under `artifacts/demo/hypothesis-ledger.json` during E2E validation.
