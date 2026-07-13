# Functional Requirements

The Requirement column states normative capabilities. The Implementation column is a non-normative current design inventory and does not make any tool, library, gateway, provider, or dependency identity part of conformance.

| ID | Requirement | Implementation | Validation |
| --- | --- | --- | --- |
| FR-001 | Accept a closed versioned remediation payload containing workspace and optional issue, and obtain user and tenant only from the gateway/PEP-owned verified identity context. | `schemas/remediation-request.schema.json`, `src/app.ts`, `src/workflows/remediate.ts` | `tests/component/request_contract.test.ts` |
| FR-002 | Prepare an isolated run workspace copy instead of editing the source fixture. | `prepareWorkspace()` | `tests/component/code.test.ts` |
| FR-003 | Localize zero-divisor, invalid integer parsing, and unguarded dictionary key-access hypotheses. | `scanWorkspace()` | `tests/component/code.test.ts` |
| FR-004 | Generate more than one patch candidate per hypothesis. | `proposePatchCandidates()` | `tests/component/code.test.ts` |
| FR-005 | Apply only selected minimal candidates and leave alternatives recorded. | `applySelectedPatches()` + ledger | `tests/component/code.test.ts`, E2E |
| FR-006 | Run pytest verification after patching. | `verifyWorkspace()` | `tests/component/code.test.ts`, E2E |
| FR-007 | Rescan after verification and refuse closure if issues remain. | `closureGate()` | `tests/regression/regression_closure.test.ts` |
| FR-008 | Route patch authorization through real OPA/Rego. | `evaluatePolicy()` + `policy/agent.rego` | `tests/component/opa.test.ts` |
| FR-009 | Fail closed if OPA is unavailable. | `evaluatePolicy()` catch path | `tests/component/opa.test.ts` |
| FR-010 | Return aggregate-only governed data without raw PII; reject unsafe or unauthorized requests and fail closed when controls cannot be verified. | `scripts/data_guard.py` | `data_behavior`, `data_negative`, `data_fail_closed` |
| FR-011 | Emit OpenTelemetry spans to a JSONL trace artifact. | `src/lib/telemetry.ts` | E2E validation artifact |
| FR-012 | Provide governed agent execution behavior; reject unauthorized or invalid execution and fail closed when capability evidence cannot be verified. | `src/lib/localGateway.ts`, agent profile | `pi_behavior`, `pi_negative`, `pi_fail_closed` |
| FR-013 | Decide remediation closure from one schema-bound, issue-scoped, fail-closed predicate. | `data.eap.closure.remediation_success` | `policy/tests/closure_test.rego`, `tests/fixtures/policy/closure_*.json` |
