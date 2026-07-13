# P9-T01 Validation Evidence

- evidence revision: **rev2**

## Context

- repository: `/Users/mryfmo/Workspace/flue_pi_ai_agent`
- revision: `2c6fdb0`
- validation copy: `/tmp/flue-p9-t01-validate-20260710-182608`
- product worktree remained unchanged; only task/worklog and required P9 artifacts are untracked.

## Static evidence

### Actual gate set and stale saved report

Command:

```text
node -e '<extract top-level command names from scripts/validate-release.mjs>'
```

Output:

```text
25 setup_python,spec_traceability,format,lint,typecheck,opa,litellm_config,python_compile,python_ruff,python_mypy,python_bandit,python_tests,vitest_all,skill_lifecycle_node,llm_contract,flue_build,e2e_artifacts,npm_audit_prod,npm_sbom_prod,python_sbom,python_audit,lockfile_registry,opa_test,opa_bundle,skill_registry
saved 2026-07-07T08:54:13.521Z 24 ... (litellm_config absent)
```

### Production gateway reachability

Command:

```text
rg -n "callProductionGateway|startLocalGateway|PI_PROVIDER" src scripts tests
```

Result: `callProductionGateway` callers are only `tests/contract/llm_contract.test.ts` and `tests/failure/llm_outage.test.ts`; `src/workflows/remediate.ts:46` always calls `startLocalGateway`, and `src/agents/remediator.ts:34` fixes `local-gateway/fixbot`.

### Duplicate hypothesis IDs

Command: Node 22 type-stripping run against two temp Python files containing the same divide defect.

Output:

```json
{"scanned":["HYP-DIVIDE-ZERO-001","HYP-DIVIDE-ZERO-001"],"ledger":["HYP-DIVIDE-ZERO-001","HYP-DIVIDE-ZERO-001"]}
```

### Closure ignores impact/rescan requirements

Command: construct one ledger with requiredChecks=`pytest,rescan`, no impactGraph, a passing pytest verification, and the four evidence kinds currently checked.

Output:

```json
{"impactGraph":[],"requiredChecks":["pytest","rescan"],"closure":{"closed":true,"reasons":[],"openHypotheses":[],"verifiedHypotheses":["H1"]}}
```

### Controlled directory root bypass

Command:

```text
decideGuard({tool_name:"Bash",tool_input:{command:"rm -rf policy"}})
```

Output:

```json
{"allow":true,"denyReasons":[],"input":{"paths":["policy"],"command":"rm -rf policy","active_leases":[]}}
```

The guard only parsed this string; no destructive command was executed.

## Executed checks

All checks below ran from the `/tmp` HEAD snapshot so tracked product artifacts were not modified.

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm run format:check` | exit 0; 59 files checked, no fixes |
| `npm run lint` | exit 0; 59 files checked |
| `node scripts/spec-check.mjs` | exit 0; `spec-check:passed` |
| `node scripts/check-litellm-config.mjs` | exit 0; `litellm_config:passed` |
| targeted Vitest: ledger, code, data proxy, OPA, routing, local sandbox, security, regression | exit 0; 8 files / 24 tests passed |
| `pytest tests_py --cov=scripts --cov-fail-under=85` | exit 0; 29 passed; 90% coverage |
| `ruff check scripts tests_py` | exit 0 |
| `mypy scripts/data_guard.py` | exit 0 |
| `bandit -q -r scripts` | exit 0 |
| `npm audit --audit-level=high --omit=dev` | exit 0; 0 vulnerabilities |
| `pip-audit --local` | exit 0; no known vulnerabilities |

## Full Vitest attempt

Command:

```text
npm test
```

Observed:

- `tests/e2e/remediate_e2e.test.ts` failed because the workspace-write sandbox denied `listen 127.0.0.1` with `EPERM`.
- `tests/failure/llm_outage.test.ts` hanging-proxy case reached its 90 second test timeout instead of completing; the suite then retained open handles, so it was interrupted after evidence capture (exit 130).
- This run does not establish a product regression for localhost bind, but it confirms the documented worker-sandbox verification gap and that the outage test is not bounded to the gateway's intended 2-second timeout in this environment.

## Why `npm run validate-release` was not run in the product worktree

`scripts/validate-release.mjs:4-7` recursively deletes and rewrites tracked `artifacts/validation/`, while `setup_python` upgrades/install packages into `.venv`. That conflicts with the task's report-only allowed-file boundary. The non-destructive constituent checks above were run from an isolated `/tmp` snapshot instead. Image build, live keys, and live LLM calls were forbidden and not performed.

## Worktree check

Final product worktree status before artifact creation contained only:

```text
?? .agents/worklog/codex/plan/20260710_182608_plan.md
?? .agents/worklog/codex/todo/20260710_182608_todo.md
?? .orchestration/tasks/P9-T01.md
```

No `src/`, `scripts/`, `tests/`, `docs/`, `policy/`, dependency, or tracked `artifacts/` changes were made.

## Rev2 acceptance evidence (R1-R8)

### R1 outbound PERSON coverage

`scripts/data_guard.py:121-144` configures email/US phone/card/IP/URL built-ins but PERSON only as `regex=r"\bAlice\s+Tanaka\b"`; `src/lib/productionGateway.ts:241-246` applies this function directly before dispatch. No general PERSON recognizer or confidential-data deny-on-uncertainty path exists.

### R2 OPA-unavailable guard downgrade

Command:

```text
EAP_OPA_BINARY=/definitely/missing/opa node -e '<decideGuard harmless Bash input>'
```

Output:

```json
{"allow":true,"denyReasons":[],"input":{"paths":[],"command":"echo ok","active_leases":[]}}
```

`pretooluse-guard.mjs:168-170` returns `null` on every OPA exception and lines 21-22 select builtin heuristics instead of a deny decision.

### R3-R6 implementation/test reads

- R3: `sandboxOpenSandbox.ts:216-227` supplies `tenant: EAP_SANDBOX_TENANT ?? 'acme'` rather than requiring request tenant.
- R4: `productionGateway.ts:256-298` returns `ok:true` with content `deterministic-fallback` and records a success span/audit.
- R5: `audit.ts:5-15` is a direct JSONL `appendFile`; no sequence/hash/signature/durability/integrity verifier exists.
- R6: `opensandbox.test.ts:138-156` asserts only `exitCode !== 0` after an external URL request; it does not distinguish policy deny from DNS/TLS/remote failure.

### R7 production switches absent from operator docs

Command:

```text
rg -n 'PI_PROVIDER=prod|EAP_SANDBOX_RUNTIME=opensandbox' docs/DEPLOYMENT.md docs/OPERATIONS.md docs/RUNBOOK.md docs/SECRETS_MANAGEMENT.md docs/PRODUCTION_GATEWAY_DESIGN.md docs/SANDBOX_INTEGRATION_DESIGN.md
```

Result: matches exist only in `PRODUCTION_GATEWAY_DESIGN.md:54` and `SANDBOX_INTEGRATION_DESIGN.md:42/143`; zero matches in the four operator documents.

### R8 documentation contract drift

- `SLO.md:15` uses `attributes.gateway.latency_ms`, while lines 28/42 use `gateway.latency_ms` without an authoritative query/schema.
- `FAILURE_MODE_MATRIX.md:3-17` omits sandbox, redaction, telemetry-loss, and ledger-corruption failures; both LLM rows cite the same test file without distinct evidence IDs.
- `NON_FUNCTIONAL_REQUIREMENTS.md:3-20` has no latency/availability/RTO/RPO requirements and is absent from machine traceability JSON.
- `DEPLOYMENT.md:13` requires bundled Node invocation, but `RUNBOOK.md:46` uses bare `node`.

### GAP-021 severity decision

Upgraded from P1 to **P0**. `PRODUCT_REQUIREMENTS.md:3-4` defines controlled code repair as a product purpose; `code.ts:61-166,213-288` can only recognize three regex forms and patch exact fixture function bodies, while the request `issue` field is unused. Therefore successful LLM/Sandbox integration would still leave the primary user workflow unable to repair non-fixture code.
