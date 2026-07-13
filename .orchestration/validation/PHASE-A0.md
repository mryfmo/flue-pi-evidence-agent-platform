# Phase A0 Exit Evidence

status: passed
plan_revision: P9-T02-v6
validated_at: 2026-07-13T14:17:05+09:00
orchestrator: codex-gpt56sol-flue

## Mandatory gate results

| Criterion | Result | Evidence |
| --- | --- | --- |
| A0-01 through A0-09 accepted | exit 0 | `.orchestration/acceptance/A0-01.acceptance.md` through `A0-09.acceptance.md` |
| Full semantic SPEC register `SPEC-01..SPEC-20` | exit 0 | `spec-check:passed`; `.orchestration/acceptance/PHASE-A0-R1.acceptance.md` |
| Specification policy suite | exit 0, 166/166 | `scripts/opa-test.mjs` |
| Direct missing-classification deny | exit 0 | exact `missing_classification` reason and routing positive control |
| Direct undeclared-default deny | exit 0 | exact `unknown_route` reason and routing positive control |
| Direct forged-body-identity deny | exit 0 | exact `body_identity_forbidden` reason and agent positive control |
| Remediation request trust boundary | exit 0, 11/11 | `tests/component/request_contract.test.ts` |

## False-green repairs incorporated

- `PHASE-A0-R1` implements range parsing, exact uniqueness/bijection, and per-SPEC semantic expansion. It refreshes the stale local SPEC-20 test vector from six actual run-007 capability commands.
- The orchestrator independently recomputed source revision `93aea20d423c350b343afce37df77967bc5224322868b2ffc7eb7ab484556215`, six artifact byte digests, six RS256 signatures/payload tuples, the exact catalog, and bundle `sha256:45daa38c0dd2d2db823c63117289a286120d90ad9c50c3291597895ba4756753`. No private key remains.
- `PHASE-A0-R2` replaces invalid directory-wide OPA loading with explicit modules/data, requires exact deny reasons, and adds positive controls. Module omission 3/3 and wrong-expectation controls 2/2 fail nonzero.

## Disposition

All Phase A0 exit commands returned the planned exit code. This evidence authorizes downstream WUs whose precondition requires `^status: passed$` in this file. It does not authorize release acceptance, production credentials, real customer data, or skill promotion.
