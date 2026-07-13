# PLAN-A2-01-R1-v1 Acceptance

status: accepted
superseded_by: A2-01-R2-v1
acceptance_tier: orchestrator-with-standing-user-authorization
revision: A2-01-R1-v1
plan_revision: P9-T02-v7
source: .orchestration/plan/revisions/A2-01-R1-v1.md
baseline: .orchestration/plan/revisions/A2-01-R1-baseline.json
deviation_request: .orchestration/reports/A2-01.deviation-request.md
review_outcome: accepted-after-revision

The first cold review rejected an ambiguous moving-checkpoint reference and insufficient lockstep-change tests. The revised plan freezes 72 exact `(id,text,severity)` tuples, independently verified baseline and post-change SHA-256 digests, the sole FR-001 catalog substitution, the exact 13 projection-only IDs, deterministic non-normalizing Markdown extraction, and adversarial cases covering all authorized and unauthorized tuple changes.

The revision changes no ID or severity, preserves all 58 other strings, does not modify runtime or policy, and does not refresh or bypass the expected SPEC-20 current-source drift. It is superseded only where its single-paragraph heading rule omitted the accepted second paragraph of REQ-HTTP-REQUEST-001.
