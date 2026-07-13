# PHASE-A0-R2 direct OPA revalidation report

status: ready_for_review
acceptance_tier: review
plan_revision: P9-T02-v5
authorization: .orchestration/acceptance/PLAN-PHASE-A0-R2-v1.acceptance.md

## Result

- Executed all six corrected direct-evaluation groups for A0-01, A0-02,
  A0-03, A0-05, Phase A0 Exit, and Production Ready with explicit Rego and
  tenant-data dependencies. Every group exited `0`.
- Each negative decision returned both `not allow` and its exact intended deny
  reason: `missing_classification`, `unknown_route`,
  `body_identity_forbidden`, or
  `synthetic_output_not_local_non_evidence`.
- Both valid fixtures passed non-vacuous positive controls using unification
  (`allow = true`).
- Omitting the intended Rego module made each of the three Phase A0 negative
  queries undefined and nonzero (`1`), proving that deny-reason binding removes
  the previous module-absence false-green.
- Changing each positive control to the wrong expectation (`allow = false`)
  also exited `1`, proving the positive controls detect a stuck-deny or wrong
  expected decision.
- The complete OPA suite passed `166/166`; the production-plan validator passed
  with `wus=44 gaps=61 specs=20`.

## Scope

No plan, policy, runtime JSON, script, test, decision, acceptance, lease, or
audit artifact was edited. The five PHASE-A0-R2 evidence files are the only
outputs of this task.

## Gate disposition

This result revalidates only the corrected direct OPA decisions. It does not
mark Phase A0 passed. SPEC-register and attestation refresh remain separate
Phase A0 prerequisites, and the previously recorded OPA bundle-layout gap is
not fixed or claimed closed here.

## Evidence

- `.orchestration/validation/PHASE-A0-R2.validation.log`
- `.orchestration/sandboxes/PHASE-A0-R2.sandbox.md`
- `.orchestration/learning/PHASE-A0-R2.learning.md`
- `.orchestration/autoskill/runs/PHASE-A0-R2.autoskill.md`
