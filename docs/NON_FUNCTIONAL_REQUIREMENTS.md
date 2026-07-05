# Non-Functional Requirements

## Reliability
- NFR-001: Verification failures must keep the ledger open.
- NFR-002: Policy unavailability must fail closed.
- NFR-003: Repeated runs must use unique workspaces to avoid concurrent test races.

## Security
- NFR-004: Shell tools are not authorized by policy.
- NFR-005: Raw SQL is not available as an agent tool.
- NFR-006: PII is redacted before data is returned to the agent layer.

## Operability
- NFR-007: `npm run validate-release` must generate machine-readable validation artifacts.
- NFR-008: `npm sbom` must emit a CycloneDX SBOM for Node dependencies.
- NFR-009: Python and TypeScript quality gates must run in separate commands and write logs.

## Maintainability
- NFR-010: Types are strict TypeScript contracts.
- NFR-011: Python code is checked by ruff, mypy, bandit, and pytest coverage.
