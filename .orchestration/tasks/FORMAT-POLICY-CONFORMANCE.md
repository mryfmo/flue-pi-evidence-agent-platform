# Task FORMAT-POLICY-CONFORMANCE: normalize controlled Rego EOF only

## Objective

Under controlled delegation, ensure `policy/tests/conformance_test.rego` ends with exactly one LF and no additional blank lines. Do not change any non-whitespace byte or policy/test semantics.

## Allowed files

- `policy/tests/conformance_test.rego`
- `.orchestration/reports/FORMAT-POLICY-CONFORMANCE.report.md`
- `.orchestration/validation/FORMAT-POLICY-CONFORMANCE.validation.log`
- `.orchestration/sandboxes/FORMAT-POLICY-CONFORMANCE.sandbox.md`
- `.orchestration/learning/FORMAT-POLICY-CONFORMANCE.learning.md`
- `.orchestration/autoskill/runs/FORMAT-POLICY-CONFORMANCE.autoskill.md`

## Verification

- Confirm the only delta from the current staged policy content is removal of trailing blank lines.
- `git diff --check -- policy/tests/conformance_test.rego` exits 0.
- `./node_modules/node/bin/node scripts/opa-test.mjs` exits 0 with the unchanged full test count.

Return `AGMSG-RESULT v1 task_id=FORMAT-POLICY-CONFORMANCE status=ready_for_review acceptance_tier=auto` with all five standard evidence paths.
