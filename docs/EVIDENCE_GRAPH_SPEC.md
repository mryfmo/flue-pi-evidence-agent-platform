# Evidence Graph Specification

Evidence nodes use these kinds:
- `source`: localization evidence.
- `policy`: OPA decision evidence.
- `agent`: patch fan-out and agent activity evidence.
- `verification`: verifier result evidence.
- `impact`: rescan and dependency impact evidence.
- `data`: SQL and PII guard evidence.

Impact edges connect affected symbols to regression tests. This prevents closure from relying only on patch application without test coverage.

## Normative closure contract

Evidence used for closure is carried by the single issue-scoped record defined in `schemas/remediation-closure.schema.json`. The graph does not define a second closure formula: only `data.eap.closure.remediation_success` decides success, and `data.eap.closure.closed` is its alias. The combined schema and canonical policy-source contract digest is `sha256:b54388e5bf8f17ef14ca4a5facf4103c48502ae52be35f70142a9d2cf9391b00`.
