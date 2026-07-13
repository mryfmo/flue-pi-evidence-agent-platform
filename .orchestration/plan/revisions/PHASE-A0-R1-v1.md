# Plan Revision PHASE-A0-R1-v1

## Decision

Approved under the plan deviation procedure using the user's standing authorization to complete the entire plan autonomously. The change preserves SPEC-20 meaning and strengthens its current-source enforcement; it does not authorize a policy-rule change, production key, acceptance bypass, or source-manifest weakening.

## Source evidence

- `.orchestration/reports/PHASE-A0-R1.deviation-request.md`
- The accepted SPEC-20 vector was stale before PHASE-A0-R1 (`signed=5383d2...`, pre-repair current source=`67c664...`).
- `scripts/spec-check.mjs` is an intentional member of the closed 22-path capability source manifest, so the register implementation correctly changes the current source ID.
- The initial register mode checks ID/trace uniqueness but does not run the existing per-SPEC semantic validators, which would let a stale SPEC-20 vector pass the Phase A0 register command.

## Exact plan and task diff

1. Increment the production plan revision from `P9-T02-v5` to `P9-T02-v6`.
2. Clarify Phase A0 Exit and Production Ready: full `--check-spec-register SPEC-01..SPEC-20` must execute both exact register/bijection checks and every existing per-SPEC semantic validator for the expanded range.
3. Extend PHASE-A0-R1 allowed files only to the accepted A0-08 test-vector regeneration set: `tests/fixtures/policy/spec20_complete.json`, `policy/tests/conformance_test.rego`, `.orchestration/validation/A0-08.test-trust.json`, and the six `.orchestration/validation/A0-08.artifacts/*.json` files, plus PHASE-A0-R1 evidence.
4. Preserve `.orchestration/validation/A0-08.source-manifest.json` as read-only with the exact 22 paths.
5. Require a fresh run ID and temporary test-only RSA key; rerun six real capability commands, hash exact artifact bytes, regenerate all six signed tuples/catalog/bundle, independently verify them, delete the private key, and scan for retained private material.

## Affected work

- Repair task: PHASE-A0-R1
- Existing WU: A0-08 evidence refresh only; requirement and policy decisions unchanged
- Phase gates: A0 and Production Ready semantic register validation
- Dependencies, WU count, GAP/SPEC mapping: unchanged

## Exit conditions

- Register CLI tests cover syntax, uniqueness, orphan/extra/malformed records, and proof that full register triggers per-SPEC semantic checks.
- Full register, `--check-spec SPEC-01,SPEC-20`, no-argument check, OPA 166/166, typecheck, lint, diff check, signature/catalog/artifact/bundle verification, and private-key scan all pass.
- Mutating any bound source or regenerated artifact makes the unchanged signed vector fail.
- No private key remains and no production/CI/KMS provenance is claimed.
