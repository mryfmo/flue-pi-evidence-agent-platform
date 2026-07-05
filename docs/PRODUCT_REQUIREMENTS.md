# Product Requirements

## Purpose
The platform is a Flue + Pi evidence-driven remediation system for controlled code repair and governed customer-data analysis. It must not present an agent transcript as proof of completion. It must complete only when evidence, policy, verification, data guard, and audit gates all pass.

## Users
- Platform engineer: operates release gates and reviews audit outputs.
- Software engineer: submits a code issue for evidence-driven remediation.
- Data analyst: requests aggregate-only governed metrics.
- Security reviewer: reviews OPA decisions, traces, and failure cases.

## Non-negotiable outcomes
- PR-001: Flue runtime and Pi provider path are used in the execution path.
- PR-002: Every remediation run creates a hypothesis ledger and evidence graph.
- PR-003: No patch is applied until OPA authorizes the tool request.
- PR-004: A run does not close while unresolved hypotheses remain.
- PR-005: Data analysis must use SQLGlot, DuckDB, and Presidio gates.
- PR-006: Unsafe SQL, raw PII projection, mutation SQL, and multi-statement SQL are rejected.
- PR-007: OpenTelemetry spans and JSONL audit records are emitted.
- PR-008: Release creation is blocked unless format, lint, typecheck, tests, policy, data guard, Flue build, E2E, audit, and SBOM gates pass.

## Out of scope for this package
This package is a single-host OSS-integrated implementation. It does not claim Kubernetes, external OpenMetadata, external Trino, external LiteLLM, or production secret-manager deployment. Those are extension targets behind the same typed tool contracts.
