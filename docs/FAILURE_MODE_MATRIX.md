# Failure Mode Matrix

| Failure | Expected outcome | Evidence |
| --- | --- | --- |
| OPA missing | Fail closed, no patch | policy test |
| High risk action | requires approval | failure test |
| Guest user | deny | OPA test |
| Shell tool | deny | failure test |
| Raw SQL | deny | data proxy test |
| Mutation SQL | deny | data proxy + Python tests |
| Multi-statement SQL | deny | data proxy + Python tests |
| Unpatched workspace | verifier fails | component code test |
| Missing evidence | closure denied | ledger unit test |
| litellm_proxy_down | Gateway detects localhost/proxy refusal; returns `llm_unavailable`; no deterministic local success | `tests/failure/llm_outage.test.ts`; operate via RUNBOOK `llm_unavailable` steps |
| anthropic_unreachable | LiteLLM-approved model chain exhausts; returns `llm_unavailable` with `routing_decision` | `tests/failure/llm_outage.test.ts`; check LiteLLM upstreams, then re-delegate |
| agmsg_write_failure | Delegate exits non-zero with `task_not_delegated`; no lease/event partial ledger | `tests/unit/orchestrator_fail_closed.test.ts`; repair agmsg DB/path before retry |
| result_missing | Status renderer reports `state: unknown`; no substitute execution advice | `tests/unit/orchestrator_fail_closed.test.ts`; wait, ping worker, or re-delegate explicitly |
| audit_sink_write_failure | Run outcome is `failed` with `failure.code=audit_sink_failure`; no external result, patch, acceptance, or success is returned | `schemas/run-outcome.schema.json`; `tests/fixtures/policy/production_contract_outcome_audit_failure_valid.json` |
| telemetry_emission_failure | Run outcome is `failed` with `failure.code=telemetry_emission_failure`; missing telemetry is not success | `schemas/run-outcome.schema.json`; `tests/fixtures/policy/production_contract_outcome_telemetry_failure_valid.json` |
| sandbox_lifecycle_failure | Run outcome is `failed` with `failure.code=sandbox_lifecycle_failure`; no local fallback or success is returned | `schemas/run-outcome.schema.json`; `tests/fixtures/policy/production_contract_outcome_sandbox_lifecycle_failure_valid.json` |
| sandbox_evidence_failure | Run outcome is `failed` with `failure.code=sandbox_evidence_failure`; unverifiable sandbox output cannot satisfy remediation or release evidence | `schemas/run-outcome.schema.json`; `tests/fixtures/policy/production_contract_outcome_sandbox_evidence_failure_valid.json` |
