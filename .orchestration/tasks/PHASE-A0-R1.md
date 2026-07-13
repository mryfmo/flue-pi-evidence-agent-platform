# Task PHASE-A0-R1: Repair the Phase A0 SPEC-register gate

## 1. Role and model

Use `gpt-5.6-sol` with reasoning effort `high`. You are the implementation worker, not the orchestrator. This is a narrow repair of a mandatory phase-exit gate that currently rejects the plan-prescribed command.

## 2. Objective

Make the exact Phase A0 command below perform a real, fail-closed validation and exit zero only when the canonical `SPEC-01` through `SPEC-20` register is complete, unique, and traceable:

```bash
./node_modules/node/bin/node scripts/spec-check.mjs --check-spec-register SPEC-01..SPEC-20
```

Do not weaken or replace any existing `spec-check` behavior.

## 3. Preconditions and constraints

- All A0 acceptances must exist and be accepted before editing.
- Preserve the accepted A0-01 through A0-09 contracts and the existing `--check-spec`, `--check-decision`, and `--check-request-schema` interfaces.
- Use native JavaScript and existing dependencies only.
- Add focused executable regression coverage. Do not satisfy the task with marker searches or a no-op alias.
- Do not edit product runtime, policy, decisions, acceptances, audit artifacts, dependencies, or the production work plan.

## 4. Allowed files

- `scripts/spec-check.mjs`
- `tests/unit/spec_check.test.mjs`
- `.orchestration/reports/PHASE-A0-R1*`
- `.orchestration/validation/PHASE-A0-R1*`
- `.orchestration/sandboxes/PHASE-A0-R1*`
- `.orchestration/learning/PHASE-A0-R1*`
- `.orchestration/autoskill/runs/PHASE-A0-R1*`
- `.agents/worklog/**`

## 5. Required behavior

1. Accept both `--check-spec-register SPEC-01..SPEC-20` and `--check-spec-register=SPEC-01..SPEC-20`.
2. Interpret the range as inclusive canonical zero-padded SPEC IDs. Reject missing values, malformed endpoints, reversed ranges, mixed prefixes, noncanonical padding, out-of-register endpoints, trailing input, and unknown flags.
3. For the requested complete range, prove `docs/requirements.json` has exactly one canonical requirement record for every requested ID and no duplicate ID can be hidden by `Set` normalization.
4. Prove `docs/traceability.json` has exactly one canonical link for every requested ID; reject missing or duplicate links and keep the existing referenced-file existence checks.
5. Prove the canonical register contains exactly `SPEC-01` through `SPEC-20` for this full-register command: extra `SPEC-*`, missing IDs, malformed SPEC-like IDs, and duplicates must fail.
6. Keep ordinary no-argument and existing flag behavior green. Mixed mutually exclusive modes must fail rather than silently ignoring one.
7. Error messages must identify the invalid register/range condition without leaking file contents.

## 6. Tests

Write a focused Node test that runs the real CLI against isolated temporary repository fixtures or another deterministic mechanism. It must include positive exact/equal-sign forms and negative missing, malformed, reversed, noncanonical, out-of-range, duplicate-requirement, duplicate-trace-link, missing-ID, and extra-SPEC cases. Tests must demonstrate nonzero exits, not only parser-unit assertions.

## 7. Verification

Capture output and exit codes for:

```bash
./node_modules/node/bin/node --test tests/unit/spec_check.test.mjs
./node_modules/node/bin/node scripts/spec-check.mjs --check-spec-register SPEC-01..SPEC-20
./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-01,SPEC-20
./node_modules/node/bin/node scripts/spec-check.mjs
npm run typecheck
npm run lint
git diff --check
```

Also run at least one invalid range and prove nonzero.

## 8. Evidence and result

Write all five evidence files and send exactly one terminal record:

```text
AGMSG-RESULT v1 task_id=PHASE-A0-R1 status=ready_for_review acceptance_tier=review report=.orchestration/reports/PHASE-A0-R1.report.md validation=.orchestration/validation/PHASE-A0-R1.validation.log sandbox=.orchestration/sandboxes/PHASE-A0-R1.sandbox.md learning=.orchestration/learning/PHASE-A0-R1.learning.md autoskill=.orchestration/autoskill/runs/PHASE-A0-R1.autoskill.md
```

## 9. Revision 1 — semantic expansion and SPEC-20 current-source refresh

The initial result is blocked and may resume only under accepted plan revision `PHASE-A0-R1-v1`.

- Full-register mode must run the existing per-SPEC semantic validators for every expanded ID in addition to exact uniqueness/bijection checks. Add an executable test proving a stale semantic fixture fails register mode; parser/ID checks alone are insufficient.
- Preserve `.orchestration/validation/A0-08.source-manifest.json` as read-only with its exact 22 paths. Never remove `scripts/spec-check.mjs` from source binding.
- Additional allowed regeneration files are exactly:
  - `tests/fixtures/policy/spec20_complete.json`
  - `policy/tests/conformance_test.rego`
  - `.orchestration/validation/A0-08.test-trust.json`
  - `.orchestration/validation/A0-08.artifacts/pi_behavior.json`
  - `.orchestration/validation/A0-08.artifacts/pi_negative.json`
  - `.orchestration/validation/A0-08.artifacts/pi_fail_closed.json`
  - `.orchestration/validation/A0-08.artifacts/data_behavior.json`
  - `.orchestration/validation/A0-08.artifacts/data_negative.json`
  - `.orchestration/validation/A0-08.artifacts/data_fail_closed.json`
- After every bound source byte is stable, rerun all six actual capability commands and create a fresh run ID. Generate a fresh temporary test-only RSA key, bind exact source/run/artifact/requirement/test/outcome/provenance tuples, update the six JWTs, exact trust catalog, sorted attestation set, and bundle digest, then delete the private key.
- Independently verify source digest, exact artifact bytes/digests, RS256 signatures, payload/body equality, exact six-row catalog, run/source equality, sorted attestation set, and bundle digest. Prove a source mutation and artifact mutation deny.
- Do not claim CI/KMS/production provenance; this remains an explicitly local test vector. Do not edit A0-08 acceptance, decisions, conformance policy rules, or source manifest.
- Rerun every section 7 command plus full register semantic validation, `--check-spec SPEC-01,SPEC-20`, OPA 166/166, private-key scan, and all A0-08 mutation checks. Replace the blocked report with a complete ready-for-review report and all five evidence files.
