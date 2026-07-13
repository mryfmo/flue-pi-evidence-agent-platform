# PLAN-A1-01-R4-v1 Acceptance

status: accepted
acceptance_tier: orchestrator-with-standing-user-authorization
revision: A1-01-R4-v1
plan_revision: P9-T02-v13
source: .orchestration/plan/revisions/A1-01-R4-loopback-lifecycle-v1.md
review_outcome: accepted-after-two-independent-adversarial-revisions

The initial resolve-only helper plan was rejected because timeout cleanup could no-op before a late `listening` event and leave a residual server. The accepted revision uses the pinned Node 22.19 native AbortSignal listen cancellation, bounds the deadline at 2,000 ms, preserves original bind and address-inspection errors, requires literal awaited cleanup for all 13 consumers, and restricts implementation to four test files. Independent review confirmed Node's abort-driven `_listeningId` invalidation prevents a pending lookup from later starting the server. The remaining command-scope, exact-wrapper, and address-throw lifecycle findings were corrected before acceptance.
