# Evidence Graph Specification

Evidence nodes use these kinds:
- `source`: localization evidence.
- `policy`: OPA decision evidence.
- `agent`: patch fan-out and agent activity evidence.
- `verification`: verifier result evidence.
- `impact`: rescan and dependency impact evidence.
- `data`: SQL and PII guard evidence.

Impact edges connect affected symbols to regression tests. This prevents closure from relying only on patch application without test coverage.
