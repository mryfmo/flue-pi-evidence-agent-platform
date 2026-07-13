# PHASE-A0-R1 Deviation Request

status: blocked
acceptance_tier: none
requested_action: orchestrator-scope-revision

## Exact blocker evidence

The required compatibility command fails closed:

```text
COMMAND: ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-01,SPEC-20
EXIT: 1
Error: SPEC-20 complete fixture is stale: expected 8d7d97418dc001d9decc8b7b80541e2b5e1cf1776953a89664377d9be233fb15 sha256:8d7d97418dc001d9decc8b7b80541e2b5e1cf1776953a89664377d9be233fb15
```

The signed fixture and external test trust still bind this older source ID:

```text
signed fixture source revision: 5383d2b325478d91509be8dce73877bad6504692064921a7b0a5028f9547cfd9
pre-PHASE-A0-R1 repository source revision: 67c664c3619466329f08dcec005381622d340d846d50502ed8a416074b064654
current repository source revision: 8d7d97418dc001d9decc8b7b80541e2b5e1cf1776953a89664377d9be233fb15
current scripts/spec-check.mjs SHA-256: 39b3ea3fb7c7039da27aa4d1e58808a8d0453c7dc8f0d131637bb16c887a05b8
```

The pre-repair value was recomputed in memory by removing only the PHASE-A0-R1 additions from the source bytes. It proves the A0-08 vector was already stale before this repair.

## Bound source-manifest membership

`.orchestration/validation/A0-08.source-manifest.json` has contract `spec20-capability-source-manifest-v1` and exactly 22 sorted paths. `scripts/spec-check.mjs` is member 16, so changing this checker correctly invalidates the old signed vector. The membership itself must remain exact; it must not be edited to remove the checker.

```text
01 docs/DATA_GOVERNANCE.md
02 docs/FUNCTIONAL_REQUIREMENTS.md
03 docs/PRODUCT_REQUIREMENTS.md
04 docs/requirements.json
05 docs/traceability.json
06 package-lock.json
07 package.json
08 policy/agent.rego
09 policy/conformance.rego
10 policy/tenants.json
11 policy/tests/agent_test.rego
12 pyproject.toml
13 requirements.txt
14 scripts/data_guard.py
15 scripts/setup-python.mjs
16 scripts/spec-check.mjs  <-- changed bound member
17 src/lib/opa.ts
18 src/lib/types.ts
19 tests_py/test_data_guard.py
20 tsconfig.json
21 uv.lock
22 vitest.config.ts
```

## Required regeneration paths

After all 22 source members are stable, a fresh controlled SPEC-20 run must rerun the six actual capability commands, generate new machine artifacts, hash their exact bytes, create a new temporary test-vector key, sign all six complete attestation tuples, update the exact trust catalog and bundle, update the in-policy test vector, independently verify them, and delete the private key.

The narrow write extension must include:

- `tests/fixtures/policy/spec20_complete.json`
- `policy/tests/conformance_test.rego`
- `.orchestration/validation/A0-08.test-trust.json`
- `.orchestration/validation/A0-08.artifacts/pi_behavior.json`
- `.orchestration/validation/A0-08.artifacts/pi_negative.json`
- `.orchestration/validation/A0-08.artifacts/pi_fail_closed.json`
- `.orchestration/validation/A0-08.artifacts/data_behavior.json`
- `.orchestration/validation/A0-08.artifacts/data_negative.json`
- `.orchestration/validation/A0-08.artifacts/data_fail_closed.json`
- new task-scoped report, validation, sandbox, learning, and AutoSkill evidence paths

`.orchestration/validation/A0-08.source-manifest.json` is required as a read/validation input; its exact membership must remain unchanged unless a separately reviewed capability-source inventory change is justified. `tests/fixtures/policy/spec20_missing_conformance.json` does not contain the accepted signed source vector and does not require mechanical refresh.

Because `policy/tests/conformance_test.rego` is controlled `policy/` content, the scope-revision task must use the governed delegation path. It must not edit A0-08 acceptance or weaken `scripts/spec-check.mjs` current-source comparison.

## Proposed narrow scope extension and exit conditions

1. Authorize only the regeneration paths above plus task-scoped evidence.
2. Preserve the exact 22-path source manifest and all accepted A0-08 fail-closed mutations.
3. Use a fresh run ID and fresh test-only key; never commit or retain its private key.
4. Rerun all six capability commands after every bound source file is stable.
5. Re-hash artifacts, verify RS256 signatures/payload-body equality, exact six-row catalog, sorted attestation set, and bundle digest independently.
6. Require `--check-spec SPEC-01,SPEC-20`, the 166-test OPA suite, PHASE-A0-R1 unit tests, register gate, typecheck, lint, private-key scan, and `git diff --check` to exit zero.

No source-binding bypass or digest exception is requested.
