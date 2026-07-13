# Plan Revision A0-07-R3-sandbox-negative-fixtures-v1

> **Executor instructions**: Read this entire revision before editing. Execute
> the steps in order and run every verification command. Change no file except
> the one explicitly allowed below. On any STOP condition, return evidence to
> the orchestrator without improvising.
>
> **Drift check**: `git diff --stat fe8b4c8..HEAD -- tests/component/sandbox_policy.test.ts policy/sandbox.rego policy/tests/sandbox_test.rego scripts/spec-check.mjs tests/fixtures/policy/spec17_allowed_egress.json`. If any listed contract file changed after this plan was written, compare it with Current state; any semantic mismatch is a STOP condition.

## Status

- **Priority**: P1 — blocks the synchronized validation checkpoint.
- **Effort**: S — one test file, one local factory, one control, and one repaired negative.
- **Risk**: LOW if scope is obeyed; HIGH if an executor revives obsolete authorization semantics or touches controlled Rego.
- **Depends on**: accepted A0-07 closed catalog contract; no implementation dependency.
- **Category**: tests / correctness.
- **Planned at**: commit `fe8b4c8`, 2026-07-13.

## Plan quality self-audit

| Check | Result |
| --- | --- |
| Scope-proportional detail | PASS — atomic one-file repair; no speculative production changes |
| Current `file:line` evidence | PASS — test, adapter, Rego predicates, and canonical fixture are cited below |
| Concrete commands and expected results | PASS — focused Vitest, OPA, SPEC, format, lint, type, and scope commands are exact |
| Positive and adversarial verification | PASS — exact valid tuple is the positive oracle; one-factor tuple mismatch is the negative oracle |
| Machine-checkable done criteria | PASS — exact decision objects, test count, forbidden terms, and file scope are checked |
| Plan-specific STOP conditions | PASS — Rego drift, wrong denial branch, controlled-path need, and dirty-worktree preservation are explicit |
| Maintenance boundary | PASS — accepted catalog vocabulary remains the only future extension point |

## Decision

Repair only the stale component-test fixture exposed by the synchronized validation run. The accepted A0-07 contract in `plans/001-production-work-plan.md`, `docs/INTEGRATION_BOUNDARY.md`, `docs/POLICY_MODEL.md`, and `policy/sandbox.rego` is authoritative: open egress is authorized by exactly one complete closed, typed catalog row bound to the verified identity and request tuple. The pre-A0-07 `policy_id` allowlist and `egress_not_denied` reason are no longer part of that contract and must not be revived.

The confirmed baseline command

```text
./node_modules/.bin/vitest run tests/component/sandbox_policy.test.ts
```

fails exactly one of six tests at `tests/component/sandbox_policy.test.ts:106`: the stale flat input omits the required identity, request, egress-request, and closed catalog contexts, so the decision correctly contains `catalog_invalid` rather than the removed `egress_not_denied` reason. The other five tests pass. This is a test-fixture/expectation defect, not evidence that strict Rego should be weakened.

Planned against commit `fe8b4c8` on 2026-07-13.

## Why this matters

A negative security test is only meaningful when every condition except the factor under test is valid. The current stale input is denied for malformed catalog/context, so its green `allow=false` observation cannot prove the intended catalog mismatch branch. The repair establishes a valid positive oracle first, then derives a one-factor negative whose exact reason proves the correct branch executed.

The invariant is fail-closed without false evidence: malformed catalog fixtures must continue to report `catalog_invalid`, while a closed valid catalog that does not match the requested tuple must report `destination_not_cataloged`. Obsolete `policy_id` vocabulary must not be reintroduced as a shortcut.

## Current state

- `tests/component/sandbox_policy.test.ts:88-107` constructs the only failing case from a pre-A0-07 flat input and expects removed reason `egress_not_denied`.
- `tests/component/sandbox_policy.test.ts:11-86,109-146` contains five passing tests that must retain their current branch coverage.
- `policy/sandbox.rego:90-120` defines the eight-key closed, typed catalog-row predicate and valid non-empty catalog.
- `policy/sandbox.rego:122-152` binds tenant, destination, protocol, port, action, enabled state, and role to exactly one row.
- `policy/sandbox.rego:266-304` contains the only current open-egress allow paths; neither consumes `policy_id`.
- `policy/sandbox.rego:338-346` distinguishes `destination_not_cataloged` from `catalog_invalid`.
- `tests/fixtures/policy/spec17_allowed_egress.json:1-9` is the canonical valid non-approval input shape to mirror locally.
- `src/lib/opa.ts:36-88` invokes real bundled OPA and maps `deny_reason` to `PolicyDecision.reasons`; an empty deny set becomes `['ok']`.
- No standalone sandbox-input JSON Schema exists. For this repair, “schema-valid” means conforming to the accepted closed Rego predicates and canonical SPEC-17 fixture; creating a new schema is out of scope.
- A read-only real-OPA probe from the canonical fixture produced exactly `{"allow":true,"requires_approval":false,"reasons":["ok"]}`; changing only `egress_request.destination` produced exactly `{"allow":false,"requires_approval":false,"reasons":["destination_not_cataloged"]}`.

## Commands you will need

| Purpose | Command | Expected |
| --- | --- | --- |
| Focused behavior | `./node_modules/.bin/vitest run tests/component/sandbox_policy.test.ts` | 1 file / 7 tests pass |
| Rego regression | `./node_modules/node/bin/node scripts/opa-test.mjs` | exit 0; zero failures |
| SPEC-17 | `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-17` | exit 0 |
| Format | `./node_modules/.bin/biome format --diagnostic-level=error tests/component/sandbox_policy.test.ts` | checked, no fixes |
| Lint | `./node_modules/.bin/biome lint --diagnostic-level=error tests/component/sandbox_policy.test.ts` | checked, no diagnostics |
| Typecheck | `npm run typecheck` | exit 0 |
| Diff integrity | `git diff --check -- tests/component/sandbox_policy.test.ts` | exit 0 |

## Authority and contradiction resolution

1. `policy/sandbox.rego:90-152` defines the accepted closed catalog row and exact single-row tuple match. `policy/sandbox.rego:266-304` authorizes open egress only through that match. `policy/sandbox.rego:338-346` emits `destination_not_cataloged` for no matching row and `catalog_invalid` only when catalog shape/type validation fails.
2. Neither current `policy/sandbox.rego` nor the accepted A0-07 documentation defines `policy_id` authorization or `egress_not_denied`. The only current occurrence of `egress_not_denied` is the stale component assertion.
3. Therefore the tests-only repair must delete/replace the `policy_id: 'not-allowlisted'` case. It must not reinterpret that field as a catalog identifier, add a compatibility alias, or change Rego to make the old assertion reachable.
4. The replacement negative starts from an independently proven valid open-egress control, changes exactly one tuple factor, and expects the canonical `destination_not_cataloged` reason while proving `catalog_invalid` is absent.

## Scope

The implementation worker may modify exactly one file:

- `tests/component/sandbox_policy.test.ts`

The worker may read this revision and the authoritative files cited above, but must not modify the revision artifact. No new fixture file is required.

The following are forbidden:

- Any path under `policy/**`, including `policy/sandbox.rego` and `policy/tests/sandbox_test.rego`.
- Any path under `schemas/**` or `tests/fixtures/policy/**`.
- `scripts/spec-check.mjs`, `scripts/opa-test.mjs`, `src/lib/opa.ts`, `src/lib/sandbox.ts`, and `src/lib/sandboxOpenSandbox.ts`.
- `docs/**`, `plans/001-production-work-plan.md`, `.orchestration/tasks/**`, `.orchestration/acceptance/**`, and any other main-plan/task/acceptance artifact.
- `package.json`, lockfiles, release manifests, dependency changes, generated artifacts, staging, commit, or push.

`policy/**` is a controlled resource. If the requested test behavior appears to require any Rego edit, stop and report that separate controlled authorization is required; do not make or propose the edit inside this revision. The expected repair is tests-only.

## Steps

### Step 1: Add one canonical positive factory

In `tests/component/sandbox_policy.test.ts`, add a small function that returns a fresh open-egress input matching `tests/fixtures/policy/spec17_allowed_egress.json` and the predicates in `policy/sandbox.rego`:

- `egress: 'allow'` and `env_keys: []`.
- A deterministic `now` timestamp matching the canonical SPEC-17 fixture.
- Verified `identity_context` for tenant `acme`, role `software_engineer`, audience `flue-pi-sandbox-policy`, gateway-owned verification, and request binding `binding-1`.
- `request_context` with non-empty tenant/task/run/binding, valid `sha256:` source and evidence digests, and action `fetch_dependency`.
- `egress_request` with destination `packages.example`, protocol `https`, numeric port `443`, action `fetch_dependency`, and binding `binding-1`.
- `egress_catalog` containing exactly one fresh closed row with exactly these eight keys: `tenant_id`, `destination`, `protocol`, `port`, `action`, `enabled`, `requires_approval`, and `allowed_roles`. Its complete tuple must match the identity/request tuple; `enabled` is `true`, `requires_approval` is `false`, and `allowed_roles` is `['software_engineer']`.

The function must return fresh nested objects and arrays on every call so one negative mutation cannot contaminate the positive control or another test. Do not add `policy_id`, `image`, approval fields, unknown keys, or a generalized deep-merge abstraction. Keep the helper local to this test file.

**Verify — positive oracle**: run the focused test name after adding Step 2; it must return `allow=true`, `requires_approval=false`, and `reasons=['ok']` through real OPA.

**Verify — adversarial oracle**: temporarily omit `requires_approval` from the local catalog row and confirm the control fails with `catalog_invalid`; restore the valid row immediately. Do not retain the mutation.

### Step 2: Prove the factory reaches the intended positive branch

Add a focused test named to state that the exact valid non-approval catalog tuple allows open egress. Evaluate a fresh factory result through the existing `evaluatePolicy`, `policyPath`, and `query` values and assert all three observable results exactly:

- `allow === true`
- `requires_approval === false`
- `reasons` equals `['ok']`

This control must execute before relying on the negative variant. It proves the baseline catalog is valid and prevents a denial caused by malformed setup from masquerading as successful negative coverage.

**Verify**: `./node_modules/.bin/vitest run tests/component/sandbox_policy.test.ts -t 'exact valid non-approval catalog tuple'` must pass exactly the new control.

### Step 3: Replace the stale policy-ID test with one atomic mismatch

Delete the test named `denies open egress without an allowlisted policy`, including `policy_id: 'not-allowlisted'` and the `egress_not_denied` assertion. Replace it with a test named to state the exact factor being mismatched, preferably the requested destination.

Remove the other ignored `policy_id: ''` properties from this test file as a mechanical deletion of obsolete vocabulary. Do not replace them with another identifier or change any expectation in those passing cases.

The replacement must:

1. Create one fresh factory result.
2. Change exactly one scalar factor after construction: set `egress_request.destination` to `not-allowlisted.example` while leaving the closed catalog row and every other identity/request/catalog field unchanged.
3. Evaluate the candidate through the existing real OPA adapter.
4. Assert the decision exactly: `allow === false`, `requires_approval === false`, and `reasons` equals `['destination_not_cataloged']`.
5. Also assert `reasons` does not contain `catalog_invalid`, making the fixture-quality guarantee explicit.

Do not mutate both request and catalog, do not disable the row, do not change role/tenant/protocol/port/action at the same time, and do not weaken the assertion to only `allow === false`. Those alternatives either test a different branch or allow a malformed fixture to pass for the wrong reason.

**Verify — positive**: the replacement test passes only with exact `['destination_not_cataloged']` and explicit absence of `catalog_invalid`.

**Verify — adversarial**: temporarily delete `requires_approval` from the catalog row used by the negative and confirm the exact-reason assertion fails because `catalog_invalid` appears; restore the valid factory immediately. This proves the oracle rejects malformed setup.

### Step 4: Preserve unrelated coverage

Leave the five currently passing cases semantically unchanged: legacy denied-egress allow, tenant mismatch, empty tenant catalog data, forbidden environment key, and policy-unavailable fail-closed behavior. Do not refactor those cases into the new open-egress helper; the atomic repair is limited to the stale catalog negative plus its necessary positive control.

**Verify**: the full focused file reports seven passed and zero failed/skipped; inspect the diff and confirm no existing expectation changed outside removal of ignored `policy_id` properties.

## Test plan

- Existing file only: `tests/component/sandbox_policy.test.ts`.
- Add one positive control for an exact valid closed non-approval catalog tuple.
- Replace one stale negative with a one-factor requested-destination mismatch.
- Keep the existing five branch tests as regressions.
- Use exact decision-field assertions rather than snapshots or broad truthiness.
- Run the full Rego suite and SPEC-17 checker to prove the local factory did not motivate any production contract change.

## Verification and acceptance

Run these commands in order. Every command must complete with exit code `0` unless an explicit expected output is stated.

1. Focused component suite:

   ```text
   ./node_modules/.bin/vitest run tests/component/sandbox_policy.test.ts
   ```

   Expected: one file passes; seven tests pass; zero tests fail or skip. The new positive control and atomic `destination_not_cataloged` negative both execute.

2. Canonical A0-07 Rego suite, unchanged:

   ```text
   ./node_modules/node/bin/node scripts/opa-test.mjs
   ```

   Expected: all discovered Rego tests pass with zero failures and no parse/compile error.

3. SPEC-17 conformance, unchanged:

   ```text
   ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-17
   ```

   Expected: exit `0`, with no sandbox-contract or source-drift failure.

4. File-local formatting and lint:

   ```text
   ./node_modules/.bin/biome format --diagnostic-level=error tests/component/sandbox_policy.test.ts
   ./node_modules/.bin/biome lint --diagnostic-level=error tests/component/sandbox_policy.test.ts
   ```

   Expected: both commands check the file without applying fixes and exit `0`.

5. Type and diff integrity:

   ```text
   npm run typecheck
   git diff --check -- tests/component/sandbox_policy.test.ts
   ```

   Expected: both commands exit `0`.

6. Exact scope guard:

   Before editing, record the output digest of the pre-existing diff for forbidden paths:

   ```text
   git diff --binary HEAD -- docs plans/001-production-work-plan.md .orchestration/tasks .orchestration/acceptance | shasum -a 256
   shasum -a 256 .orchestration/plan/revisions/A0-07-R3-sandbox-negative-fixtures-v1.md
   ```

   After verification, run both commands again and require each exact same digest, then run:

   ```text
   git diff --name-only HEAD -- tests/component/sandbox_policy.test.ts
   git diff --exit-code HEAD -- policy schemas tests/fixtures/policy scripts/spec-check.mjs scripts/opa-test.mjs src/lib/opa.ts src/lib/sandbox.ts src/lib/sandboxOpenSandbox.ts package.json package-lock.json
   ```

   Expected: both before/after digests are byte-identical; the name-only command prints exactly `tests/component/sandbox_policy.test.ts`; the final diff command prints nothing and exits `0`. Pre-existing unrelated worktree changes and this revision artifact must be preserved byte-for-byte and must not be included in the implementation result.

## Done criteria

- [ ] The only implementation diff is `tests/component/sandbox_policy.test.ts`.
- [ ] A fresh canonical factory produces a complete valid open-egress tuple and closed eight-key catalog row.
- [ ] The positive control proves that exact tuple returns `allow=true`, `requires_approval=false`, `reasons=['ok']`.
- [ ] The negative changes exactly one factor from that control.
- [ ] The negative returns exactly `allow=false`, `requires_approval=false`, `reasons=['destination_not_cataloged']`.
- [ ] The negative explicitly proves `catalog_invalid` is absent.
- [ ] `policy_id` and `egress_not_denied` are absent from `tests/component/sandbox_policy.test.ts`.
- [ ] No `policy/**`, schema, production source, script, fixture, documentation, task, main-plan, acceptance, dependency, or release-manifest file changed.
- [ ] Focused Vitest, full Rego tests, SPEC-17 check, file-local format/lint, typecheck, and diff checks all pass.
- [ ] Nothing is staged, committed, or pushed.

## STOP conditions

Stop and return to the orchestrator without improvising if any condition occurs:

- The live `policy/sandbox.rego` no longer matches the closed-row keys or single-tuple predicates summarized above.
- A fresh exact tuple does not return `allow=true` and `['ok']`; do not weaken the negative test to hide that baseline failure.
- A one-factor destination mismatch produces `catalog_invalid`, more than the exact `destination_not_cataloged` reason, or an undefined decision.
- Any passing result requires `policy_id`, `egress_not_denied`, a Rego/schema/script/source edit, or more than the one allowed test file.
- OPA or SPEC-17 fails outside the test change, or a command fails twice after correcting an error inside the allowed test file.
- The worker cannot preserve pre-existing unrelated worktree changes exactly.

## Maintenance notes

- Future sandbox catalog tests should derive negative cases from a separately proven valid positive input and mutate one authorization factor per test.
- When the catalog contract changes, update the canonical SPEC-17 fixture and Rego tests under separately authorized work before updating this component factory; do not let the test become a second normative schema.
- Reviewers should reject reintroduction of `policy_id` or reason-only assertions that do not prove `catalog_invalid` is absent.
- Runtime caller migration in `src/lib/sandboxOpenSandbox.ts` is intentionally deferred to its owning work unit and is not evidence for expanding this atomic repair.

## Exit sequence

After every checklist item passes, return the single test-file diff and raw verification results to the orchestrator for independent negative review. Do not update A0-07 acceptance, validation evidence, tasks, the main plan, or release artifacts in this revision, and do not stage, commit, or push.
