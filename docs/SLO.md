# Service Level Objectives

## Scope

Service: the remediation workflow and governed data query path on the single-host/container deployment.

These SLOs are provisional until G12 production data exists. They are expressed over existing audit, validation, and OpenTelemetry evidence so any monitor can read either JSONL artifacts or OTLP traces.

Production gateway telemetry uses only the `gateway.call` span name. Join its span record to the `llm_gateway_call` audit event by exact equality of both emitted fields, `audit_id` and `trace_id`; missing or mismatched IDs and any other span name are invalid under `schemas/telemetry-event.schema.json`. `task_id` is metadata, not the SLI join key.

## SLIs

| SLI | Evidence source | Field/query |
| --- | --- | --- |
| Workflow success rate | `artifacts/validation/final_verification_report.json`, audit JSONL | validation `status=passed`; remediation `run_end.status=passed` |
| Closure rate | `artifacts/demo/hypothesis-ledger.json`, audit JSONL | closure `closed=true`, no `openHypotheses` |
| Gateway latency p95 | Correlated `gateway.call` spans in `artifacts/telemetry/traces.jsonl` or OTLP | join audit/span on equal `audit_id` and `trace_id`; read `attributes.gateway.latency_ms` |
| LLM cost per run | Correlated `llm_gateway_call` audit events | sum `estimated_cost` after the same `audit_id` + `trace_id` join |
| Delegation total cost | Correlated `llm_gateway_call` audit events | sum gateway `estimated_cost`; Claude Code-side model cost is out of scope until exported by the orchestrator |
| Heldout non-regression | validation report | `vitest_all`, `python_tests`, `llm_contract`, and E2E artifact gates passed |
| Gate suite status on main | validation report | top-level `status=passed` and every gate `status=passed` |
| Audit finding age | validation report timestamps | `npm_audit_prod` and `python_audit` last passed time |

## SLOs

| SLO | Target | Window | Notes |
| --- | --- | --- | --- |
| Workflow success | >= 99% | 30 days | Count deterministic validation and production workflow runs. |
| Closure | >= 99% | 30 days | Runs with localized hypotheses must close or return the `needs_review` outcome defined by `schemas/run-outcome.schema.json`. |
| Gateway latency | p95 <= 2,000 ms | 30 days | Measured from `gateway.latency_ms`; deterministic local fallback excluded from provider SLO review. |
| LLM cost per run | TBD | 30 days | Provisional until production volume exists; compute from correlated `llm_gateway_call` events grouped by `audit_id` and `trace_id`. |
| Delegation total cost | TBD | 30 days | For Phase 8, includes gateway event cost only. Claude Code-side orchestration cost is explicitly unmeasured and must not be inferred. |
| Heldout non-regression | always green | every main build | Any heldout regression blocks release. |
| Gate suite on main | always green | every main build | `npm run validate-release` final report must pass. |
| Audit posture | no high findings older than 24h | rolling | Applies to `npm_audit_prod` and `python_audit` gates. |

## Alert Conditions

| Condition | Severity | Response |
| --- | --- | --- |
| Final verification report missing or `status!=passed` on main | page | `docs/RUNBOOK.md#gate-failure-handling` |
| Heldout or closure gate fails | page | `docs/RUNBOOK.md#gate-failure-handling` |
| Workflow success below 99% over 30d | ticket | Inspect audit `run_end`, ledger closure, and recent release diffs. |
| `gateway.latency_ms` p95 exceeds 2,000 ms for 30m | ticket | Check provider route, fallback index, and `docs/PRODUCTION_GATEWAY_DESIGN.md`. |
| OTLP export warning present but JSONL traces continue | ticket | Check collector reachability; workflow remains healthy if JSONL exists. |
| Missing `artifacts/telemetry/traces.jsonl` after a run | page | `docs/OPERATIONS.md#incident-triage` |
| `npm_audit_prod` or `python_audit` failing > 24h | page | Block release and update dependencies or advisories. |
| OPA bundle manifest lacks `revision` | page | Rebuild with `scripts/opa-bundle.mjs` and verify `ops-check`. |

## Review Cadence

Review thresholds after 30 days of G12 production traffic. Tighten or relax only with measured run volume, incident history, and documented release-risk acceptance.
