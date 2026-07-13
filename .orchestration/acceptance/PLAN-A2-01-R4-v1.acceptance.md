# PLAN-A2-01-R4-v1 Acceptance

status: accepted
acceptance_tier: orchestrator-with-standing-user-authorization
revision: A2-01-R4-v1
plan_revision: P9-T02-v10
source: .orchestration/plan/revisions/A2-01-R4-v1.md
review_outcome: accepted-after-independent-revision

The initial wording was rejected because it ambiguously required the A2 contract edit outside the worker boundary and conflated release-source discovery with CI artifact archive enumeration. The accepted revision explicitly allows only the R2 contract JSON for A2, keeps the baseline JSON read-only, and binds exactly both consumed JSON files through release discovery, manifest verification, dirty-state detection, source-tree digest, and the existing CI source-tree binding without changing the CI archive schema.

Independent recomputation confirmed the normalized baseline file digest `3480e8f8b5b8d0b65b193df52c1589b3a201fb307f4a18b4a46f1afd64f33392`, unchanged baseline tuple digest `920779c8d43363a82401f0750de9d0a543934eedbed7276e971183b763a27f9a`, predicted contract digest `36ce9416e47115eae5b88f1aa44659508c224b745565cc5751173204587c0aa8`, and unchanged post tuple digest `5ee6afb60940ebd8eff1ffb85c4a01f3653d7e0bdbfc051ba0d23caba92c7b91`. All 72 tuples, severities, R3 semantics, and the SPEC-20 stale disposition remain unchanged.
