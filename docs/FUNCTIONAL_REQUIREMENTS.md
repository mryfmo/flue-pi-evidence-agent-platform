# Functional Requirements

| ID | Requirement | Implementation | Validation |
| --- | --- | --- | --- |
| FR-001 | Accept a remediation payload with workspace, user, tenant, and issue. | `src/workflows/remediate.ts` | `tests/e2e/remediate_e2e.test.ts` |
| FR-002 | Prepare an isolated run workspace copy instead of editing the source fixture. | `prepareWorkspace()` | `tests/component/code.test.ts` |
| FR-003 | Localize zero-divisor and invalid integer parsing hypotheses. | `scanWorkspace()` | `tests/component/code.test.ts` |
| FR-004 | Generate more than one patch candidate per hypothesis. | `proposePatchCandidates()` | `tests/component/code.test.ts` |
| FR-005 | Apply only selected minimal candidates and leave alternatives recorded. | `applySelectedPatches()` + ledger | `tests/component/code.test.ts`, E2E |
| FR-006 | Run pytest verification after patching. | `verifyWorkspace()` | `tests/component/code.test.ts`, E2E |
| FR-007 | Rescan after verification and refuse closure if issues remain. | `closureGate()` | `tests/regression/regression_closure.test.ts` |
| FR-008 | Route patch authorization through real OPA/Rego. | `evaluatePolicy()` + `policy/agent.rego` | `tests/component/opa.test.ts` |
| FR-009 | Fail closed if OPA is unavailable. | `evaluatePolicy()` catch path | `tests/component/opa.test.ts` |
| FR-010 | Execute aggregate data query through SQLGlot/DuckDB/Presidio. | `scripts/data_guard.py` | `tests/component/data_proxy.test.ts`, `tests_py/test_data_guard.py` |
| FR-011 | Emit OpenTelemetry spans to a JSONL trace artifact. | `src/lib/telemetry.ts` | E2E validation artifact |
| FR-012 | Exercise Flue/Pi runtime path with a deterministic OpenAI-compatible gateway. | `src/lib/localGateway.ts`, agent profile | `tests/system/flue_pi.test.ts`, E2E |
