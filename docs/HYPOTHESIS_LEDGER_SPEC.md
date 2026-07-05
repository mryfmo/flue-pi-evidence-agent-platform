# Hypothesis Ledger Specification

A run ledger contains:
- `runId`
- `hypotheses[]`
- `evidence[]`
- `patches[]`
- `impactGraph[]`
- `verifications[]`

Closure is denied when:
- no hypotheses are registered;
- any hypothesis is not verified;
- no passing verifier exists;
- source, policy, verification, or data evidence is missing;
- the patch candidate count is lower than the hypothesis count.

The ledger is stored as JSON under `artifacts/demo/hypothesis-ledger.json` during E2E validation.
