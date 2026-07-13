# PLAN-A2-01-R3-v1 Acceptance

status: accepted
acceptance_tier: orchestrator-with-standing-user-authorization
revision: A2-01-R3-v1
plan_revision: P9-T02-v9
source: .orchestration/plan/revisions/A2-01-R3-v1.md
review_outcome: accepted-after-two-revisions

The initial R3 plan was rejected because it treated authentic empty streams as invalid and left the A2/A1/checkpoint cycle ambiguous. The accepted revision allows exact digest-bound empty streams, attacks a normally nonempty bound log, makes no-argument modes structural without physical evidence, and defines an exact blocked A2 → A1 manifest generation → audited checkpoint → A1 full run → resumed A2 strict post-run verification handoff.

It also fixes the legacy private-workflow E2E and FR-001 mapping and closes unsupported Markdown block-start parser bypasses. R2 tuples, runtime, policy, dependencies, and SPEC-20 signed evidence remain unchanged.
