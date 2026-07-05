# Skill Optimization

SkillOpt keeps remediator instruction changes as auditable files, not hidden prompt edits.

## Registry Layout

| Path | Purpose |
| --- | --- |
| `.orchestration/skills/promoted/remediator/best_skill.md` | Current promoted remediator instructions with provenance and rollback metadata. |
| `.orchestration/skills/candidates/remediator/candidate_skill.md` | Proposed candidate for the next validation cycle. |
| `.orchestration/skills/candidates/remediator/cycle-<n>.verdict.json` | Deterministic validation result for a cycle. |
| `.orchestration/skills/rejected/remediator/` | Rejection records that block resubmission of the same failed idea. |

## State Transitions

Candidate files start with `promotion_allowed=false`.

1. `candidate` -> `validated`: `scripts/skill-cycle.mjs <cycle>` shows the candidate held-out run passes and `npm run validate-release` passes.
2. `validated` -> `promoted`: orchestrator acceptance only. Workers must not auto-promote.
3. `candidate` -> `rejected`: any failed held-out run, failed artifact assertion, failed closure, or failed release validation.

## Promotion Authority

Only the orchestrator may promote a validated candidate to `best_skill.md`. Promotion preserves provenance and links the verdict evidence.

## Rollback

Rollback is a git revert of `best_skill.md` plus the linked provenance chain. The previous promoted file remains recoverable through git history and acceptance records.

## Rejected Buffer

Rejected candidates must record candidate version, cycle, reason, evidence path, and an anti-resubmission key. A future candidate cannot reuse the same failed idea unless the rejection reason is explicitly addressed.

## Harness Limitation

With the deterministic local gateway, the cycle validates non-regression of the gated pipeline. Semantic quality comparison activates when the production gateway path is used for summarization.
