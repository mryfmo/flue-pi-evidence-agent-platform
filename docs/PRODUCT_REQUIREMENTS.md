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
This package is a single-host OSS-integrated implementation by default. Docker-based validation and GitHub Actions CI are in scope, and the production LLM gateway exists behind typed contracts with environment-injected provider keys. It does not claim Kubernetes, external OpenMetadata, external Trino, or production secret-manager deployment; those remain extension targets behind the same typed tool contracts.

## Reference Implementation (Phase 8)

The Phase 8 reference implementation uses Claude Code as the interactive
orchestrator and acceptance UI. The platform boundary remains
orchestrator-independent: governed decisions are still made by deterministic
scripts, policy, audit, validation, and gateway checks, not by Claude Code prose.

The production LLM path that satisfies the production gateway requirement is
the composite path:

```text
Platform Gateway
  redaction, data classification, fail-closed policy, audit metadata
  -> LiteLLM Proxy
       approved alias resolution, fallback, provider cost metadata
       -> Anthropic approved models
```

The approved aliases are implemented in `config/litellm/config.yaml`:
`worker-fast`, `worker-main`, and `worker-heavy`. Production routing uses
`policy/routing.prod.json`, where governed routes target the `litellm`
provider and environment-injected `LITELLM_BASE_URL` /
`LITELLM_VIRTUAL_KEY` credentials.

Phase 8 closes the previous open implementation questions as follows:

- Production LLM selection is decided as Anthropic models behind LiteLLM Proxy
  approved aliases.
- The tool allow-list boundary includes Claude Code hooks registered in
  `.claude/settings.json` and enforced by `policy/cc_guard.rego`; the policy is
  part of the governed `policy/` control zone.
- Orchestrator actions use `scripts/orchestrator/delegate.mjs`,
  `status.mjs`, `accept.mjs`, `platform-health.mjs`, and
  `scripts/audit-trace.mjs`; free-form chat is not an acceptance ledger.

Related documents:

- `docs/INTEGRATION_BOUNDARY.md`
- `docs/LITELLM_PROXY.md`
- `docs/ORCHESTRATOR_INTERFACE.md`
- `docs/PRODUCTION_GATEWAY_DESIGN.md`
