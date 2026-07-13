# PLAN-A1-01-R3-timeout-runner-v1 Acceptance

status: accepted
acceptance_tier: orchestrator-with-standing-user-authorization
revision: A1-01-R3-timeout-runner-v1
plan_revision: P9-T02-v11
source: .orchestration/plan/revisions/A1-01-R3-timeout-runner-v1.md
review_outcome: accepted-after-independent-revision

The initial plan was rejected because the validator's outer 120-second watchdog could preempt the 180-second runner and orphan detached descendants, while several race, status, grammar, and grace-period decisions were unspecified. The accepted revision fixes four literal gate tuples, a strict bounded timeout grammar, deterministic exits, a 2000 ms one-way timeout latch, POSIX process-group escalation, non-POSIX direct-child behavior, exact outer-watchdog discrimination, and handshake-based adversarial tests.

The 25 gate names/order, time limits, `npm_sbom_prod` stdout artifact binding, dependency set, and all non-runner watchdogs remain unchanged.
