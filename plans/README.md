# flue_pi_ai_agent production-readiness implementation plans

This directory is the canonical planning surface for commit `2c6fdb0`.
Implementation is forbidden until the applicable decision records and WU
preconditions in the master plan pass.

## Execution order and status

| Plan | Purpose | Priority | Effort | Depends on | Status |
| --- | --- | --- | --- | --- | --- |
| [001](001-production-work-plan.md) | Close 61 production gaps and 20 specification defects through 44 atomic WUs | P0/P1/P2 | L | none | TODO |

Status values: `TODO`, `IN PROGRESS`, `DONE`, `BLOCKED: <reason>`, `REJECTED: <reason>`.

## Executor start checklist

- [ ] Read `plans/001-production-work-plan.md` completely.
- [ ] Run `./node_modules/node/bin/node plans/validate-production-plan.mjs`; require exit 0.
- [ ] Select exactly one WU whose preconditions and dependency acceptance records pass.
- [ ] Create one `AGMSG-TASK`; do not combine WUs.
- [ ] Enforce the WU `allowed_files` and `forbidden_actions` literally.
- [ ] Run every DoD command and record actual exit codes in the named validation artifact.
- [ ] Return `blocked` instead of inferring a missing user/orchestrator decision.
- [ ] Require an orchestrator-owned acceptance record before starting a dependent WU.

## Phase order

`A0 and A (parallel) → B/C/D/F work allowed by each WU dependency → E/G work allowed by each WU dependency → Production Ready`.

- A0 normalizes trust-boundary specifications and request contracts.
- A makes release evidence truthful and source-bound.
- B commissions the single-host production LLM path.
- C completes OpenSandbox isolation.
- D makes repair and closure behavior real rather than fixture-specific.
- E adds the tenant-bound governed datasource.
- F completes durable evidence, authorization, recovery, SLO, and signed policy operations.
- G closes documentation, dependencies, distribution, security maintenance, and skill governance.

## Hard boundaries

- Workers never write acceptance or decision records.
- Live credentials, production data, policy changes, release acceptance, and
  skill promotion use the governed delegation path.
- Kubernetes, multi-region deployment, new plugin frameworks, and unrelated
  refactors are outside this plan.
- A new gap is reported through the deviation procedure; it is not fixed inside
  the active WU.

## Findings considered and rejected

- Kubernetes before a working single-host production profile: rejected as premature.
- Unbounded arbitrary-code autonomous repair: rejected; D1-01 defines explicit supported repair classes and safe refusal.
- Automatic major dependency upgrades in G2-03: rejected; compatibility evidence and an accepted adopt/retain decision must precede upgrades.
