# Traceability Matrix

| Requirement | Design | Implementation | Validation evidence |
| --- | --- | --- | --- |
| PR-001 / FR-012 | Agent loop and runtime flow | `src/agents/remediator.ts`, `src/lib/localGateway.ts` | `tests/system/flue_pi.test.ts`, E2E |
| PR-002 / FR-003 | Hypothesis ledger spec | `src/lib/ledger.ts`, `src/lib/code.ts` | `tests/unit/ledger.test.ts`, `tests/component/code.test.ts` |
| PR-003 / FR-008 | Policy model | `src/lib/opa.ts`, `policy/agent.rego` | `tests/component/opa.test.ts` |
| PR-004 / FR-007 | Closure gate | `src/lib/ledger.ts` | `tests/regression/regression_closure.test.ts` |
| PR-005 / FR-010 | Data governance | `scripts/data_guard.py`, `src/lib/dataProxy.ts` | `tests/component/data_proxy.test.ts`, `tests_py/test_data_guard.py` |
| PR-006 | Data governance | `scripts/data_guard.py` | Python and TS data proxy tests |
| PR-007 / FR-011 | Observability | `src/lib/telemetry.ts`, `src/lib/audit.ts` | E2E artifact logs |
| PR-008 | Validation plan | `scripts/validate-release.mjs` | final verification report |
