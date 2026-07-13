# Task PHASE-A0-R2: Revalidate direct OPA decisions with explicit dependencies

## Role and model

Use `gpt-5.6-sol` with reasoning effort `high`. You are a verification worker, not the orchestrator. This resumed task is authorized by `.orchestration/acceptance/PLAN-PHASE-A0-R2-v1.acceptance.md`.

## Objective

Execute the corrected A0-01, A0-02, A0-03, A0-05, Phase A0 Exit, and Production Ready direct OPA checks from plan revision `P9-T02-v5`. Prove exact deny reasons and positive controls with explicit dependencies. Do not change product or policy files.

## Allowed files

- `.orchestration/reports/PHASE-A0-R2.report.md`
- `.orchestration/validation/PHASE-A0-R2.validation.log`
- `.orchestration/sandboxes/PHASE-A0-R2.sandbox.md`
- `.orchestration/learning/PHASE-A0-R2.learning.md`
- `.orchestration/autoskill/runs/PHASE-A0-R2.autoskill.md`
- `.agents/worklog/**`

Every other path is read-only. In particular, do not edit `policy/**`, runtime JSON, tests, scripts, plans, decisions, acceptances, leases, or audit artifacts.

## Required verification

1. Run all six corrected direct-evaluation command groups from the plan, not a paraphrase.
2. Run each of the three Phase A0 negative queries with its intended Rego module omitted and prove nonzero, demonstrating no module-absence false-green.
3. Prove both positive controls fail nonzero if their expected `allow` is changed to `false = true` or another deterministic negative control.
4. Run `scripts/opa-test.mjs` and `plans/validate-production-plan.mjs`.
5. Capture commands, outputs, and exit codes. Do not mark Phase A0 passed; SPEC-register/attestation refresh is a separate prerequisite.

## Result

Write all five evidence files and send exactly:

```text
AGMSG-RESULT v1 task_id=PHASE-A0-R2 status=ready_for_review acceptance_tier=review report=.orchestration/reports/PHASE-A0-R2.report.md validation=.orchestration/validation/PHASE-A0-R2.validation.log sandbox=.orchestration/sandboxes/PHASE-A0-R2.sandbox.md learning=.orchestration/learning/PHASE-A0-R2.learning.md autoskill=.orchestration/autoskill/runs/PHASE-A0-R2.autoskill.md
```
