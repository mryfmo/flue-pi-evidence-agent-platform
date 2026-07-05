# Threat Model

| Threat | Control | Test |
| --- | --- | --- |
| Unauthorized user requests patching | OPA denies guest | `tests/component/opa.test.ts` |
| Cross-tenant access | OPA denies tenant mismatch | `tests/security/policy_security.test.ts` |
| Shell command execution | OPA denies shell tool | `tests/failure/failure_security.test.ts` |
| Raw PII SQL | SQLGlot guard rejects PII columns | `tests/component/data_proxy.test.ts` |
| Mutation SQL | SQLGlot guard rejects non-SELECT | `tests_py/test_data_guard.py` |
| Multi-statement SQL | SQLGlot guard rejects more than one expression | `tests_py/test_data_guard.py` |
| OPA outage | Adapter returns fail-closed decision | `tests/component/opa.test.ts` |
| Partial remediation | Closure gate requires verified hypotheses | `tests/unit/ledger.test.ts` |
