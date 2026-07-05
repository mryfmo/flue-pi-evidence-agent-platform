# Security Model

## Trust boundary

This implementation is a single-host, release-gated system. It is not a public multi-tenant hosted service by default. The security model prevents the validated workflow from treating an LLM response as execution authority.

## Control points

1. Route/workflow payloads carry user and tenant information.
2. OPA/Rego is the authority for side-effecting tool authorization.
3. The Flue/Pi agent exposes only a non-side-effecting explanation tool.
4. Patch application is performed by typed workflow code after OPA authorization.
5. SQL is parsed and classified before execution.
6. PII is redacted before data evidence is returned to the agent layer.
7. Verification and rescanning must pass before closure.
8. Audit and OpenTelemetry evidence are emitted for release inspection.

## Policy guarantees validated in this release

- Guest user cannot apply patches.
- Cross-tenant requests are denied.
- Shell tools are denied.
- Unknown tools are denied.
- Raw SQL tools are denied.
- High-risk actions require review rather than automatic execution.
- OPA adapter fail path returns `allow=false` and `requires_approval=true`.

## Data protections validated in this release

- SQLGlot parses exactly one SELECT statement.
- Mutation, DDL/control, multi-statement SQL, and direct PII column projection are rejected.
- DuckDB executes only an accepted aggregate metric query.
- Presidio detects and anonymizes deterministic PII examples.

## Residual risks and extension rules

- The deterministic local gateway is for reproducible validation. A production LLM gateway must preserve audit IDs, redaction hooks, and policy boundaries.
- Adding new side-effecting tools requires Rego policy entries, typed contracts, tests, and traceability updates.
- Adding external model access requires threat-model and data-classification review.
