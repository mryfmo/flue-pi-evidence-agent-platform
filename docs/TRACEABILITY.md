# Traceability

| Requirement | Implementation | Validation |
|---|---|---|
| REQ-FLUE-001 | `flue.config.ts`, `src/workflows/*.ts` | `npm run flue:build` |
| REQ-PI-001 | `src/lib/localGateway.ts`, Flue model `local-gateway/fixbot` | `npm run flue:smoke`, `npm run flue:e2e` |
| REQ-OPA-001 | `policy/agent.rego`, `src/lib/opa.ts` | `npm run opa:check`, `tests/component/opa.test.ts` |
| REQ-EVIDENCE-001 | `src/lib/code.ts`, `src/workflows/remediate.ts` | `tests/component/code.test.ts`, `npm run flue:e2e` |
| REQ-DATA-001 | `scripts/data_guard.py`, `src/lib/dataProxy.ts` | `tests/component/data_proxy.test.ts`, `npm run flue:e2e` |
| REQ-OBS-001 | `src/app.ts` | `npm run flue:build` |
| REQ-VALIDATION-001 | `scripts/validate-release.mjs` | `npm run validate-release` |
