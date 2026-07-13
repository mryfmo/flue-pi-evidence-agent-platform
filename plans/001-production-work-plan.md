# Production Work Plan

- source: `.orchestration/reports/P9-T01_production_readiness_audit.md` rev2
- source SHA-256: `dcdb079db2475bac366594df58e0a226faaae2ccba35ef4a6324decf882a9686`
- source revision: `2c6fdb0`
- specification source: `.orchestration/_rollback_opus_20260710/acceptance/P9-T02.acceptance.md` rev1
- specification source SHA-256: `f0c562d6532bda8d22b4eb78f18f15ea73239382d89249610d125aa49640e02a`
- revision source: `.orchestration/_rollback_opus_20260710/acceptance/P9-T02.rev2.acceptance.md`
- revision source SHA-256: `8d05d48bf050acd2e987729e5788b23bf287f2d45f00cf76a24becba42df4764`
- gap addendum: `plans/000-gap-register-addendum.md` covering `GAP-055` through `GAP-061`
- gap addendum SHA-256: `a4ed70d563d1b39edf7560e7327d1a0293276120f2f5b9cd5071ea02f7535e8a`
- plan revision: `P9-T02-v13`
- **Priority**: P0/P1/P2 closure
- **Effort**: L (44 independently dispatchable work units)
- **Risk**: HIGH; production, policy, credential, and real-data boundaries are decision-gated
- **Planned at**: commit `2c6fdb0`, 2026-07-11
- execution rule: one WU equals one `AGMSG-TASK`; one worker completes one WU in one or two sessions
- current task status: planning-only; this file does not authorize implementation

## Production blocker closure map

| P0 blocker | Closing WU | Required acceptance evidence |
| --- | --- | --- |
| GAP-008 | B1-01 | `.orchestration/acceptance/B1-01.acceptance.md` |
| GAP-009 | B1-02 | `.orchestration/acceptance/B1-02.acceptance.md` |
| GAP-016 | B2-01 | `.orchestration/acceptance/B2-01.acceptance.md` |
| GAP-017 | C1-01 | `.orchestration/acceptance/C1-01.acceptance.md` |
| GAP-018 | E1-01 | `.orchestration/acceptance/E1-01.acceptance.md` |
| GAP-021 | D1-01 | `.orchestration/acceptance/D1-01.acceptance.md` |
| SPEC-01 | A0-01 | `.orchestration/acceptance/A0-01.acceptance.md` |
| SPEC-02 | A0-01 | `.orchestration/acceptance/A0-01.acceptance.md` |
| SPEC-03 | A0-01 | `.orchestration/acceptance/A0-01.acceptance.md` |
| SPEC-04 | A0-02 | `.orchestration/acceptance/A0-02.acceptance.md` |
| SPEC-05 | A0-03 | `.orchestration/acceptance/A0-03.acceptance.md` |
| SPEC-06 | A0-04 | `.orchestration/acceptance/A0-04.acceptance.md` |

## Global execution contract

1. Run every command from `/Users/mryfmo/Workspace/flue_pi_ai_agent` unless a WU command includes a different `--cwd` or `cd` path.
2. A precondition command must exit `0`. Any other exit code means **着手禁止**. The worker sends `AGMSG-RESULT status=blocked` and changes no file.
3. A dependency is satisfied only when the orchestrator-owned `.orchestration/acceptance/<WU-ID>.acceptance.md` exists and contains `status: accepted`. Workers are forbidden to create or edit WU, Phase, plan, or Production Ready acceptance records.
4. Every WU writes `.orchestration/reports/<WU-ID>.md` and `.orchestration/validation/<WU-ID>.md`. CI WUs also write the run ID to `.orchestration/validation/<WU-ID>.run-id`.
5. A mock, local deterministic provider, skipped test, cached artifact, or previous-run artifact is not valid evidence for a `requires-real-env` or `requires-ci` DoD.
6. Files outside `allowed_files` are forbidden. A worker does not repair a newly found gap. It writes a new row to `.orchestration/reports/<WU-ID>.new-gaps.md` and stops work that depends on that gap.
7. Every DoD checkbox uses the form `command: <command>; expected exit code: <n>`. A checkbox without both fields is invalid.
8. Every verification command writes fresh evidence after deleting only the WU-owned temporary/evidence path explicitly named by that WU. Deleting shared product evidence is forbidden.
9. Implementations use existing dependencies or language/platform standard libraries. The sole pre-authorized dependency candidate is `@vitest/coverage-v8@4.1.9` in D2-02 after accepted decision record `.orchestration/decisions/D2-02.yaml`. Every other dependency addition requires a plan revision and user approval before the WU starts.
10. Worker discretion is `none` unless the WU says otherwise. Identifier spelling and formatting are not design decisions; repository formatters determine them.
11. A parallel pair is valid only when both WU dependency lines name the other WU. A one-sided parallel declaration is invalid and both WUs run serially.
12. Phase Exit uses two stages: after all WUs are accepted, the orchestrator runs every checkbox except `Phase evidence is recorded`; only when all return `0`, it writes `.orchestration/validation/PHASE-<letter>.md` with `status: passed` and the command results; it then runs the final evidence-recorded checkbox, which must return `0`. No worker writes that file.

## Decision records

The following decisions block their WUs. Only the named owner is authorized to approve the exact YAML record.

| Record | Owner | Required fields | Consumer WU |
| --- | --- | --- | --- |
| `.orchestration/decisions/A0-03.yaml` | user | `spec_id: "SPEC-05"`, `canonical_rule: production_fallback_prohibited\|production_fallback_required`, `synthetic_evidence_status`, `superseded_locations` | A0-03 |
| `.orchestration/decisions/A0-08.yaml` | user | `spec_id: "SPEC-20"`, `requirement_abstraction: capability_level\|tool_specific`, `conformance_evidence`, `superseded_locations` | A0-08 |
| `.orchestration/decisions/B1-01.yaml` | user | `target_os`, `service_manager`, `install_root`, `service_account`, `listen_address` | B1-01 |
| `.orchestration/decisions/B1-02.yaml` | orchestrator | `litellm_version`, `distribution_hash`, `profile_budget`, `profile_rate_limit`, `key_ttl_minutes` | B1-02 |
| `.orchestration/decisions/B2-02.yaml` | user | `supported_locales`, `person_recognizer`, `recognizer_artifact_digest`, `minimum_confidence`, `corpus_path` | B2-02 |
| `.orchestration/decisions/C1-02.yaml` | orchestrator | `max_files`, `max_total_bytes`, `max_depth`, `excluded_names` | C1-02 |
| `.orchestration/decisions/D2-02.yaml` | user | `approved_dependency: "@vitest/coverage-v8@4.1.9"` | D2-02 |
| `.orchestration/decisions/E1-01.yaml` | user | `datasource_kind`, `staging_endpoint_ref`, `tenant_id`, `allowed_schema`, `credential_owner`, `max_rows_scanned`, `timeout_ms`, `max_cost_units` | E1-01 |
| `.orchestration/decisions/F1-03.yaml` | user | `auth_scheme`, `listen_address` | F1-03 |
| `.orchestration/decisions/F1-05.yaml` | user | `rto_minutes`, `rpo_minutes`, `evidence_retention_days` | F1-05 |
| `.orchestration/decisions/F1-06.yaml` | user | `slo_owner`, `paging_target`, `cost_budget_usd_per_day`, `availability_target`, `latency_p95_ms` | F1-06 |
| `.orchestration/decisions/F1-04.yaml` | user | `signing_method`, `verification_key_ref`, `decision_log_sink`, `mask_policy_id`, `bundle_activation_timeout_seconds` | F1-04 |
| `.orchestration/decisions/G2-02.yaml` | orchestrator | `candidate_package_version`, `candidate_opa_version`, `compatibility_result`, `disposition`, `review_trigger_date` | G2-02 |
| `.orchestration/decisions/G2-03.yaml` | user | `notice_copyright_holder`, `security_contact`, `supported_versions`, `vulnerability_response_days` | G2-03 |
| `.orchestration/decisions/G3-01.yaml` | orchestrator | `accepted_task_ids`, `provider_mode`, `sandbox_profile`, `execution_command` | G3-01 |
| `.orchestration/decisions/G3-02.yaml` | orchestrator | `validation_target_name`, `secrets_target_name` | G3-02 |

Workers are forbidden to create or edit these decision records. Missing or unaccepted decisions block the consuming WU.

## Execution graph

```text
Phase A0: A0-01 + A0-03 + A0-04 -> A0-05; A0-02 + A0-04 + A0-05 -> A0-06;
          A0-02 + A0-05 -> A0-07; A0-08 is user-decision-bound;
          A0-09 depends on A0-02 + A0-06; A0-01..A0-09 -> Phase A0 Exit
Phase A: A1-01 -> A1-02; A2-01 -> A2-02; A2-01 -> A2-03
Phase B: B1-01 -> B1-02 -> B1-03; B1-02 + B2-02 -> B2-01 -> B2-03 -> B2-04
Phase C: C1-01 -> C1-02 -> C2-01
Phase D: D1-01 -> D1-02 -> D2-01 -> D2-02
Phase E: A2-01 + B1-03 + C1-02 -> E1-01
Phase F: F1-01 -> F1-02 -> F1-03 -> F1-05 -> F1-06 -> F1-04;
         A2-02 -> F2-01 -> F2-02
Phase G: D1-02 -> G1-01; B2-04 + C2-01 + F2-02 -> G1-02;
         A1-01 -> G2-01 -> G2-02 -> G2-03; A1-01 -> G3-01 -> G3-02
```

Phase A0 and Phase A can execute in parallel. Every Phase B, C, D, and E WU is blocked until Phase A0 Exit is accepted; its precondition also names the applicable A0 WUs.

## Phase A0 — Specification normalization and fail-closed authorization

### WU A0-01 — Close routing fail-open and define trusted classification

- **WU-ID**: `A0-01`; **Phase**: A0; **対応 SPEC**: `SPEC-01`, `SPEC-02`, `SPEC-03`
- **Preconditions**: command: `test -f policy/routing.rego && test -f policy/routing.prod.json && test -f docs/POLICY_MODEL.md && test -f docs/INTEGRATION_BOUNDARY.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: none. **並行可否**: parallel with `A0-02`, `A0-03`, `A0-04`, and `A0-08` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `policy/routing.rego`, `policy/routing.prod.json`, `policy/routing_test.rego`, `policy/tests/routing_test.rego`, `tests/fixtures/policy/routing_*.json`, `schemas/routing-input.schema.json`, `docs/POLICY_MODEL.md`, `docs/INTEGRATION_BOUNDARY.md`, `docs/requirements.json`, `docs/traceability.json`, `scripts/spec-check.mjs`, `.orchestration/{reports,validation}/A0-01*`, `.agents/worklog/**`. Revision `A0-01-R1` adds the root legacy test because `scripts/opa-test.mjs` recursively loads the entire `policy/` tree; both test locations must enforce the same trusted-classification contract.
- **forbidden_actions**: caller-controlled classification; missing-classification default allow; magic `route_id=default` authorization; provider fallback decision; product runtime edits.
- **実装内容**: define the identity of the trusted classification producer, signed/verified input field, classification enum, and missing/invalid behavior; make routing authorization deny missing or untrusted classification; replace the magic default route with an explicitly cataloged route whose provider/model/classification constraints are validated.
- **決定を要する点**: none. Missing or untrusted classification is fail-closed under existing `REQ-FAILCLOSED-002`. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Routing input schema names producer, trust proof, classification enum, and missing/invalid deny behavior — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-01,SPEC-02,SPEC-03`; expected exit code: `0`.
  - [ ] Routing Rego unit tests pass — command: `./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
  - [ ] Missing classification plus external provider is denied by direct evaluation — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/routing_missing_classification.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["missing_classification"]'`; expected exit code: `0`.
  - [ ] Undeclared `route_id=default` returns `unknown_route` and the loaded policy still permits its positive control — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/routing_default_unknown.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["unknown_route"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_routing_valid.json 'data.eap.routing.allow = true'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-01,SPEC-02,SPEC-03 && ./node_modules/node/bin/node scripts/opa-test.mjs && OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/routing_missing_classification.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["missing_classification"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_routing_valid.json 'data.eap.routing.allow = true'` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A0-01.md`.
- **想定される逸脱と禁止事項**: documenting fail-closed while retaining an allow result, trusting an HTTP body classification, or renaming the magic default route without catalog validation is forbidden.

### WU A0-02 — Bind authenticated identity to tenant and role authorization

- **WU-ID**: `A0-02`; **Phase**: A0; **対応 SPEC**: `SPEC-04`
- **Preconditions**: command: `test -f policy/agent.rego && test -f docs/INTEGRATION_BOUNDARY.md && test -f docs/POLICY_MODEL.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: none. **並行可否**: parallel with `A0-01`, `A0-03`, `A0-04`, and `A0-08` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `policy/agent.rego`, `policy/tests/agent_test.rego`, `tests/fixtures/policy/identity_*.json`, `schemas/identity-context.schema.json`, `docs/POLICY_MODEL.md`, `docs/INTEGRATION_BOUNDARY.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/requirements.json`, `docs/traceability.json`, `scripts/spec-check.mjs`, `.orchestration/{reports,validation}/A0-02*`, `.agents/worklog/**`.
- **forbidden_actions**: body-supplied user/tenant authorization; `user != guest` as role model; anonymous production identity; authentication middleware implementation; product runtime edits.
- **実装内容**: define the authenticated principal, immutable subject ID, tenant membership, role claims, issuer/audience, verification owner, request-context binding, and deny behavior for missing/mismatched claims; make agent authorization consume only verified identity context.
- **決定を要する点**: none. The production authentication mechanism is chosen in user-owned F1-03; this WU fixes the identity contract and fail-closed authorization inputs. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Identity schema and requirements bind subject, tenant, role, issuer, audience, and verification status — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-04`; expected exit code: `0`.
  - [ ] Agent policy tests reject anonymous, foreign-tenant, missing-role, and body-forged identities — command: `./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
  - [ ] Forged body identity cannot authorize apply_patch and the loaded policy still permits its positive control — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/agent.rego --data policy/tenants.json --input tests/fixtures/policy/identity_forged_body.json 'not data.eap.agent.allow; data.eap.agent.deny_reason["body_identity_forbidden"]' && "$OPA_BIN" eval --fail --data policy/agent.rego --data policy/tenants.json --input tests/fixtures/policy/identity_valid.json 'data.eap.agent.allow = true'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-04 && ./node_modules/node/bin/node scripts/opa-test.mjs && OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/agent.rego --data policy/tenants.json --input tests/fixtures/policy/identity_forged_body.json 'not data.eap.agent.allow; data.eap.agent.deny_reason["body_identity_forbidden"]' && "$OPA_BIN" eval --fail --data policy/agent.rego --data policy/tenants.json --input tests/fixtures/policy/identity_valid.json 'data.eap.agent.allow = true'` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A0-02.md`.
- **想定される逸脱と禁止事項**: treating any non-guest string as authenticated, copying tenant from request body into verified context, or selecting an auth vendor in this WU is forbidden.

### WU A0-03 — Select one production deterministic-fallback contract

- **WU-ID**: `A0-03`; **Phase**: A0; **対応 SPEC**: `SPEC-05`
- **Preconditions**: command: `test -f docs/PRODUCTION_GATEWAY_DESIGN.md && test -f docs/INTEGRATION_BOUNDARY.md && test -f .orchestration/decisions/A0-03.yaml && grep -q '^status: accepted$' .orchestration/decisions/A0-03.yaml && grep -q '^spec_id: "SPEC-05"$' .orchestration/decisions/A0-03.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: none. **並行可否**: parallel with `A0-01`, `A0-02`, `A0-04`, and `A0-08` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `docs/PRODUCTION_GATEWAY_DESIGN.md`, `docs/INTEGRATION_BOUNDARY.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/requirements.json`, `docs/traceability.json`, `policy/routing.rego`, `policy/tests/routing_test.rego`, `tests/fixtures/policy/spec05_*.json`, `scripts/spec-check.mjs`, `.orchestration/{reports,validation}/A0-03*`, `.agents/worklog/**`.
- **forbidden_actions**: choosing the canonical rule; changing the accepted user decision; leaving contradictory normative text; treating unmarked synthetic text as real evidence; product Gateway edits.
- **実装内容**: apply the accepted A0-03 decision verbatim; designate one normative production rule; mark every conflicting location superseded; define the exact runtime result/evidence semantics for the selected rule; make routing policy reject any state that violates the selected rule or lacks the required synthetic marker.
- **決定を要する点**: **user** chooses `canonical_rule` and `synthetic_evidence_status` in `.orchestration/decisions/A0-03.yaml`. **ワーカー裁量**: none.
- **DoD**:
  - [ ] User decision has the exact accepted SPEC-05 fields and enumerated values — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-decision .orchestration/decisions/A0-03.yaml`; expected exit code: `0`.
  - [ ] Gateway and boundary documents expose one canonical rule and every conflicting paragraph is marked superseded — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-05`; expected exit code: `0`.
  - [ ] Routing policy tests match the accepted decision — command: `./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
  - [ ] Unmarked synthetic output is denied by direct evaluation under either accepted disposition and the loaded policy still permits its positive control — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/spec05_unmarked_synthetic.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["synthetic_output_not_local_non_evidence"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_routing_valid.json 'data.eap.routing.allow = true'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs --check-decision .orchestration/decisions/A0-03.yaml && ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-05 && OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/spec05_unmarked_synthetic.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["synthetic_output_not_local_non_evidence"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_routing_valid.json 'data.eap.routing.allow = true'` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A0-03.md`.
- **想定される逸脱と禁止事項**: inferring the decision from current code, preserving both rules as profile choices, or relabeling fabricated content as a real summary is forbidden.

### WU A0-04 — Define remediation success and one closure predicate

- **WU-ID**: `A0-04`; **Phase**: A0; **対応 SPEC**: `SPEC-06`, `SPEC-07`, `SPEC-09`
- **Preconditions**: command: `test -f docs/SPECIFICATION.md && test -f docs/HYPOTHESIS_LEDGER_SPEC.md && test -f docs/EVIDENCE_GRAPH_SPEC.md && test -f docs/requirements.json`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: none. **並行可否**: parallel with `A0-01`, `A0-02`, `A0-03`, and `A0-08` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `docs/SPECIFICATION.md`, `docs/HYPOTHESIS_LEDGER_SPEC.md`, `docs/EVIDENCE_GRAPH_SPEC.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/FUNCTIONAL_REQUIREMENTS.md`, `docs/requirements.json`, `docs/traceability.json`, `schemas/remediation-closure.schema.json`, `policy/closure.rego`, `policy/tests/closure_test.rego`, `tests/fixtures/policy/closure_*.json`, `scripts/spec-check.mjs`, `.orchestration/{reports,validation}/A0-04*`, `.agents/worklog/**`.
- **forbidden_actions**: evidence-exists closure; aggregate candidate counting; clean rescan without issue-specific proof; per-document competing predicates; repair engine implementation.
- **実装内容**: define one normative `remediation_success` predicate requiring issue-scoped defect removal, required regression checks, clean rescan, per-hypothesis verification, impact evidence, and two distinct candidates per patchable hypothesis; make all three specification documents reference the same schema and policy predicate.
- **決定を要する点**: none. Existing REQ-PATCH-001 and rescan/impact requirements determine the predicate. **ワーカー裁量**: none.
- **DoD**:
  - [ ] All closure documents reference one schema/predicate digest and contain no competing formula — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-06,SPEC-07,SPEC-09`; expected exit code: `0`.
  - [ ] Closure policy tests cover missing issue proof, regression failure, remaining rescan, missing impact, and one-candidate hypotheses — command: `./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
  - [ ] A clean rescan with no issue-specific proof remains open — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/closure.rego --input tests/fixtures/policy/closure_clean_without_issue_proof.json 'not data.eap.closure.closed'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-06,SPEC-07,SPEC-09 && ./node_modules/node/bin/node scripts/opa-test.mjs && OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/closure.rego --input tests/fixtures/policy/closure_clean_without_issue_proof.json 'not data.eap.closure.closed'` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A0-04.md`.
- **想定される逸脱と禁止事項**: changing only one document, counting candidates across hypotheses, or declaring success from test exit alone is forbidden.

### WU A0-05 — Normalize production contracts, outcomes, SLI keys, and negative behavior

- **WU-ID**: `A0-05`; **Phase**: A0; **対応 SPEC**: `SPEC-08`, `SPEC-10`, `SPEC-11`, `SPEC-13`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A0-01.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A0-03.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A0-04.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A0-01`, `A0-03`, `A0-04`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `policy/routing.rego`, `policy/routing.prod.json`, `policy/tests/routing_test.rego`, `tests/fixtures/policy/production_contract_*.json`, `schemas/routing-policy.schema.json`, `schemas/run-outcome.schema.json`, `schemas/telemetry-event.schema.json`, `docs/SLO.md`, `docs/FAILURE_MODE_MATRIX.md`, `docs/PRODUCTION_GATEWAY_DESIGN.md`, `docs/INTEGRATION_BOUNDARY.md`, `docs/requirements.json`, `docs/traceability.json`, `scripts/spec-check.mjs`, `.orchestration/{reports,validation}/A0-05*`, `.agents/worklog/**`.
- **forbidden_actions**: wrapped production JSON without schema conversion; undefined `needs_review`; unusable SLI join key; unspecified audit/telemetry/sandbox failure result; runtime implementation.
- **実装内容**: make production routing JSON match one validated policy schema; define the complete run-outcome enum including `needs_review`; use `audit_id` and `trace_id` as emitted SLI correlation keys with one span name; specify typed fail-closed outcomes for audit sink, telemetry, and sandbox lifecycle evidence failure.
- **決定を要する点**: none. Existing emitted correlation keys and fail-closed requirements determine the normalized contract. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Production routing JSON validates against the schema consumed by routing policy — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-08`; expected exit code: `0`.
  - [ ] SLO query fields, span name, outcome enum, and negative failure rows resolve to emitted schema fields — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-10,SPEC-11,SPEC-13`; expected exit code: `0`.
  - [ ] Routing tests reject the old wrapped production input — command: `./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
  - [ ] Old wrapped production JSON cannot authorize an external route and the loaded policy still permits its positive control — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_wrapped_invalid.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["unknown_route"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_routing_valid.json 'data.eap.routing.allow = true'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-08,SPEC-10,SPEC-11,SPEC-13 && ./node_modules/node/bin/node scripts/opa-test.mjs && OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_wrapped_invalid.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["unknown_route"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_routing_valid.json 'data.eap.routing.allow = true'` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A0-05.md`.
- **想定される逸脱と禁止事項**: adding a compatibility fallback for both JSON shapes, renaming a nonexistent SLI field, or defining `needs_review` only in SLO prose is forbidden.

### WU A0-06 — Define acceptance, HTTP API, and approval-resume lifecycle

- **WU-ID**: `A0-06`; **Phase**: A0; **対応 SPEC**: `SPEC-12`, `SPEC-15`, `SPEC-16`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A0-02.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A0-04.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A0-05.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A0-02`, `A0-04`, `A0-05`. **並行可否**: parallel with `A0-07` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `docs/ORCHESTRATOR_INTERFACE.md`, `docs/INTEGRATION_BOUNDARY.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/openapi.yaml`, `docs/requirements.json`, `docs/traceability.json`, `schemas/acceptance.schema.json`, `schemas/approval-state.schema.json`, `policy/approval.rego`, `policy/tests/approval_test.rego`, `tests/fixtures/policy/approval_*.json`, `scripts/spec-check.mjs`, `.orchestration/{reports,validation}/A0-06*`, `.agents/worklog/**`.
- **forbidden_actions**: prose-only low-risk classification; non-equivalent auto acceptance rules; transient `needs_review` without persisted state; resume without authenticated approver and source binding; HTTP implementation.
- **実装内容**: define one acceptance-tier schema and risk classifier inputs; make both orchestrator documents reference it; define versioned HTTP endpoints, request/response schemas, status codes, and error envelope; define pending approval persistence, authorized decision, expiry, source/evidence binding, resume transition, rejection, and idempotency.
- **決定を要する点**: none. The user-facing auth mechanism remains F1-03; this WU requires verified identity context from A0-02. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Auto acceptance predicates and risk inputs are identical in both normative documents — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-12`; expected exit code: `0`.
  - [ ] OpenAPI and approval schemas cover every supported endpoint, status, error, pending, approve, reject, expire, and resume transition — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-15,SPEC-16`; expected exit code: `0`.
  - [ ] Approval policy tests reject anonymous, foreign-tenant, expired, stale-source, and duplicate resume — command: `./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
  - [ ] An unapproved pending remediation cannot resume — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/approval.rego --input tests/fixtures/policy/approval_unapproved_resume.json 'not data.eap.approval.allow_resume'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-12,SPEC-15,SPEC-16 && ./node_modules/node/bin/node scripts/opa-test.mjs && OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/approval.rego --input tests/fixtures/policy/approval_unapproved_resume.json 'not data.eap.approval.allow_resume'` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A0-06.md`.
- **想定される逸脱と禁止事項**: duplicating acceptance formulas, omitting negative status codes, or treating manual file edits as approval/resume is forbidden.

### WU A0-07 — Normalize tenant persistence, sandbox egress, policy inventory, and terms

- **WU-ID**: `A0-07`; **Phase**: A0; **対応 SPEC**: `SPEC-14`, `SPEC-17`, `SPEC-18`, `SPEC-19`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A0-02.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A0-05.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A0-02`, `A0-05`. **並行可否**: parallel with `A0-06` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `policy/sandbox.rego`, `policy/cc_guard.rego`, `policy/cc_guard_test.rego`, `policy/tests/sandbox_test.rego`, `tests/fixtures/policy/spec17_*.json`, `tests/component/sandbox_policy.test.ts`, `docs/POLICY_MODEL.md`, `docs/INTEGRATION_BOUNDARY.md`, `docs/DATA_GOVERNANCE.md`, `docs/OPERATIONS.md`, `docs/requirements.json`, `docs/traceability.json`, `schemas/persistent-artifact.schema.json`, `scripts/spec-check.mjs`, `.orchestration/{reports,validation}/A0-07*`, `.agents/worklog/**`. Revision `A0-07-R3` permits only the component-test correction defined in `.orchestration/plan/revisions/A0-07-R3-sandbox-negative-fixtures-v1.md`; it does not authorize any policy, schema, source, or fixture edit.
- **forbidden_actions**: shared tenant path without tenant identity; undocumented retention/deletion/DSAR; dead egress or approval outputs; incomplete policy inventory; duplicate normative glossary.
- **実装内容**: specify tenant-scoped ledger/audit/evidence identity, retention, deletion, PII class, DSAR, and access isolation; make sandbox egress allowlist and approval outputs reachable only through explicit authorized rules; inventory cc_guard and its non-tenant command boundary accurately; define one normative glossary and one controlled-resource catalog referenced by every document.
- **決定を要する点**: none. Retention values remain user-owned F1-05; this WU defines required fields and fail-closed behavior. The accepted A0-07 closed-catalog contract supersedes the stale component assertion based on removed `policy_id` / `egress_not_denied` semantics. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Tenant persistence and lifecycle requirements contain identity, isolation, retention, deletion, PII, DSAR, and access controls — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-14`; expected exit code: `0`.
  - [ ] Sandbox egress/approval rules are reachable, tested, and default-deny — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-17 && ./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
  - [ ] Policy inventory and glossary have one canonical entry for cc_guard, governed terms, and controlled resources — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-18,SPEC-19`; expected exit code: `0`.
  - [ ] Unapproved sandbox egress remains denied by direct evaluation — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/sandbox.rego --input tests/fixtures/policy/spec17_unapproved_egress.json 'not data.eap.sandbox.allow'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-14,SPEC-17,SPEC-18,SPEC-19 && ./node_modules/node/bin/node scripts/opa-test.mjs && OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/sandbox.rego --input tests/fixtures/policy/spec17_unapproved_egress.json 'not data.eap.sandbox.allow'` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A0-07.md`.
- **想定される逸脱と禁止事項**: adding an allow rule without tenant/approval proof, claiming cc_guard has tenant semantics, or copying the controlled-resource list into another document is forbidden.

### WU A0-08 — Select the normative requirement abstraction level

- **WU-ID**: `A0-08`; **Phase**: A0; **対応 SPEC**: `SPEC-20`
- **Preconditions**: command: `test -f docs/requirements.json && test -f docs/PRODUCT_REQUIREMENTS.md && test -f .orchestration/decisions/A0-08.yaml && grep -q '^status: accepted$' .orchestration/decisions/A0-08.yaml && grep -q '^spec_id: "SPEC-20"$' .orchestration/decisions/A0-08.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: none. **並行可否**: parallel with `A0-01`, `A0-02`, `A0-03`, and `A0-04` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `docs/PRODUCT_REQUIREMENTS.md`, `docs/FUNCTIONAL_REQUIREMENTS.md`, `docs/DATA_GOVERNANCE.md`, `docs/requirements.json`, `docs/traceability.json`, `policy/conformance.rego`, `policy/tests/conformance_test.rego`, `tests/fixtures/policy/spec20_*.json`, `scripts/spec-check.mjs`, `.orchestration/{reports,validation}/A0-08*`, `.agents/worklog/**`.
- **forbidden_actions**: choosing the abstraction; mixing capability and tool-specific MUST language; preserving superseded requirement text as normative; changing implementation dependencies.
- **実装内容**: apply the accepted A0-08 abstraction verbatim to REQ-PI-001 and REQ-DATA-001; define conformance evidence for the selected abstraction; mark replaced requirement clauses superseded; keep implementation/tool inventory non-normative when the user selects capability-level requirements.
- **決定を要する点**: **user** chooses `requirement_abstraction` and `conformance_evidence` in `.orchestration/decisions/A0-08.yaml`. **ワーカー裁量**: none.
- **DoD**:
  - [ ] User decision has the exact accepted SPEC-20 fields and enumerated value — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-decision .orchestration/decisions/A0-08.yaml`; expected exit code: `0`.
  - [ ] Both requirements use only the accepted abstraction and trace to conformance evidence — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-20`; expected exit code: `0`.
  - [ ] Conformance policy tests cover missing selected evidence and superseded mixed wording — command: `./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
  - [ ] A request missing the user-selected conformance evidence is rejected — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/conformance.rego --input tests/fixtures/policy/spec20_missing_conformance.json 'not data.eap.conformance.satisfied'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs --check-decision .orchestration/decisions/A0-08.yaml && ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-20 && ./node_modules/node/bin/node scripts/opa-test.mjs && OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/conformance.rego --input tests/fixtures/policy/spec20_missing_conformance.json 'not data.eap.conformance.satisfied'` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A0-08.md`.
- **想定される逸脱と禁止事項**: inferring user intent from installed tools, retaining both requirement forms, or weakening conformance to file existence is forbidden.

### WU A0-09 — Enforce a versioned remediation request contract at the HTTP trust boundary

- **WU-ID**: `A0-09`; **Phase**: A0; **対応 GAP**: `GAP-055`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A0-02.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A0-06.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A0-02`, `A0-06`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `schemas/remediation-request.schema.json`, `src/app.ts`, `src/lib/types.ts`, `src/workflows/remediate.ts`, `tests/component/request_contract.test.ts`, `docs/SPECIFICATION.md`, `docs/ORCHESTRATOR_INTERFACE.md`, `docs/requirements.json`, `docs/traceability.json`, `scripts/spec-check.mjs`, `.orchestration/{reports,validation}/A0-09*`, `.agents/worklog/**`.
- **forbidden_actions**: TypeScript-only validation; body-supplied authenticated identity; unknown-field acceptance; unbounded body/workspace/issue values; coercing malformed values; returning stack traces.
- **実装内容**: require `Content-Type: application/json`; define remediation request schema version `1`; cap the raw body at 65,536 bytes; require `workspace` as UTF-8 string length 1..4,096; allow `issue` only as UTF-8 string length 0..8,192; reject every unknown field; require verified identity context from A0-02 instead of body user/tenant authority; reject missing, malformed, oversized, and unsupported-version requests before filesystem, gateway, OPA, sandbox, audit, or ledger side effects; return the A0-06 versioned error envelope and documented HTTP status.
- **決定を要する点**: none. The exact limits are fixed above; changing one requires a plan revision. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Schema and API documentation define required fields, limits, version, error envelope, and identity source — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-15 --check-request-schema schemas/remediation-request.schema.json`; expected exit code: `0`.
  - [ ] Valid request reaches the workflow exactly once — command: `./node_modules/.bin/vitest run tests/component/request_contract.test.ts -t 'accepts one valid versioned request'`; expected exit code: `0`.
  - [ ] Missing, unknown, malformed, oversized, and unsupported-version cases return the documented 4xx and create no audit/ledger/sandbox artifact — command: `./node_modules/.bin/vitest run tests/component/request_contract.test.ts -t 'rejects invalid requests before side effects'`; expected exit code: `0`.
  - [ ] Body-forged user or tenant cannot replace verified identity — command: `./node_modules/.bin/vitest run tests/component/request_contract.test.ts -t 'rejects body identity forgery'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/component/request_contract.test.ts && npm run typecheck && npm run lint` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A0-09.md`.
- **想定される逸脱と禁止事項**: adding a schema file without runtime enforcement, applying defaults to security fields, or logging rejected request bodies is forbidden.

## Phase A — Evidence and release truth

### WU A1-01 — Bind validation evidence to source and a canonical gate manifest

- **WU-ID**: `A1-01`; **Phase**: A; **対応 GAP**: `GAP-034`, `GAP-056`
- **Preconditions**: command: `test -f scripts/validate-release.mjs && test -f scripts/ops-check.mjs && test -f artifacts/validation/final_verification_report.json`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: none. **並行可否**: parallel with `A2-01` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `scripts/validate-release.mjs`, `scripts/ops-check.mjs`, `scripts/validation-manifest.mjs`, `scripts/ci-evidence-check.mjs`, `scripts/run-with-timeout.mjs`, `tests/helpers/loopback-server.ts`, `tests/unit/loopback_server.test.ts`, `tests/unit/validation_manifest.test.ts`, `tests/unit/run_with_timeout.test.ts`, `tests/failure/llm_outage.test.ts`, `tests/contract/llm_contract.test.ts`, `docs/VALIDATION_PLAN.md`, `docs/PRODUCTION_GATES.md`, `RELEASE_MANIFEST.md`, `RELEASE_FILE_MANIFEST.json`, `artifacts/validation/final_verification_report.json`, `.orchestration/{reports,validation}/A1-01*`, `.agents/worklog/**`. Revision `A1-01-R4` authorizes only the four test-lifecycle files named in `.orchestration/plan/revisions/A1-01-R4-loopback-lifecycle-v1.md`; it does not authorize runner, gate, manifest, production, policy, or assertion changes.
- **forbidden_actions**: dependency changes; product runtime changes; deleting shared artifacts; weakening any existing gate; accepting a dirty or mismatched source identity.
- **実装内容**: create one canonical ordered gate manifest; generate `RELEASE_FILE_MANIFEST.json` from the current release file set and reject every missing, extra, or digest-mismatched file; record source revision, source tree digest, dirty state, validation-script digest, gate-manifest digest, and release-file-manifest digest in the final report; make ops-check reject missing, extra, reordered, stale, or mismatched evidence; add a CI evidence checker that binds repository, workflow, job, commit SHA, source-tree digest, and artifact digest.
- **決定を要する点**: A1-01-R3 replaces every GNU-only `timeout` shell dependency in the canonical gate manifest with the exact dependency-free Node runner contract in `.orchestration/plan/revisions/A1-01-R3-timeout-runner-v1.md`; gate names/order, time limits, executable argv, output capture, and fail-closed exit semantics remain bound. A1-01-R4 uses Node 22.19 native listen cancellation to make only the two test loopback fixtures finite and requires literal awaited cleanup at all 13 consumers. **ワーカー裁量**: none beyond those revisions.
- **DoD**:
  - [ ] Canonical manifest contains exactly the commands executed by validate-release — command: `./node_modules/node/bin/node scripts/validation-manifest.mjs --check`; expected exit code: `0`.
  - [ ] A report generated from a changed source file is rejected — command: `./node_modules/.bin/vitest run tests/unit/validation_manifest.test.ts -t 'rejects source drift'`; expected exit code: `0`.
  - [ ] Missing and extra gate names are rejected — command: `./node_modules/.bin/vitest run tests/unit/validation_manifest.test.ts -t 'rejects gate set drift'`; expected exit code: `0`.
  - [ ] Current release files match the generated manifest and a one-byte mutation is rejected — command: `./node_modules/.bin/vitest run tests/unit/validation_manifest.test.ts -t 'verifies release file digests'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/validation_manifest.test.ts` → expected exit code `0`; `[local] ./node_modules/node/bin/node scripts/ops-check.mjs` → expected exit code `0` against freshly generated evidence.
- **証跡パス**: `.orchestration/validation/A1-01.md`, `artifacts/validation/final_verification_report.json`.
- **想定される逸脱と禁止事項**: hard-coded count `25`, timestamp-only freshness, ignored dirty state, or docs-only count edits are forbidden.

### WU A1-02 — Generate and bind E2E artifacts in the same validation run

- **WU-ID**: `A1-02`; **Phase**: A; **対応 GAP**: `GAP-035`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A1-01.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A1-01`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `scripts/validate-release.mjs`, `scripts/assert-e2e-artifacts.mjs`, `scripts/run-flue-workflow.mjs`, `tests/e2e/remediate_e2e.test.ts`, `docs/VALIDATION_PLAN.md`, `docs/PRODUCTION_GATES.md`, `artifacts/{validation,demo,audit,telemetry}/**`, `.orchestration/{reports,validation}/A1-02*`, `.agents/worklog/**`.
- **forbidden_actions**: asserting pre-existing artifacts; accepting timestamps without run ID; skipping E2E on local or CI release validation; modifying fixture defects.
- **実装内容**: allocate a validation run ID; execute deterministic E2E inside the release command; require ledger/audit/trace artifacts to contain that run ID and current source identity; reject stale artifacts before the artifact gate passes.
- **決定を要する点**: none. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Clean validation executes E2E before artifact assertion — command: `./node_modules/node/bin/node scripts/validate-release.mjs`; expected exit code: `0`.
  - [ ] A copied prior-run ledger is rejected — command: `./node_modules/.bin/vitest run tests/e2e/remediate_e2e.test.ts -t 'rejects stale evidence'`; expected exit code: `0`.
  - [ ] Final report and E2E artifacts share one run ID — command: `./node_modules/node/bin/node scripts/assert-e2e-artifacts.mjs --require-current-run`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/validate-release.mjs` → expected exit code `0`; `[requires-ci] ./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/A1-02.run-id --workflow validate-release --job validate-release --require-current-source && gh run view "$(cat .orchestration/validation/A1-02.run-id)" --exit-status` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A1-02.md`, `.orchestration/validation/A1-02.run-id`, `artifacts/validation/final_verification_report.json`.
- **想定される逸脱と禁止事項**: adding another existence-only assertion, retaining stale artifacts, or marking localhost-bind skips as pass is forbidden.

### WU A2-01 — Establish the complete normative requirement and traceability catalog

- **WU-ID**: `A2-01`; **Phase**: A; **対応 GAP**: `GAP-002`, `GAP-038`
- **Preconditions**: command: `test -f docs/SPECIFICATION.md && test -f docs/requirements.json && test -f docs/traceability.json && test -f scripts/spec-check.mjs`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: none. **並行可否**: parallel with `A1-01` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `docs/SPECIFICATION.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/FUNCTIONAL_REQUIREMENTS.md`, `docs/NON_FUNCTIONAL_REQUIREMENTS.md`, `docs/requirements.json`, `docs/traceability.json`, `docs/TRACEABILITY_MATRIX.md`, `scripts/spec-check.mjs`, `tests/unit/spec_check.test.ts`, `tests/e2e/remediate_e2e.test.ts`, `.orchestration/plan/revisions/A2-01-R2-contract.json`, `.orchestration/{reports,validation}/A2-01*`, `.agents/worklog/**`.
- **forbidden_actions**: changing requirement meaning or severity except for the exact A2-01-R1 canonicalization authorized below; deleting IDs; using Markdown line count as semantic proof; linking artifacts that are not generated by a command.
- **実装内容**: make one JSON catalog authoritative for every PR/FR/NFR/REQ/Phase-8 requirement; require unique IDs and implementation, test, gate, and evidence fields; generate or verify the Markdown matrix from the same catalog; reject orphans in both directions.
- **決定を要する点**: A2-01-R4 preserves every R2/R3 tuple and behavior while refreshing only the immutable file-byte digests invalidated by controlled EOF normalization. Apply the exact baseline/contract digests in `.orchestration/plan/revisions/A2-01-R4-v1.md`; A1 revision 2 must then include those two consumed contract files in release source identity. **ワーカー裁量**: none beyond the exact digest substitutions and regression checks.
- **DoD**:
  - [ ] Every normative Markdown ID occurs once in the JSON catalog — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-id-bijection`; expected exit code: `0`.
  - [ ] Every catalog entry names existing implementation, test, gate, and evidence paths — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-evidence-links`; expected exit code: `0`.
  - [ ] Unknown, duplicate, and orphan IDs fail negative fixtures — command: `./node_modules/.bin/vitest run tests/unit/spec_check.test.ts`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs` → expected exit code `0`; `[local] ./node_modules/.bin/vitest run tests/unit/spec_check.test.ts` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A2-01.md`.
- **想定される逸脱と禁止事項**: adding IDs only to the Markdown matrix, preserving the six-line threshold as the acceptance criterion, or marking missing test evidence as planned is forbidden.

### WU A2-02 — Define one release decision formula across local, CI, and process gates

- **WU-ID**: `A2-02`; **Phase**: A; **対応 GAP**: `GAP-006`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A1-01.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A2-01.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A1-01`, `A2-01`. **並行可否**: parallel with `A2-03` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `docs/VALIDATION_PLAN.md`, `docs/PRODUCTION_GATES.md`, `RELEASE_MANIFEST.md`, `scripts/ops-check.mjs`, `scripts/release-decision.mjs`, `tests/unit/release_decision.test.ts`, `.orchestration/{reports,validation}/A2-02*`, `.agents/worklog/**`.
- **forbidden_actions**: treating local validation as sufficient; accepting missing CI/process evidence; parsing free-form prose as a passing machine result.
- **実装内容**: define release acceptance as a machine-readable conjunction of current local report, named CI jobs, and required process records; implement a deterministic evaluator with explicit missing/stale/fail outcomes.
- **決定を要する点**: none. Required CI jobs are `validate-release`, `container-validate`, and `opensandbox-integration`. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Complete fresh local+CI+process fixture returns releasable — command: `./node_modules/.bin/vitest run tests/unit/release_decision.test.ts -t 'accepts complete current evidence'`; expected exit code: `0`.
  - [ ] Each missing, stale, or failed input returns not releasable — command: `./node_modules/.bin/vitest run tests/unit/release_decision.test.ts -t 'rejects incomplete evidence'`; expected exit code: `0`.
  - [ ] All three release documents contain the identical generated formula digest — command: `./node_modules/node/bin/node scripts/release-decision.mjs --check-docs`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/release_decision.test.ts && ./node_modules/node/bin/node scripts/release-decision.mjs --check-formula` → expected exit code `0`; this WU does not require real evidence.
- **証跡パス**: `.orchestration/validation/A2-02.md`.
- **想定される逸脱と禁止事項**: warning-only CI absence, hand-edited duplicated formulas, or acceptance from the word `passed` in prose is forbidden.

### WU A2-03 — Make NFR, telemetry, and failure contracts measurable and internally consistent

- **WU-ID**: `A2-03`; **Phase**: A; **対応 GAP**: `GAP-054`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A2-01.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A2-01`. **並行可否**: parallel with `A2-02` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `docs/SLO.md`, `docs/FAILURE_MODE_MATRIX.md`, `docs/NON_FUNCTIONAL_REQUIREMENTS.md`, `docs/DEPLOYMENT.md`, `docs/RUNBOOK.md`, `docs/requirements.json`, `docs/traceability.json`, `scripts/spec-check.mjs`, `tests/unit/spec_check.test.ts`, `.orchestration/{reports,validation}/A2-03*`, `.agents/worklog/**`.
- **forbidden_actions**: inventing unmeasured achieved targets; mapping two failure rows to one indistinguishable scenario; using bare host Node commands.
- **実装内容**: define authoritative span/event field paths; add latency, availability, RTO, and RPO NFR IDs with units/windows; map sandbox, redaction, telemetry-loss, and ledger-corruption failures to distinct test IDs; normalize operator commands to bundled Node.
- **決定を要する点**: target values are not chosen here; `F1-05.yaml` supplies RTO/RPO and `F1-06.yaml` supplies production SLO targets. Until both are accepted, NFR values are marked `unapproved` and release evaluator rejects Production Ready. **ワーカー裁量**: none.
- **DoD**:
  - [ ] SLO field/query paths match emitted telemetry schema — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-telemetry-schema`; expected exit code: `0`.
  - [ ] Every failure row has one unique test/evidence ID — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-failure-matrix`; expected exit code: `0`.
  - [ ] NFR IDs include latency, availability, RTO, and RPO and occur in traceability JSON — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-nfr-coverage`; expected exit code: `0`.
  - [ ] Operator docs exist and contain no bare `node scripts/` command — command: `test -f docs/DEPLOYMENT.md && test -f docs/OPERATIONS.md && test -f docs/RUNBOOK.md && { rg -n '(^|[ `])node scripts/' docs/DEPLOYMENT.md docs/OPERATIONS.md docs/RUNBOOK.md; rc=$?; test "$rc" -eq 1; }`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs` → expected exit code `0`; `[local] ./node_modules/.bin/vitest run tests/unit/spec_check.test.ts` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/A2-03.md`.
- **想定される逸脱と禁止事項**: setting an unapproved placeholder target, claiming availability without a source, or retaining duplicate LLM failure evidence is forbidden.

## Phase B — Production profile and live LLM path

### WU B1-01 — Create one deployable single-host production profile

- **WU-ID**: `B1-01`; **Phase**: B; **対応 GAP**: `GAP-008`, `GAP-053`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q '^status: passed$' .orchestration/validation/PHASE-A.md && grep -q 'status: accepted' .orchestration/acceptance/A0-02.acceptance.md && test -f .orchestration/decisions/B1-01.yaml && grep -q '^status: accepted$' .orchestration/decisions/B1-01.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-02`, and all Phase A WUs. **並行可否**: parallel with `C1-01` and `D1-01` after Phase A exit is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `scripts/production-{install,start,stop,status}.sh`, `config/production/**`, `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, `docs/RUNBOOK.md`, `docs/SECRETS_MANAGEMENT.md`, `.env.example`, `tests/component/production_profile.test.ts`, `.orchestration/{reports,validation}/B1-01*`, `.agents/worklog/**`.
- **forbidden_actions**: using the validation Dockerfile as production image; defaulting to local provider or local sandbox; embedding secrets; supporting a second production topology.
- **実装内容**: generate service-manager assets from the accepted decision; require `PI_PROVIDER=prod` and `EAP_SANDBOX_RUNTIME=opensandbox`; define install/start/stop/status/rollback commands, service account permissions, localhost bind, log/evidence locations, and startup order.
- **決定を要する点**: user-approved B1-01 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Production config requires both production mode switches and contains no secret values — command: `./node_modules/.bin/vitest run tests/component/production_profile.test.ts -t 'requires governed runtimes'`; expected exit code: `0`.
  - [ ] Install/start/status/stop scripts pass shell syntax and documented command checks — command: `bash -n scripts/production-install.sh scripts/production-start.sh scripts/production-stop.sh scripts/production-status.sh`; expected exit code: `0`.
  - [ ] Operator docs name exact production switches, startup order, stop, and rollback commands — command: `./node_modules/.bin/vitest run tests/component/production_profile.test.ts -t 'matches operator docs'`; expected exit code: `0`.
- **Verification**: `[requires-real-env] scripts/production-install.sh --check && scripts/production-start.sh && scripts/production-status.sh --require-ready && scripts/production-stop.sh` → expected exit code `0`; mock execution is not accepted.
- **証跡パス**: `.orchestration/validation/B1-01.md`, `.orchestration/acceptance/B1-01.acceptance.md`.
- **想定される逸脱と禁止事項**: documenting env switches without service assets, running Flue manually in a shell, or marking validation image smoke as production proof is forbidden.

### WU B1-02 — Commission pinned LiteLLM and lifecycle-managed virtual keys

- **WU-ID**: `B1-02`; **Phase**: B; **対応 GAP**: `GAP-009`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q 'status: accepted' .orchestration/acceptance/A0-03.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A0-05.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/B1-01.acceptance.md && test -f .orchestration/decisions/B1-02.yaml && grep -q '^status: accepted$' .orchestration/decisions/B1-02.yaml && test -n "$ANTHROPIC_API_KEY" && test -n "$LITELLM_MASTER_KEY"`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-03`, `A0-05`, `B1-01`. **並行可否**: parallel with `B2-02` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `config/litellm/**`, `scripts/litellm-{install,start,stop,issue-key,revoke-key,smoke}.sh`, `docs/LITELLM_PROXY.md`, `docs/RUNBOOK.md`, `docs/SECRETS_MANAGEMENT.md`, `tests/component/litellm_commissioning.test.ts`, `.orchestration/{reports,validation}/B1-02*`, `.agents/worklog/**`.
- **forbidden_actions**: committing key values; master key exposure to Gateway/agent; unpinned LiteLLM; unrestricted virtual keys; mock provider as commissioning proof; removing callbacks.
- **実装内容**: pin LiteLLM version/hash; install in the production service environment; start on `127.0.0.1:4000`; issue one Agent Profile virtual key with exact alias/budget/rate limits; run authenticated alias smoke and callback check; revoke the key and prove rejection.
- **決定を要する点**: orchestrator-approved B1-02 decision record; alias set is fixed as `worker-fast,worker-main,worker-heavy`. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Pinned installation and callback import pass — command: `scripts/litellm-install.sh --check && scripts/litellm-start.sh --check-config`; expected exit code: `0`.
  - [ ] Scoped virtual key authenticates approved alias and rejects an unapproved model — command: `scripts/litellm-smoke.sh --profile remediator --assert-scope`; expected exit code: `0`.
  - [ ] Metadata-only callback event contains task/profile/tenant/data-class and no body fields — command: `scripts/litellm-smoke.sh --assert-callback .orchestration/validation/B1-02.callback.jsonl`; expected exit code: `0`.
  - [ ] Revoked key is rejected — command: `scripts/litellm-revoke-key.sh --evidence .orchestration/validation/B1-02-revoke.md`; expected exit code: `0`.
- **Verification**: `[requires-real-env] scripts/litellm-start.sh && scripts/litellm-issue-key.sh --profile remediator --output-ref .orchestration/validation/B1-02.key-ref && scripts/litellm-smoke.sh --profile remediator --assert-scope && scripts/litellm-revoke-key.sh --ref-file .orchestration/validation/B1-02.key-ref` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/B1-02.md`, `.orchestration/validation/B1-02.callback.jsonl`, `.orchestration/validation/B1-02-revoke.md`. Key values are forbidden in evidence.
- **想定される逸脱と禁止事項**: static YAML check, unscoped key, unrevoked test key, or direct Anthropic call bypassing LiteLLM is forbidden.

### WU B1-03 — Make production health, secret custody, and runtime prerequisites executable

- **WU-ID**: `B1-03`; **Phase**: B; **対応 GAP**: `GAP-010`, `GAP-011`, `GAP-014`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q 'status: accepted' .orchestration/acceptance/A0-02.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A0-05.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/B1-02.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-02`, `A0-05`, `B1-02`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `scripts/orchestrator/platform-health.mjs`, `scripts/runtime-preflight.mjs`, `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, `docs/RUNBOOK.md`, `docs/SECRETS_MANAGEMENT.md`, `.env.example`, `tests/unit/orchestrator_fail_closed.test.ts`, `tests/component/runtime_preflight.test.ts`, `.orchestration/{reports,validation}/B1-03*`, `.agents/worklog/**`.
- **forbidden_actions**: HTTP-root-only health; logging secret values; bare host Node; warning-only missing prerequisite; declaring a skipped live check healthy.
- **実装内容**: define process-separated secret inventory; validate bundled Node/Python/OPA/timeout behavior on supported OS; health command authenticates through Gateway and reports each hop; missing proxy/upstream/callback/evidence sink returns nonzero.
- **決定を要する点**: none. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Runtime preflight passes on every supported OS matrix entry — command: `./node_modules/node/bin/node scripts/runtime-preflight.mjs --check-current`; expected exit code: `0`.
  - [ ] Secret inventory contains every consumed secret env and exact process owner with no value — command: `./node_modules/.bin/vitest run tests/component/runtime_preflight.test.ts -t 'validates secret inventory'`; expected exit code: `0`.
  - [ ] Live health traverses Gateway, LiteLLM alias, upstream, callback, and evidence sink — command: `./node_modules/node/bin/node scripts/orchestrator/platform-health.mjs --live --require-all-hops`; expected exit code: `0`.
  - [ ] Each unavailable hop makes health nonzero — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_fail_closed.test.ts -t 'fails each production health hop'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/orchestrator_fail_closed.test.ts tests/component/runtime_preflight.test.ts` → expected exit code `0`; `[requires-real-env] ./node_modules/node/bin/node scripts/orchestrator/platform-health.mjs --live --require-all-hops` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/B1-03.md`.
- **想定される逸脱と禁止事項**: `litellm_live: skip`, unauthenticated GET, incomplete inventory, or documentation without executable preflight is forbidden.

### WU B2-01 — Wire the Flue/Pi remediation workflow to the production Gateway

- **WU-ID**: `B2-01`; **Phase**: B; **対応 GAP**: `GAP-016`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && for id in A0-01 A0-03 A0-05 A0-08 B1-02 B2-02; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-01`, `A0-03`, `A0-05`, `A0-08`, `B1-02`, `B2-02`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `src/agents/remediator.ts`, `src/workflows/remediate.ts`, `src/lib/productionGateway.ts`, `src/lib/types.ts`, `config/litellm/**`, `policy/routing.prod.json`, `tests/contract/llm_contract.test.ts`, `tests/e2e/production_remediate.test.ts`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/TRACEABILITY_MATRIX.md`, `.orchestration/{reports,validation}/B2-01*`, `.agents/worklog/**`.
- **forbidden_actions**: direct agent→LiteLLM/Anthropic call; local gateway in `PI_PROVIDER=prod`; external model authorizing side effects; changing deterministic local validation behavior.
- **実装内容**: register a production Flue/Pi provider that calls the Platform Gateway; choose provider from `PI_PROVIDER`; propagate task/audit/trace/profile/tenant/classification; translate Gateway failure exactly according to the accepted A0-03 contract and never present synthetic output as real evidence; retain local provider only for explicit validation mode.
- **決定を要する点**: accepted user-owned A0-03 decision controls production failure/fallback semantics. **ワーカー裁量**: none.
- **DoD**:
  - [ ] `PI_PROVIDER=prod` workflow sends one summarized request through Platform Gateway and no local-gateway request — command: `./node_modules/.bin/vitest run tests/e2e/production_remediate.test.ts -t 'uses production provider path'`; expected exit code: `0`.
  - [ ] Production outage result matches A0-03 and never labels synthetic output as real — command: `./node_modules/.bin/vitest run tests/e2e/production_remediate.test.ts -t 'enforces accepted production fallback contract'`; expected exit code: `0`.
  - [ ] `PI_PROVIDER=local` deterministic release path remains green — command: `PI_PROVIDER=local ./node_modules/.bin/vitest run tests/e2e/remediate_e2e.test.ts`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/contract/llm_contract.test.ts tests/e2e/production_remediate.test.ts tests/e2e/remediate_e2e.test.ts` → expected exit code `0`; real provider proof belongs only to B2-04.
- **証跡パス**: `.orchestration/validation/B2-01.md`.
- **想定される逸脱と禁止事項**: calling `callProductionGateway` only from a test, adding another mock-only adapter, or returning local placeholder as model success is forbidden.

### WU B2-02 — Enforce production-grade outbound redaction

- **WU-ID**: `B2-02`; **Phase**: B; **対応 GAP**: `GAP-047`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q '^status: passed$' .orchestration/validation/PHASE-A.md && grep -q 'status: accepted' .orchestration/acceptance/A0-01.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A0-05.acceptance.md && test -f docs/INTEGRATION_BOUNDARY.md && test -f .orchestration/decisions/B2-02.yaml && grep -q '^status: accepted$' .orchestration/decisions/B2-02.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-01`, `A0-05`, and Phase A exit. **並行可否**: parallel with `B1-02` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `scripts/data_guard.py`, `src/lib/dataProxy.ts`, `src/lib/productionGateway.ts`, `src/lib/types.ts`, `tests_py/test_data_guard.py`, `tests/contract/llm_contract.test.ts`, `docs/DATA_GOVERNANCE.md`, `docs/INTEGRATION_BOUNDARY.md`, `.orchestration/{reports,validation}/B2-02*`, `.agents/worklog/**`.
- **forbidden_actions**: literal person allowlist; US-only production coverage; sending confidential/restricted data when recognizer confidence is insufficient; downloading an unapproved model.
- **実装内容**: load the accepted corpus path and supported locales; use deterministic built-ins plus the accepted PERSON recognizer; redact every recognized entity at or above `minimum_confidence`; deny confidential/restricted dispatch when any expected entity is unresolved, below threshold, or the recognizer is unavailable; require every corpus case to declare exactly one expected outcome, `redacted` or `denied`.
- **決定を要する点**: user-approved B2-02 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Every multilingual corpus case equals its declared redacted or denied outcome — command: `.venv/bin/python -m pytest -q tests_py/test_data_guard.py -k 'production_redaction_corpus'`; expected exit code: `0`.
  - [ ] Recognizer unavailable blocks confidential/restricted dispatch — command: `./node_modules/.bin/vitest run tests/contract/llm_contract.test.ts -t 'blocks uncertain restricted redaction'`; expected exit code: `0`.
  - [ ] Captured outbound requests contain none of the adversarial corpus values — command: `./node_modules/.bin/vitest run tests/contract/llm_contract.test.ts -t 'redacts production corpus before dispatch'`; expected exit code: `0`.
- **Verification**: `[local] .venv/bin/python -m pytest -q tests_py/test_data_guard.py && ./node_modules/.bin/vitest run tests/contract/llm_contract.test.ts` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/B2-02.md`.
- **想定される逸脱と禁止事項**: adding fixture names, lowering classification, or accepting partial redaction because a mock request succeeded is forbidden.

### WU B2-03 — Make Gateway result, fallback, and failure evidence unambiguous

- **WU-ID**: `B2-03`; **Phase**: B; **対応 GAP**: `GAP-025`, `GAP-026`, `GAP-050`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && for id in A0-03 A0-05 B2-01 B2-02; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-03`, `A0-05`, `B2-01`, `B2-02`. **並行可否**: parallel with `C1-02` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `src/lib/productionGateway.ts`, `src/lib/router.ts`, `src/lib/types.ts`, `src/lib/audit.ts`, `src/lib/telemetry.ts`, `policy/routing.json`, `policy/routing.prod.json`, `tests/contract/llm_contract.test.ts`, `tests/failure/llm_outage.test.ts`, `.orchestration/{reports,validation}/B2-03*`, `.agents/worklog/**`.
- **forbidden_actions**: empty catch; behavior that contradicts A0-03; unmarked synthetic production result; NaN/empty content success; duplicate target attempt; secret/error-body logging.
- **実装内容**: validate provider response schema and finite usage/cost; deduplicate ordered attempts; continue or stop on secret/config failure exactly as policy states; record sanitized attempt failure spans/audit; implement the exact A0-03 fallback disposition and synthetic evidence status.
- **決定を要する点**: accepted user-owned A0-03 decision controls deterministic-fallback behavior. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Malformed content/usage/cost becomes typed failure or next approved fallback — command: `./node_modules/.bin/vitest run tests/contract/llm_contract.test.ts -t 'rejects malformed provider response'`; expected exit code: `0`.
  - [ ] Default route attempts each provider/model/mode tuple once — command: `./node_modules/.bin/vitest run tests/contract/llm_contract.test.ts -t 'deduplicates route attempts'`; expected exit code: `0`.
  - [ ] Every failed attempt emits one body-free ERROR span and audit event — command: `./node_modules/.bin/vitest run tests/failure/llm_outage.test.ts -t 'records sanitized attempt failures'`; expected exit code: `0`.
  - [ ] Production config and results enforce the accepted SPEC-05 disposition — command: `./node_modules/.bin/vitest run tests/contract/llm_contract.test.ts -t 'enforces accepted synthetic production contract'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/contract/llm_contract.test.ts tests/failure/llm_outage.test.ts` → expected exit code `0` within `120` seconds.
- **証跡パス**: `.orchestration/validation/B2-03.md`.
- **想定される逸脱と禁止事項**: hard-coding either SPEC-05 outcome, swallowing provider exceptions, relabeling placeholder output, or retrying the same target to make a flaky test pass is forbidden.

### WU B2-04 — Bound child processes and prove the live production LLM path

- **WU-ID**: `B2-04`; **Phase**: B; **対応 GAP**: `GAP-027`, `GAP-037`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && for id in A0-03 A0-05 B1-03 B2-03; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done && test -n "$LITELLM_VIRTUAL_KEY"`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-03`, `A0-05`, `B1-03`, `B2-03`. **並行可否**: parallel with none; every parallel pairing is forbidden; this WU has exclusive access to the production smoke profile.
- **allowed_files**: `src/lib/dataProxy.ts`, `src/lib/opa.ts`, `src/lib/productionGateway.ts`, `scripts/live-llm-smoke.mjs`, `tests/component/data_proxy.test.ts`, `tests/component/opa.test.ts`, `tests/failure/llm_outage.test.ts`, `docs/RUNBOOK.md`, `docs/PRODUCTION_GATES.md`, `.orchestration/{reports,validation}/B2-04*`, `.agents/worklog/**`.
- **forbidden_actions**: mock substitution; local gateway fallback; unbounded subprocess; raw prompt/key evidence; live smoke from a developer credential outside the approved environment.
- **実装内容**: add timeout/input/output/cleanup bounds to Python and OPA calls; create one real-environment smoke through Flue→Gateway→LiteLLM→approved Anthropic model; verify redaction, metadata, usage/cost, callback, and outage behavior against the accepted A0-03 contract without real/synthetic ambiguity.
- **決定を要する点**: accepted user-owned A0-03 decision controls outage fallback/result semantics; approved profile and aliases come from B1-02 evidence. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Python and OPA hang/oversize tests terminate within configured limits and leave no temp directory — command: `./node_modules/.bin/vitest run tests/component/data_proxy.test.ts tests/component/opa.test.ts -t 'bounded'`; expected exit code: `0`.
  - [ ] Live redacted inference returns non-synthetic content and complete task/usage/cost metadata — command: `./node_modules/node/bin/node scripts/live-llm-smoke.mjs --mode success --evidence .orchestration/validation/B2-04-live.json`; expected exit code: `0`.
  - [ ] Proxy/upstream outage matches A0-03 and produces no unmarked synthetic success — command: `./node_modules/node/bin/node scripts/live-llm-smoke.mjs --mode outage --decision .orchestration/decisions/A0-03.yaml --evidence .orchestration/validation/B2-04-outage.json`; expected exit code: `0`.
  - [ ] Both evidence files exist and contain no prompt, response body, or key pattern — command: `test -f .orchestration/validation/B2-04-live.json && test -f .orchestration/validation/B2-04-outage.json && { rg -n '(ANTHROPIC_API_KEY|LITELLM_VIRTUAL_KEY|messages|prompt|response|content)' .orchestration/validation/B2-04-live.json .orchestration/validation/B2-04-outage.json; rc=$?; test "$rc" -eq 1; }`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/component/data_proxy.test.ts tests/component/opa.test.ts tests/failure/llm_outage.test.ts` → expected exit code `0`; `[requires-real-env]` both live-smoke commands above → expected exit code `0`. Mock results are rejected.
- **証跡パス**: `.orchestration/validation/B2-04.md`, `.orchestration/validation/B2-04-live.json`, `.orchestration/validation/B2-04-outage.json`.
- **想定される逸脱と禁止事項**: localhost mock, recorded fixture response, redacted body copied into evidence, or timeout test that waits for the test-runner limit is forbidden.

## Phase C — OpenSandbox remediation isolation

### WU C1-01 — Move the complete remediation filesystem flow behind SandboxExecutor

- **WU-ID**: `C1-01`; **Phase**: C; **対応 GAP**: `GAP-017`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q '^status: passed$' .orchestration/validation/PHASE-A.md && for id in A0-04 A0-05 A0-07; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-04`, `A0-05`, `A0-07`, and Phase A exit. **並行可否**: parallel with `B1-01` and `D1-01` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `src/workflows/remediate.ts`, `src/lib/sandbox.ts`, `src/lib/sandboxOpenSandbox.ts`, `src/lib/code.ts`, `src/lib/types.ts`, `tests/component/sandbox_executor.test.ts`, `tests/e2e/opensandbox_remediate.test.ts`, `.github/workflows/validate-release.yml`, `docs/SANDBOX_INTEGRATION_DESIGN.md`, `docs/TRACEABILITY_MATRIX.md`, `.orchestration/{reports,validation}/C1-01*`, `.agents/worklog/**`.
- **forbidden_actions**: treating remote handle ID as host path; host read/write/scan/patch after OpenSandbox create; host `.venv` path inside remote command; unpinned or `sha256:local` image in OpenSandbox mode.
- **実装内容**: extend `SandboxExecutor` with typed `putWorkspace`, `exec`, `readArtifacts`, and `destroy` operations; implement scan and patch as remote commands through those operations; use `/workspace` semantics only inside the executor; select the pinned OpenSandbox image; execute scan, patch, pytest, rescan, collect, and destroy remotely.
- **決定を要する点**: none. Use the existing pinned OpenSandbox code-interpreter image and existing three repair classes until D1-01 changes the repair engine. **ワーカー裁量**: none.
- **DoD**:
  - [ ] OpenSandbox remediation uses no host-path helper after sandbox creation — command: `./node_modules/.bin/vitest run tests/e2e/opensandbox_remediate.test.ts -t 'keeps all workspace operations remote'`; expected exit code: `0`.
  - [ ] Remote command uses an interpreter path present in the pinned image — command: `./node_modules/.bin/vitest run tests/e2e/opensandbox_remediate.test.ts -t 'uses sandbox interpreter'`; expected exit code: `0`.
  - [ ] create→put→scan→patch→verify→rescan→collect→destroy audit sequence is complete — command: `./node_modules/.bin/vitest run tests/e2e/opensandbox_remediate.test.ts -t 'records full lifecycle'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/component/sandbox_executor.test.ts` → expected exit code `0`; `[requires-ci] ./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/C1-01.run-id --workflow validate-release --job opensandbox-integration --require-current-source && gh run view "$(cat .orchestration/validation/C1-01.run-id)" --exit-status` → expected exit code `0`. The named CI job must run `EAP_SANDBOX_RUNTIME=opensandbox ./node_modules/.bin/vitest run tests/e2e/opensandbox_remediate.test.ts`; local execution is not CI evidence.
- **証跡パス**: `.orchestration/validation/C1-01.md`, `.orchestration/validation/C1-01.run-id`.
- **想定される逸脱と禁止事項**: copying remote files back to host for scan/patch, calling host `scanWorkspace`, or testing only executor primitives is forbidden.

### WU C1-02 — Enforce production OpenSandbox, tenant binding, and bounded workspace ingestion

- **WU-ID**: `C1-02`; **Phase**: C; **対応 GAP**: `GAP-019`, `GAP-020`, `GAP-049`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && for id in A0-02 A0-07 C1-01; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done && test -f .orchestration/decisions/C1-02.yaml && grep -q '^status: accepted$' .orchestration/decisions/C1-02.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-02`, `A0-07`, `C1-01`. **並行可否**: parallel with `B2-03` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `src/workflows/remediate.ts`, `src/lib/sandbox.ts`, `src/lib/sandboxOpenSandbox.ts`, `src/lib/code.ts`, `src/lib/types.ts`, `policy/sandbox.rego`, `policy/tests/sandbox_test.rego`, `tests/component/sandbox_executor.test.ts`, `tests/component/sandbox_policy.test.ts`, `tests/security/workspace_ingest.test.ts`, `docs/SANDBOX_INTEGRATION_DESIGN.md`, `.orchestration/{reports,validation}/C1-02*`, `.agents/worklog/**`.
- **forbidden_actions**: production local executor; implicit tenant `acme`; following symlinks outside root; unlimited files/bytes/depth; passing host environment wholesale.
- **実装内容**: require production mode to select OpenSandbox; pass validated request tenant into sandbox policy; remove tenant default; use `lstat` and realpath confinement; reject symlinks escaping root; enforce the exact `max_files`, `max_total_bytes`, `max_depth`, and `excluded_names` values in the accepted C1-02 decision record.
- **決定を要する点**: orchestrator-approved C1-02 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Production mode rejects local runtime and missing OpenSandbox endpoint — command: `./node_modules/.bin/vitest run tests/component/sandbox_executor.test.ts -t 'requires opensandbox in production'`; expected exit code: `0`.
  - [ ] Missing or mismatched request tenant denies sandbox create — command: `./node_modules/.bin/vitest run tests/component/sandbox_policy.test.ts -t 'requires request tenant'`; expected exit code: `0`.
  - [ ] Escaping symlink and over-limit trees are rejected before file transfer — command: `./node_modules/.bin/vitest run tests/security/workspace_ingest.test.ts`; expected exit code: `0`.
  - [ ] Host-only secret is absent from local validation and OpenSandbox command environments — command: `./node_modules/.bin/vitest run tests/component/sandbox_executor.test.ts -t 'does not inherit host environment'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/component/sandbox_executor.test.ts tests/component/sandbox_policy.test.ts tests/security/workspace_ingest.test.ts && ./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/C1-02.md`.
- **想定される逸脱と禁止事項**: audit-only network/limit fields, fixture-only path tests, or a default tenant retained for convenience is forbidden.

### WU C2-01 — Prove full OpenSandbox remediation and egress policy in CI

- **WU-ID**: `C2-01`; **Phase**: C; **対応 GAP**: `GAP-036`, `GAP-052`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q 'status: accepted' .orchestration/acceptance/A0-07.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/C1-02.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-07`, `C1-02`. **並行可否**: parallel with none; every parallel pairing is forbidden; this WU has exclusive access to the OpenSandbox CI job definition.
- **allowed_files**: `.github/workflows/validate-release.yml`, `tests/integration/opensandbox.test.ts`, `tests/e2e/opensandbox_remediate.test.ts`, `scripts/opensandbox-ci-assert.mjs`, `docs/VALIDATION_PLAN.md`, `docs/PRODUCTION_GATES.md`, `.orchestration/{reports,validation}/C2-01*`, `.agents/worklog/**`.
- **forbidden_actions**: executor-only acceptance; external public URL as sole egress oracle; skipped integration suite; unpinned server/image; rerun-only flake acceptance.
- **実装内容**: add one full remediation test to the pinned CI job; start a controlled reachable endpoint inside the CI network; prove allow profile reaches it and deny profile fails with policy/network-specific evidence; assert cleanup and audit completeness.
- **決定を要する点**: none. Controlled endpoint is a job-local HTTP server with fixed response `opensandbox-egress-control-ok`. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Full OpenSandbox remediation closes all supported hypotheses and records remote lifecycle — command: `EAP_SANDBOX_RUNTIME=opensandbox ./node_modules/.bin/vitest run tests/e2e/opensandbox_remediate.test.ts`; expected exit code: `0`.
  - [ ] Positive control reaches the job-local endpoint and deny profile cannot connect — command: `EAP_SANDBOX_RUNTIME=opensandbox ./node_modules/.bin/vitest run tests/integration/opensandbox.test.ts -t 'proves egress policy with positive control'`; expected exit code: `0`.
  - [ ] CI evidence has no skipped OpenSandbox test and contains destroy event — command: `./node_modules/node/bin/node scripts/opensandbox-ci-assert.mjs .orchestration/validation/C2-01-ci-artifacts`; expected exit code: `0`.
  - [ ] Required CI job is green and bound to the current source/artifact digest — command: `./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/C2-01.run-id --workflow validate-release --job opensandbox-integration --require-current-source && gh run view "$(cat .orchestration/validation/C2-01.run-id)" --exit-status`; expected exit code: `0`.
- **Verification**: `[requires-ci]` execute the four DoD commands in the pinned GitHub Actions job; every expected exit code is `0`. Local/mock substitution is rejected.
- **証跡パス**: `.orchestration/validation/C2-01.md`, `.orchestration/validation/C2-01.run-id`, `.orchestration/validation/C2-01-ci-artifacts/`.
- **想定される逸脱と禁止事項**: DNS failure as deny proof, `skipIf` acceptance, or direct executor tests without workflow execution is forbidden.

## Phase D — Repair correctness and anti-overfit validation

### WU D1-01 — Generalize the supported repair engine and reject unsupported work

- **WU-ID**: `D1-01`; **Phase**: D; **対応 GAP**: `GAP-021`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q '^status: passed$' .orchestration/validation/PHASE-A.md && grep -q 'status: accepted' .orchestration/acceptance/A0-04.acceptance.md && test -f docs/PRODUCT_REQUIREMENTS.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-04`, and Phase A exit. **並行可否**: parallel with `B1-01` and `C1-01` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `src/lib/code.ts`, `src/lib/types.ts`, `src/workflows/remediate.ts`, `scripts/repair_ast.py`, `tests/component/code.test.ts`, `tests/e2e/remediate_e2e.test.ts`, `tests/fixtures/repair/**`, `sample_repos/**`, `docs/FUNCTIONAL_REQUIREMENTS.md`, `docs/PRODUCT_REQUIREMENTS.md`, `docs/AGENT_LOOP_SPEC.md`, `.orchestration/{reports,validation}/D1-01*`, `.agents/worklog/**`.
- **forbidden_actions**: exact function-body string replacement; ignored `issue`; claiming arbitrary-code repair; adding repair classes beyond the three accepted classes; changing fixtures to match patch templates.
- **実装内容**: define production v1 scope as Python 3 and exactly three classes: zero-divisor guard, validated non-negative integer parse, missing dictionary key guard; localize AST node/file/line/symbol; bind candidates to issue-selected hypotheses; transform supported variants through Python standard-library AST or position-aware edits; return typed `unsupported` when no supported class matches.
- **決定を要する点**: none. Scope is fixed above. **ワーカー裁量**: none.
- **DoD**:
  - [ ] At least five syntax/name variants per repair class localize and repair without exact fixture strings — command: `.venv/bin/python -m pytest -q tests/fixtures/repair`; expected exit code: `0`.
  - [ ] Issue scope selects only referenced supported hypotheses — command: `./node_modules/.bin/vitest run tests/component/code.test.ts -t 'respects issue scope'`; expected exit code: `0`.
  - [ ] Unsupported language/pattern returns typed `unsupported` with zero file changes — command: `./node_modules/.bin/vitest run tests/component/code.test.ts -t 'rejects unsupported repair'`; expected exit code: `0`.
  - [ ] Held-out repository source is unchanged and copied workspace closes — command: `./node_modules/.bin/vitest run tests/component/code.test.ts -t 'repairs held-out variants without source edits'`; expected exit code: `0`.
- **Verification**: `[local] .venv/bin/python -m pytest -q tests/fixtures/repair && ./node_modules/.bin/vitest run tests/component/code.test.ts tests/e2e/remediate_e2e.test.ts`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/D1-01.md`.
- **想定される逸脱と禁止事項**: adding more `.replace()` templates, allowing unsupported work to return passed, or editing the held-out fixture to fit the implementation is forbidden.

### WU D1-02 — Make hypothesis identity, closure, and data guards complete

- **WU-ID**: `D1-02`; **Phase**: D; **対応 GAP**: `GAP-022`, `GAP-023`, `GAP-024`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q 'status: accepted' .orchestration/acceptance/A0-04.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/D1-01.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-04`, `D1-01`. **並行可否**: parallel with `F1-01` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `src/lib/code.ts`, `src/lib/ledger.ts`, `src/lib/types.ts`, `src/workflows/remediate.ts`, `scripts/data_guard.py`, `tests/unit/ledger.test.ts`, `tests/component/code.test.ts`, `tests/component/data_proxy.test.ts`, `tests/regression/regression_closure.test.ts`, `tests_py/test_data_guard.py`, `docs/HYPOTHESIS_LEDGER_SPEC.md`, `docs/EVIDENCE_GRAPH_SPEC.md`, `.orchestration/{reports,validation}/D1-02*`, `.agents/worklog/**`.
- **forbidden_actions**: defect-class-only IDs; marking all hypotheses verified from one global test; closing before rescan; dropping data-guard flags at the TypeScript boundary.
- **実装内容**: derive stable unique IDs from class+relative file+location; associate patch and checks per hypothesis; require each `requiredChecks` result and clean rescan before verified; require impact evidence; extend DataQueryResult and closure status to every Python guard flag.
- **決定を要する点**: none. ID digest is SHA-256 truncated to 16 lowercase hex characters after the readable class prefix. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Same defect class in two files produces distinct stable IDs and independent patch state — command: `./node_modules/.bin/vitest run tests/component/code.test.ts -t 'uses unique location identity'`; expected exit code: `0`.
  - [ ] Passing pytest with remaining rescan finding keeps closure false — command: `./node_modules/.bin/vitest run tests/regression/regression_closure.test.ts -t 'keeps rescan findings open'`; expected exit code: `0`.
  - [ ] Missing impact or any required check keeps closure false — command: `./node_modules/.bin/vitest run tests/unit/ledger.test.ts -t 'requires per-hypothesis evidence'`; expected exit code: `0`.
  - [ ] All Python guard booleans cross the TS boundary and participate in pass status — command: `./node_modules/.bin/vitest run tests/component/data_proxy.test.ts -t 'requires every data guard invariant'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/ledger.test.ts tests/component/code.test.ts tests/component/data_proxy.test.ts tests/regression/regression_closure.test.ts && .venv/bin/python -m pytest -q tests_py/test_data_guard.py`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/D1-02.md`.
- **想定される逸脱と禁止事項**: adding a final-status workaround while ledger remains closed, count-only patch sufficiency, or non-mandatory data flags is forbidden.

### WU D2-01 — Add policy-deny workflow E2E and a truthful verifier failure test

- **WU-ID**: `D2-01`; **Phase**: D; **対応 GAP**: `GAP-039`, `GAP-041`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && for id in A0-04 A0-05 A0-06 D1-02; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-04`, `A0-05`, `A0-06`, `D1-02`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `tests/e2e/remediate_e2e.test.ts`, `tests/component/code.test.ts`, `scripts/run-flue-workflow.mjs`, `sample_repos/**`, `docs/TRACEABILITY_MATRIX.md`, `.orchestration/{reports,validation}/D2-01*`, `.agents/worklog/**`.
- **forbidden_actions**: testing OPA adapter only; using an empty directory as unpatched fixture; changing production code; accepting source mutation.
- **実装内容**: add one guest/cross-tenant workflow E2E that asserts needs_review, source hash unchanged, patch/verify/data absent, and policy audit present; fix verifier test to run against the actual unpatched copied fixture and assert the named failing test.
- **決定を要する点**: none. Negative E2E uses guest user and tenant `acme`. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Guest workflow returns needs_review and performs zero patch/verify/data operations — command: `./node_modules/.bin/vitest run tests/e2e/remediate_e2e.test.ts -t 'denies guest without side effects'`; expected exit code: `0`.
  - [ ] Source fixture digest is identical before and after denied workflow — command: `./node_modules/.bin/vitest run tests/e2e/remediate_e2e.test.ts -t 'preserves denied source'`; expected exit code: `0`.
  - [ ] Unpatched copied fixture fails its named regression tests — command: `./node_modules/.bin/vitest run tests/component/code.test.ts -t 'fails verification on unpatched fixture'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/e2e/remediate_e2e.test.ts tests/component/code.test.ts`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/D2-01.md`.
- **想定される逸脱と禁止事項**: asserting only status text, using a mock policy decision without workflow execution, or accepting pytest “no tests collected” as defect detection is forbidden.

### WU D2-02 — Gate critical TypeScript branches and full held-out E2E

- **WU-ID**: `D2-02`; **Phase**: D; **対応 GAP**: `GAP-040`, `GAP-043`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q 'status: accepted' .orchestration/acceptance/A0-04.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/D2-01.acceptance.md && test -f .orchestration/decisions/D2-02.yaml && grep -q '^status: accepted$' .orchestration/decisions/D2-02.yaml && grep -q 'approved_dependency: "@vitest/coverage-v8@4.1.9"' .orchestration/decisions/D2-02.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-04`, `D2-01`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `package.json`, `package-lock.json`, `vitest.config.ts`, `scripts/validate-release.mjs`, `tests/**`, `docs/VALIDATION_PLAN.md`, `docs/PRODUCTION_GATES.md`, `.github/workflows/validate-release.yml`, `.orchestration/{reports,validation}/D2-02*`, `.agents/worklog/**`.
- **forbidden_actions**: dependency addition other than exact `@vitest/coverage-v8@4.1.9`; repository-wide percentage target without critical-file floors; excluding uncovered trust-boundary files; component-only held-out acceptance; snapshot-only assertions.
- **実装内容**: add exact devDependency `@vitest/coverage-v8@4.1.9`; set explicit branch floors for productionGateway/router/sandbox/workflow/orchestrator; add missing negative cases; run full held-out Flue workflow in a release-adjacent CI job required for tag/release acceptance.
- **決定を要する点**: user-approved D2-02 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Critical-file branch floors pass and are listed in config — command: `./node_modules/.bin/vitest run --coverage`; expected exit code: `0`.
  - [ ] Removing one trust-boundary negative test makes the coverage fixture fail — command: `./node_modules/.bin/vitest run tests/unit/coverage_gate.test.ts -t 'rejects missing critical branch'`; expected exit code: `0`.
  - [ ] Full held-out Flue workflow passes with fresh ledger/audit/trace evidence — command: `npm run flue:e2e:heldout`; expected exit code: `0`.
  - [ ] Release-adjacent held-out CI job is green and bound to the current source/artifact digest — command: `./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/D2-02.run-id --workflow heldout-remediation --job heldout-remediation --require-current-source && gh run view "$(cat .orchestration/validation/D2-02.run-id)" --exit-status`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run --coverage && npm run flue:e2e:heldout`; expected exit code `0`; `[requires-ci] ./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/D2-02.run-id --workflow heldout-remediation --job heldout-remediation --require-current-source && gh run view "$(cat .orchestration/validation/D2-02.run-id)" --exit-status` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/D2-02.md`, `.orchestration/validation/D2-02.run-id`.
- **想定される逸脱と禁止事項**: lowering floors to current uncovered values without tests, excluding held-out execution, or reusing primary fixture artifacts is forbidden.

## Phase E — Governed real-data analysis

### WU E1-01 — Add a tenant-bound production datasource and governed query contract

- **WU-ID**: `E1-01`; **Phase**: E; **対応 GAP**: `GAP-018`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && for id in A0-01 A0-02 A0-05 A0-07 A0-08 A2-01 B1-03 C1-02; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done && test -f .orchestration/decisions/E1-01.yaml && grep -q '^status: accepted$' .orchestration/decisions/E1-01.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-01`, `A0-02`, `A0-05`, `A0-07`, `A0-08`, `A2-01`, `B1-03`, `C1-02`. **並行可否**: parallel with none; every parallel pairing is forbidden; this WU has exclusive access to the approved staging datasource.
- **allowed_files**: `scripts/data_guard.py`, `scripts/data-evidence-check.mjs`, `src/lib/dataProxy.ts`, `src/lib/types.ts`, `src/workflows/remediate.ts`, `policy/data.rego`, `policy/tests/data_test.rego`, `config/data/**`, `tests_py/test_data_guard.py`, `tests/integration/governed_data.test.ts`, `docs/DATA_GOVERNANCE.md`, `docs/SECRETS_MANAGEMENT.md`, `docs/TRACEABILITY_MATRIX.md`, `.orchestration/{reports,validation}/E1-01*`, `.agents/worklog/**`.
- **forbidden_actions**: hard-coded customer rows in production adapter; raw SQL agent tool; shared cross-tenant credentials; raw row evidence; production/customer data in tests; mock datasource as real-env proof.
- **実装内容**: define typed request with tenant, metric ID, parameters, datasource identity, audit/trace IDs, and the accepted row/time/cost budgets; map approved metrics to parameterized aggregate SQL; authorize tenant/datasource/schema through OPA; enforce the three budgets before and during execution with typed `query_budget_exceeded`; inject datasource credentials only into data service; retain fixed fixture solely for deterministic local tests.
- **決定を要する点**: user-approved E1-01 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Typed contract rejects raw SQL, unknown metric, unknown datasource, and tenant mismatch — command: `./node_modules/.bin/vitest run tests/integration/governed_data.test.ts -t 'rejects ungoverned requests'`; expected exit code: `0`.
  - [ ] Approved staging metric returns aggregate rows with no raw PII and complete audit IDs — command: `./node_modules/.bin/vitest run tests/integration/governed_data.test.ts -t 'queries approved staging metric'`; expected exit code: `0`.
  - [ ] Cross-tenant and forbidden-column attempts produce zero datasource execution — command: `./node_modules/node/bin/node scripts/opa-test.mjs && .venv/bin/python -m pytest -q tests_py/test_data_guard.py -k 'production_datasource'`; expected exit code: `0`.
  - [ ] Row, timeout, and cost budget overruns terminate with `query_budget_exceeded` and no raw-row evidence — command: `./node_modules/.bin/vitest run tests/integration/governed_data.test.ts -t 'enforces query budgets'`; expected exit code: `0`.
  - [ ] Evidence contains only schema/count/digest metadata and no row values — command: `./node_modules/node/bin/node scripts/data-evidence-check.mjs .orchestration/validation/E1-01-real.json`; expected exit code: `0`.
- **Verification**: `[local] .venv/bin/python -m pytest -q tests_py/test_data_guard.py && ./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code `0`; `[requires-real-env] EAP_DATA_PROFILE=staging ./node_modules/.bin/vitest run tests/integration/governed_data.test.ts` → expected exit code `0`. Mock substitution is rejected.
- **証跡パス**: `.orchestration/validation/E1-01.md`, `.orchestration/validation/E1-01-real.json`.
- **想定される逸脱と禁止事項**: replacing fixture rows with another fixture, exposing a SQL string field to the agent, or logging sample records is forbidden.

## Phase F — Evidence durability, service safety, and orchestrator fail-closed controls

### WU F1-01 — Make run evidence scoped, atomic, terminal, and resumable

- **WU-ID**: `F1-01`; **Phase**: F; **対応 GAP**: `GAP-007`, `GAP-028`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A1-01.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A2-01.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A1-01`, `A2-01`. **並行可否**: parallel with `D1-02` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `src/workflows/remediate.ts`, `src/lib/ledger.ts`, `src/lib/audit.ts`, `src/lib/telemetry.ts`, `src/lib/types.ts`, `tests/unit/ledger.test.ts`, `tests/e2e/remediate_e2e.test.ts`, `tests/failure/run_lifecycle.test.ts`, `docs/HYPOTHESIS_LEDGER_SPEC.md`, `docs/OPERATIONS.md`, `.orchestration/{reports,validation}/F1-01*`, `.agents/worklog/**`.
- **forbidden_actions**: fixed shared ledger path; raw payload audit; missing terminal event; overwrite-on-resume; timestamp-only run ID; partial JSON accepted as valid.
- **実装内容**: allocate collision-resistant run ID; write ledger/audit/trace under run-scoped directory; redact/digest request metadata; perform atomic ledger replace; emit exactly one terminal event for passed/failed/blocked; define resume token and reject mismatched source/policy version.
- **決定を要する点**: none. Run ID uses platform workflow ID plus random UUID. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Two concurrent runs use distinct paths and complete without evidence mixing — command: `./node_modules/.bin/vitest run tests/failure/run_lifecycle.test.ts -t 'isolates concurrent runs'`; expected exit code: `0`.
  - [ ] Passed, failed, and blocked runs each emit one terminal event — command: `./node_modules/.bin/vitest run tests/failure/run_lifecycle.test.ts -t 'emits exactly one terminal event'`; expected exit code: `0`.
  - [ ] Raw issue/payload values are absent from audit and trace evidence — command: `./node_modules/.bin/vitest run tests/failure/run_lifecycle.test.ts -t 'redacts run input evidence'`; expected exit code: `0`.
  - [ ] Resume rejects source or policy drift and preserves prior evidence — command: `./node_modules/.bin/vitest run tests/failure/run_lifecycle.test.ts -t 'rejects unsafe resume'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/ledger.test.ts tests/failure/run_lifecycle.test.ts tests/e2e/remediate_e2e.test.ts`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/F1-01.md`.
- **想定される逸脱と禁止事項**: adding a suffix to the fixed path, logging raw payload before redaction, or writing a second terminal event in `finally` is forbidden.

### WU F1-02 — Add tamper-evident, ordered, durable audit storage

- **WU-ID**: `F1-02`; **Phase**: F; **対応 GAP**: `GAP-051`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/F1-01.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `F1-01`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `src/lib/audit.ts`, `src/lib/types.ts`, `scripts/audit-verify.mjs`, `tests/unit/audit_integrity.test.ts`, `tests/failure/run_lifecycle.test.ts`, `docs/OPERATIONS.md`, `docs/SECURITY_MODEL.md`, `artifacts/audit/**`, `.orchestration/{reports,validation}/F1-02*`, `.agents/worklog/**`.
- **forbidden_actions**: checksum stored only beside mutable log without chain; non-serialized concurrent writers; accepting truncation; body content in integrity metadata; external dependency.
- **実装内容**: serialize writes per run; add monotonic sequence, previous-event SHA-256, event SHA-256, run ID, and schema version; fsync file and parent on creation/rotation; verify chain, sequence, JSON lines, terminal event, and truncation; document rotation and retention.
- **決定を要する点**: none. Standard library SHA-256 and per-run writer are mandatory. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Valid concurrent run log verifies with continuous sequence/hash chain — command: `./node_modules/.bin/vitest run tests/unit/audit_integrity.test.ts -t 'verifies concurrent append chain'`; expected exit code: `0`.
  - [ ] Edited, removed, reordered, duplicated, and truncated lines are rejected — command: `./node_modules/.bin/vitest run tests/unit/audit_integrity.test.ts -t 'detects tampering'`; expected exit code: `0`.
  - [ ] CLI verifies a fresh E2E audit log — command: `./node_modules/node/bin/node scripts/audit-verify.mjs artifacts/audit/latest/remediation.jsonl`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/audit_integrity.test.ts tests/failure/run_lifecycle.test.ts && ./node_modules/node/bin/node scripts/audit-verify.mjs artifacts/audit/latest/remediation.jsonl`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/F1-02.md`.
- **想定される逸脱と禁止事項**: hashing only file-at-rest, skipping fsync tests, or treating parseable JSONL as integrity proof is forbidden.

### WU F1-03 — Deliver authenticated liveness and dependency readiness

- **WU-ID**: `F1-03`; **Phase**: F; **対応 GAP**: `GAP-029`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/B1-01.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/F1-02.acceptance.md && test -f .orchestration/decisions/F1-03.yaml && grep -q '^status: accepted$' .orchestration/decisions/F1-03.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `B1-01`, `F1-02`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `src/app.ts`, `scripts/deploy-smoke.sh`, `tests/component/service_auth.test.ts`, `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, `docs/RUNBOOK.md`, `docs/SECRETS_MANAGEMENT.md`, `.orchestration/{reports,validation}/F1-03*`, `.agents/worklog/**`.
- **forbidden_actions**: unauthenticated Flue route; liveness reported as readiness; omitted dependency; secret value in logs.
- **実装内容**: apply accepted auth/bind decision; authenticate every workflow route; expose process-only liveness separately from bounded OPA, LiteLLM, OpenSandbox, and evidence-sink readiness.
- **決定を要する点**: user-approved F1-03 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Invalid authentication invokes no workflow — command: `./node_modules/.bin/vitest run tests/component/service_auth.test.ts -t 'rejects invalid authentication before workflow'`; expected exit code: `0`.
  - [ ] Each dependency failure makes readiness fail while liveness stays process-only — command: `./node_modules/.bin/vitest run tests/component/service_auth.test.ts -t 'separates liveness and readiness'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/component/service_auth.test.ts` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/F1-03.md`.
- **想定される逸脱と禁止事項**: health `{ok:true}`, bearer token in logs, or readiness checking only the process is forbidden.

### WU F1-05 — Prove non-destructive backup and recovery

- **WU-ID**: `F1-05`; **Phase**: F; **対応 GAP**: `GAP-012`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/F1-03.acceptance.md && test -f .orchestration/decisions/F1-05.yaml && grep -q '^status: accepted$' .orchestration/decisions/F1-05.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `F1-03`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `scripts/backup-evidence.mjs`, `scripts/restore-evidence.mjs`, `tests/integration/recovery.test.ts`, `docs/OPERATIONS.md`, `docs/RUNBOOK.md`, `.orchestration/validation/F1-05-backup.tar.gz`, `.orchestration/validation/F1-05-restore/**`, `.orchestration/{reports,validation}/F1-05*`, `.agents/worklog/**`.
- **forbidden_actions**: restore into active root; evidence regeneration; missing AGMSG/orchestrator state; secret-bearing snapshot.
- **実装内容**: write the snapshot only to `.orchestration/validation/F1-05-backup.tar.gz`; restore only to a newly empty `.orchestration/validation/F1-05-restore/`; include product evidence and AGMSG/orchestrator task, lease, result, and acceptance state with manifest/hash/source identity; verify without regeneration; measure accepted RTO/RPO.
- **決定を要する点**: user-approved F1-05 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Restore preserves hashes and active evidence — command: `./node_modules/.bin/vitest run tests/integration/recovery.test.ts -t 'restores without changing active evidence'`; expected exit code: `0`.
  - [ ] Missing, tampered, or secret-bearing snapshots fail — command: `./node_modules/.bin/vitest run tests/integration/recovery.test.ts -t 'rejects unsafe recovery artifacts'`; expected exit code: `0`.
  - [ ] Real drill meets accepted RTO/RPO — command: `./node_modules/node/bin/node scripts/restore-evidence.mjs --drill --decision .orchestration/decisions/F1-05.yaml --evidence .orchestration/validation/F1-05-recovery.json`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/integration/recovery.test.ts` → expected exit code `0`; real drill is `[requires-real-env]`.
- **証跡パス**: `.orchestration/validation/F1-05.md`, `.orchestration/validation/F1-05-backup.tar.gz`, `.orchestration/validation/F1-05-restore/`, `.orchestration/validation/F1-05-recovery.json`.
- **想定される逸脱と禁止事項**: in-place restore or validate-release regeneration is forbidden.

### WU F1-06 — Operate measurable SLO, paging, cost, and telemetry resilience

- **WU-ID**: `F1-06`; **Phase**: F; **対応 GAP**: `GAP-013`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/F1-05.acceptance.md && test -f .orchestration/decisions/F1-06.yaml && grep -q '^status: accepted$' .orchestration/decisions/F1-06.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `F1-05`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `src/lib/telemetry.ts`, `config/observability/**`, `scripts/slo-evaluate.mjs`, `tests/integration/slo.test.ts`, `docs/OPERATIONS.md`, `docs/SLO.md`, `.orchestration/{reports,validation}/F1-06*`, `.agents/worklog/**`.
- **forbidden_actions**: manual SLO pass; in-memory-only critical queue; missing owner/paging target; silent telemetry loss.
- **実装内容**: configure Collector queue/retry/persistent storage; define executable SLI queries, dashboard, paging, owner, cost, latency, and availability targets; make evaluator fail per breach.
- **決定を要する点**: user-approved F1-06 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Target fixture passes and every breach fixture fails — command: `./node_modules/.bin/vitest run tests/integration/slo.test.ts -t 'evaluates every accepted SLO'`; expected exit code: `0`.
  - [ ] Exporter outage, restart, overflow, and disk-full signal loss/alerts — command: `./node_modules/.bin/vitest run tests/integration/slo.test.ts -t 'proves telemetry resilience and loss signaling'`; expected exit code: `0`.
  - [ ] Wiring contains owner, paging, dashboard, queue, retry, and storage — command: `./node_modules/.bin/vitest run tests/integration/slo.test.ts -t 'validates production observability wiring'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/integration/slo.test.ts` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/F1-06.md`.
- **想定される逸脱と禁止事項**: unmeasured targets or warning-only loss is forbidden.

### WU F1-04 — Sign, activate, and trace production OPA policy bundles

- **WU-ID**: `F1-04`; **Phase**: F; **対応 GAP**: `GAP-060`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/F1-06.acceptance.md && test -f .orchestration/decisions/F1-04.yaml && grep -q '^status: accepted$' .orchestration/decisions/F1-04.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `F1-06`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `scripts/opa-bundle.mjs`, `scripts/opa-check.mjs`, `scripts/opa-status.mjs`, `config/opa/**`, `policy/system/**`, `artifacts/policy/bundle.tar.gz`, `tests/integration/opa_management.test.ts`, `docs/POLICY_MODEL.md`, `docs/DEPLOYMENT.md`, `docs/OPERATIONS.md`, `docs/RUNBOOK.md`, `docs/SECRETS_MANAGEMENT.md`, `.github/workflows/validate-release.yml`, `.orchestration/{reports,validation}/F1-04*`, `.agents/worklog/**`.
- **forbidden_actions**: private signing material in repository, CLI arguments, logs, audit, or evidence; unsigned production activation; unmasked decision inputs; treating `opa eval` as signature verification; accepting stale bundle revision.
- **実装内容**: apply the accepted signing and key-custody method; sign snapshot bundles; verify signature, scope, revision, and exact file set before activation; expose bounded activation/status checks; emit decision ID, trace ID, bundle revision, policy path, allow/deny, and masked input metadata; reject missing, invalid, expired, stale, or wrong-scope bundles while retaining the last verified active bundle.
- **決定を要する点**: user-approved F1-04 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Built bundle contains a valid signature and current revision without secret material — command: `./node_modules/node/bin/node scripts/opa-bundle.mjs --require-signature --decision .orchestration/decisions/F1-04.yaml && ./node_modules/node/bin/node scripts/opa-check.mjs --verify-bundle artifacts/policy/bundle.tar.gz`; expected exit code: `0`.
  - [ ] Unsigned, tampered, wrong-scope, and stale bundles are rejected and the last verified bundle remains active — command: `./node_modules/.bin/vitest run tests/integration/opa_management.test.ts -t 'rejects untrusted bundles without replacing active policy'`; expected exit code: `0`.
  - [ ] Status reports prove current bundle activation and policy health within the accepted timeout — command: `./node_modules/node/bin/node scripts/opa-status.mjs --require-current --decision .orchestration/decisions/F1-04.yaml`; expected exit code: `0`.
  - [ ] Decision logs contain correlation and revision fields while masking configured sensitive paths — command: `./node_modules/.bin/vitest run tests/integration/opa_management.test.ts -t 'emits masked correlated decision logs'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/opa-test.mjs && ./node_modules/.bin/vitest run tests/integration/opa_management.test.ts` → expected exit code `0`; `[requires-real-env] ./node_modules/node/bin/node scripts/opa-status.mjs --require-current --decision .orchestration/decisions/F1-04.yaml` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/F1-04.md`.
- **想定される逸脱と禁止事項**: hash-only unsigned bundles, decision logging without masking, or activating a new bundle before verification is forbidden.

### WU F2-01 — Make acceptance, leases, and controlled paths atomic and fail closed

- **WU-ID**: `F2-01`; **Phase**: F; **対応 GAP**: `GAP-030`, `GAP-031`, `GAP-032`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A2-02.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A2-02`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `scripts/orchestrator/accept.mjs`, `scripts/orchestrator/delegate.mjs`, `scripts/orchestrator/pretooluse-guard.mjs`, `scripts/orchestrator/common.mjs`, `policy/cc_guard.rego`, `policy/cc_guard_test.rego`, `tests/unit/orchestrator_tools.test.ts`, `tests/unit/orchestrator_fail_closed.test.ts`, `docs/ORCHESTRATOR_INTERFACE.md`, `docs/INTEGRATION_BOUNDARY.md`, `.orchestration/{reports,validation}/F2-01*`, `.agents/worklog/**`.
- **forbidden_actions**: accepting failed/blocked/open outcome; lease write after task send; overlapping active lease; ignoring expiry; exact controlled root allow; prose-based success.
- **実装内容**: reject non-green machine status/outcome before tier handling; require every task-declared report, validation, sandbox, learning, and AutoSkill path before acceptance; atomically check/acquire lease before send and release on send failure; implement explicit lease renewal with owner/task match, maximum TTL, and expired-lease rejection; enforce overlap and expiry; deny exact controlled roots and descendants identically in OPA and builtin defense.
- **決定を要する点**: none. Lease store remains the current orchestrator ledger; atomic update uses standard-library exclusive file creation/rename. **ワーカー裁量**: none.
- **DoD**:
  - [ ] failed/blocked/open result cannot be accepted under auto or confirm — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_tools.test.ts -t 'rejects non-green result'`; expected exit code: `0`.
  - [ ] concurrent overlapping delegation permits exactly one lease/task send — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_fail_closed.test.ts -t 'acquires lease atomically'`; expected exit code: `0`.
  - [ ] send failure releases only the newly acquired lease and records no accepted task — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_fail_closed.test.ts -t 'rolls back failed delegation'`; expected exit code: `0`.
  - [ ] Acceptance rejects each missing or mismatched task-declared artifact — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_tools.test.ts -t 'requires complete result artifacts'`; expected exit code: `0`.
  - [ ] Lease renewal accepts only the matching active owner/task within maximum TTL and rejects expired or foreign renewal — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_fail_closed.test.ts -t 'renews leases with ownership and ttl checks'`; expected exit code: `0`.
  - [ ] exact `policy` and `artifacts/audit` roots plus descendants are denied by OPA and builtin paths — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_tools.test.ts -t 'denies controlled roots' && ./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/orchestrator_tools.test.ts tests/unit/orchestrator_fail_closed.test.ts && ./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/F2-01.md`.
- **想定される逸脱と禁止事項**: regex-only validation text, best-effort lease warning, or fixing only Rego or only builtin logic is forbidden.

### WU F2-02 — Deny all PreToolUse actions when OPA is unavailable

- **WU-ID**: `F2-02`; **Phase**: F; **対応 GAP**: `GAP-048`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/F2-01.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `F2-01`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `scripts/orchestrator/pretooluse-guard.mjs`, `tests/unit/orchestrator_tools.test.ts`, `tests/unit/orchestrator_fail_closed.test.ts`, `docs/INTEGRATION_BOUNDARY.md`, `docs/FAILURE_MODE_MATRIX.md`, `.orchestration/{reports,validation}/F2-02*`, `.agents/worklog/**`.
- **forbidden_actions**: OPA exception→builtin allow; silent downgrade; warning with exit 0; distinguishing “safe-looking” commands during policy outage.
- **実装内容**: return explicit `policy_unavailable` deny on missing binary, timeout, malformed JSON, empty result, missing policy, or evaluation error; keep builtin checks as additional denies only after a valid OPA decision; emit sanitized guard failure evidence.
- **決定を要する点**: none. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Missing OPA denies harmless and controlled Bash/Edit/Write inputs with exit 2 — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_fail_closed.test.ts -t 'denies every tool when opa unavailable'`; expected exit code: `0`.
  - [ ] Malformed and empty OPA results deny with `policy_unavailable` — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_fail_closed.test.ts -t 'denies malformed opa result'`; expected exit code: `0`.
  - [ ] Valid OPA allow still receives builtin controlled-path denies — command: `./node_modules/.bin/vitest run tests/unit/orchestrator_tools.test.ts -t 'combines valid opa with builtin defense'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/orchestrator_tools.test.ts tests/unit/orchestrator_fail_closed.test.ts`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/F2-02.md`.
- **想定される逸脱と禁止事項**: retaining `return null`, allowlisting echo/read commands during outage, or omitting the failure from the matrix is forbidden.

## Phase G — Residual schema/threat hardening, reproducible dependencies, and skill governance

G1 WUs add schema detail, threat coverage, and historical status only. They cannot change Phase A0 canonical authorization, identity, fallback, closure, API, persistence, or requirement-abstraction contracts.

### WU G1-01 — Replace core stub specifications with normative schemas and tool policy contracts

- **WU-ID**: `G1-01`; **Phase**: G; **対応 GAP**: `GAP-001`, `GAP-005`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/D1-02.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A2-01.acceptance.md`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `D1-02`, `A2-01`. **並行可否**: parallel with `G2-01` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `docs/AGENT_LOOP_SPEC.md`, `docs/HYPOTHESIS_LEDGER_SPEC.md`, `docs/EVIDENCE_GRAPH_SPEC.md`, `docs/TOOL_REGISTRY_SPEC.md`, `docs/POLICY_MODEL.md`, `docs/SPECIFICATION.md`, `docs/requirements.json`, `docs/traceability.json`, `schemas/**`, `scripts/spec-check.mjs`, `tests/unit/spec_check.test.ts`, `.orchestration/{reports,validation}/G1-01*`, `.agents/worklog/**`.
- **forbidden_actions**: prose-only fields; implementation behavior absent from schema; claiming all side effects are authorized when no enforcement point exists; changing accepted implementation.
- **実装内容**: define versioned ledger/evidence/tool schemas, ID uniqueness, state transitions, required checks, closure invariants, resume/idempotency, invalid states, and migration; enumerate every side-effect tool with exact policy input, enforcement point, audit event, and failure semantics.
- **決定を要する点**: none. Specifications describe accepted D1-02 behavior. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Example and generated ledgers validate against the versioned schema — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-ledger-schema`; expected exit code: `0`.
  - [ ] Invalid transition, duplicate ID, missing evidence, and unknown tool fixtures are rejected — command: `./node_modules/.bin/vitest run tests/unit/spec_check.test.ts -t 'rejects invalid normative fixtures'`; expected exit code: `0`.
  - [ ] Every side-effect tool has one enforcement point, policy input, audit event, and test ID — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-tool-contracts`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs && ./node_modules/.bin/vitest run tests/unit/spec_check.test.ts`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/G1-01.md`.
- **想定される逸脱と禁止事項**: expanding line count without schema, documenting nonexistent authorization, or allowing unknown schema fields silently is forbidden.

### WU G1-02 — Consolidate production Gateway/security design and historical status

- **WU-ID**: `G1-02`; **Phase**: G; **対応 GAP**: `GAP-003`, `GAP-004`, `GAP-015`
- **Preconditions**: command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && for id in A0-01 A0-02 A0-03 A0-05 A0-07 B2-04 C2-01 F2-02; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: Phase A0 exit, `A0-01`, `A0-02`, `A0-03`, `A0-05`, `A0-07`, `B2-04`, `C2-01`, `F2-02`. **並行可否**: parallel with `G2-02` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `docs/PRODUCTION_GATEWAY_DESIGN.md`, `docs/INTEGRATION_BOUNDARY.md`, `docs/THREAT_MODEL.md`, `docs/ABUSE_CASES.md`, `docs/SECURITY_MODEL.md`, `.orchestration/analysis/gap_analysis_v1.md`, `.orchestration/analysis/phase8_consistency_audit.md`, `.orchestration/analysis/risk_register.md`, `scripts/spec-check.mjs`, `tests/unit/spec_check.test.ts`, `.orchestration/{reports,validation}/G1-02*`, `.agents/worklog/**`.
- **forbidden_actions**: preserving conflicts already resolved by A0; deleting historical findings; marking a finding resolved without acceptance link; selecting a fallback rule independently of A0-03.
- **実装内容**: make the A0-normalized Phase 8 contract the sole current design; mark superseded provider/fallback proposals historical exactly as A0-03 records; add all trust-boundary threats/abuse cases with control and test IDs; add as-of/status/resolved_by/superseded_by to historical registers without rewriting original evidence.
- **決定を要する点**: accepted user-owned A0-03 decision is immutable input. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Current Gateway design matches the accepted A0-03 fallback contract and approved aliases — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-current-gateway-design --decision .orchestration/decisions/A0-03.yaml`; expected exit code: `0`.
  - [ ] Every governed trust boundary has threat, abuse, control, test, and evidence IDs — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-threat-coverage`; expected exit code: `0`.
  - [ ] Historical findings have as-of and terminal/current status with evidence links — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-analysis-status`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/spec-check.mjs && ./node_modules/.bin/vitest run tests/unit/spec_check.test.ts`; expected exit code `0`.
- **証跡パス**: `.orchestration/validation/G1-02.md`.
- **想定される逸脱と禁止事項**: leaving “proposed” open questions in current design, deleting old rows, or adding threat prose without test IDs is forbidden.

### WU G2-01 — Lock Python dependencies and verify the supported runtime matrix

- **WU-ID**: `G2-01`; **Phase**: G; **対応 GAP**: `GAP-033`, `GAP-042`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A1-01.acceptance.md && test -f requirements.txt && test -f pyproject.toml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A1-01`. **並行可否**: parallel with `G1-01` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `requirements.txt`, `requirements.lock`, `pyproject.toml`, `scripts/setup-python.mjs`, `scripts/update-python-lock.mjs`, `scripts/sbom-check.mjs`, `scripts/validate-release.mjs`, `.github/workflows/validate-release.yml`, `docs/DEPLOYMENT.md`, `docs/VALIDATION_PLAN.md`, `tests/unit/python_lock.test.ts`, `.orchestration/{reports,validation}/G2-01*`, `.agents/worklog/**`.
- **forbidden_actions**: unpinned transitive resolution; lock without hashes; CI testing only Python 3.11 while docs claim 3.13; manual package upgrades outside lock update workflow.
- **実装内容**: create a fully pinned hash-verified lock from current accepted dependencies; provide one documented update command that regenerates the lock, dependency audit input, and Python SBOM from the same resolved set; make setup install only the lock; run primary CI on Python 3.13 and the fixed compatibility job on 3.11; record Python version, lock digest, SBOM digest, and audit digest in validation report.
- **決定を要する点**: none. Supported primary is Python 3.13; compatibility is Python 3.11 until a failing dependency forces a plan revision. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Clean venv install uses hashes and produces the locked distribution set — command: `./node_modules/.bin/vitest run tests/unit/python_lock.test.ts -t 'reproduces locked environment'`; expected exit code: `0`.
  - [ ] Missing hash or version drift is rejected — command: `./node_modules/.bin/vitest run tests/unit/python_lock.test.ts -t 'rejects lock drift'`; expected exit code: `0`.
  - [ ] Python 3.13 and 3.11 CI jobs are green and bound to the current source/artifact digest — command: `./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/G2-01.run-id --workflow validate-release --job python-matrix --require-current-source && gh run view "$(cat .orchestration/validation/G2-01.run-id)" --exit-status`; expected exit code: `0`.
  - [ ] Validation report contains actual Python version and lock digest — command: `./node_modules/node/bin/node scripts/validation-manifest.mjs --check-python-lock`; expected exit code: `0`.
  - [ ] Lock update, audit, and SBOM derive from one locked distribution set and record matching digests — command: `./node_modules/node/bin/node scripts/update-python-lock.mjs --check && ./node_modules/node/bin/node scripts/sbom-check.mjs --python-lock requirements.lock`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/python_lock.test.ts && ./node_modules/node/bin/node scripts/update-python-lock.mjs --check && ./node_modules/node/bin/node scripts/sbom-check.mjs --python-lock requirements.lock`; expected exit code `0`; `[requires-ci] ./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/G2-01.run-id --workflow validate-release --job python-matrix --require-current-source && gh run view "$(cat .orchestration/validation/G2-01.run-id)" --exit-status` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/G2-01.md`, `.orchestration/validation/G2-01.run-id`.
- **想定される逸脱と禁止事項**: keeping range-only requirements as install source, editing lock by hand, or declaring 3.13 compatible from mypy config is forbidden.

### WU G2-02 — Close the beta OPA package and runtime-version risk

- **WU-ID**: `G2-02`; **Phase**: G; **対応 GAP**: `GAP-046`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/G2-01.acceptance.md && test -f .orchestration/decisions/G2-02.yaml && grep -q '^status: accepted$' .orchestration/decisions/G2-02.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `G2-01`. **並行可否**: parallel with `G1-02` is allowed; every other parallel pairing is forbidden.
- **allowed_files**: `package.json`, `package-lock.json`, `src/lib/opa.ts`, `policy/**`, `scripts/opa-{check,test,bundle}.mjs`, `artifacts/policy/bundle.tar.gz`, `.github/workflows/validate-release.yml`, `docs/POLICY_MODEL.md`, `docs/DEPLOYMENT.md`, `.orchestration/analysis/risk_register.md`, `.orchestration/{reports,validation}/G2-02*`, `.agents/worklog/**`.
- **forbidden_actions**: version selection by worker; partial platform update; policy syntax downgrade; suppressing compatibility failures; beta retention without terminal decision.
- **実装内容**: apply the exact `disposition` in the accepted record: `adopt` updates all four platform packages to the accepted candidate, while `retain` leaves all four versions unchanged; verify the recorded package/runtime pair and Rego v1 policies on darwin/linux x64/arm64; regenerate the lock only for `adopt`; record RR-3 with the same disposition and exact `review_trigger_date`.
- **決定を要する点**: orchestrator-approved G2-02 record produced after version research; `disposition` is exactly `adopt` or `retain`. **ワーカー裁量**: none.
- **DoD**:
  - [ ] All four platform packages use one accepted version — command: `./node_modules/node/bin/node scripts/opa-check.mjs --check-platform-package-parity`; expected exit code: `0`.
  - [ ] Rego tests and bundle build pass on every CI architecture job bound to the current source/artifact digest — command: `./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/G2-02.run-id --workflow validate-release --job opa-matrix --require-current-source && gh run view "$(cat .orchestration/validation/G2-02.run-id)" --exit-status`; expected exit code: `0`.
  - [ ] RR-3 has terminal status, accepted version, validation evidence, and review trigger — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-risk RR-3`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/node/bin/node scripts/opa-check.mjs && ./node_modules/node/bin/node scripts/opa-test.mjs && ./node_modules/node/bin/node scripts/opa-bundle.mjs`; expected exit code `0`; `[requires-ci] ./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/G2-02.run-id --workflow validate-release --job opa-matrix --require-current-source && gh run view "$(cat .orchestration/validation/G2-02.run-id)" --exit-status` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/G2-02.md`, `.orchestration/validation/G2-02.run-id`.
- **想定される逸脱と禁止事項**: updating only current host package, leaving RR-3 open, or pinning an unreviewed latest version is forbidden.

### WU G2-03 — Complete distribution, CI supply-chain, and security-maintenance controls

- **WU-ID**: `G2-03`; **Phase**: G; **対応 GAP**: `GAP-057`, `GAP-058`, `GAP-059`, `GAP-061`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/G2-02.acceptance.md && grep -q 'status: accepted' .orchestration/acceptance/A1-01.acceptance.md && test -f .orchestration/decisions/G2-03.yaml && grep -q '^status: accepted$' .orchestration/decisions/G2-03.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `G2-02`, `A1-01`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `LICENSE`, `NOTICE`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `.github/dependabot.yml`, `.github/workflows/validate-release.yml`, `.github/workflows/codeql.yml`, `docs/DEPENDENCY_POLICY.md`, `package.json`, `RELEASE_MANIFEST.md`, `RELEASE_FILE_MANIFEST.json`, `scripts/validation-manifest.mjs`, `tests/unit/distribution_policy.test.ts`, `.orchestration/{reports,validation}/G2-03*`, `.agents/worklog/**`.
- **forbidden_actions**: inventing copyright holders; changing license identifier; pinning Actions to unverified fork commits; automatic major-version merge; upgrading Flue, OpenSandbox, TypeScript, or OpenTelemetry in this WU; claiming repository-setting controls without exported evidence.
- **実装内容**: apply the exact accepted G2-03 NOTICE holder, security contact, supported versions, and response target; add the exact Apache-2.0 license text matching package metadata; pin every third-party Action to a verified full commit SHA with release tag comments; enable dependency update and TypeScript/JavaScript code scanning workflows; define monthly patch review, quarterly migration review, emergency security update SLA, current/target/test-matrix fields, and explicit adopt/retain decision records for major dependencies.
- **決定を要する点**: user-approved G2-03 decision record. Dependency major-version adoption is outside this WU and requires its own accepted decision. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Package license metadata, LICENSE text, NOTICE, release manifest, and release file manifest agree — command: `./node_modules/.bin/vitest run tests/unit/distribution_policy.test.ts -t 'validates distribution licensing'`; expected exit code: `0`.
  - [ ] Every external Action uses a full 40-character commit SHA from the declared upstream repository — command: `./node_modules/.bin/vitest run tests/unit/distribution_policy.test.ts -t 'requires immutable action references'`; expected exit code: `0`.
  - [ ] SECURITY.md states supported versions, private reporting channel, response targets, and disclosure process without embedding a secret — command: `./node_modules/.bin/vitest run tests/unit/distribution_policy.test.ts -t 'validates security policy'`; expected exit code: `0`.
  - [ ] Dependabot and CodeQL workflows parse and target the repository's npm and GitHub Actions ecosystems — command: `./node_modules/.bin/vitest run tests/unit/distribution_policy.test.ts -t 'validates automated security maintenance'`; expected exit code: `0`.
  - [ ] Dependency policy records current Flue/OpenSandbox/OpenTelemetry/TypeScript versions, target candidates, review dates, compatibility gates, owner, and adopt/retain requirement — command: `./node_modules/.bin/vitest run tests/unit/distribution_policy.test.ts -t 'validates dependency lifecycle policy'`; expected exit code: `0`.
  - [ ] Mutable Action refs, changed license text, stale release digests, and wrong-source CI run fixtures are rejected — command: `./node_modules/.bin/vitest run tests/unit/distribution_policy.test.ts -t 'rejects supply-chain drift'`; expected exit code: `0`.
- **Verification**: `[local] ./node_modules/.bin/vitest run tests/unit/distribution_policy.test.ts && ./node_modules/node/bin/node scripts/validation-manifest.mjs --check && npm audit --audit-level=high --omit=dev` → expected exit code `0`; `[requires-ci] ./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/G2-03.run-id --workflow validate-release --job security-maintenance --require-current-source && gh run view "$(cat .orchestration/validation/G2-03.run-id)" --exit-status` → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/G2-03.md`, `.orchestration/validation/G2-03.run-id`.
- **想定される逸脱と禁止事項**: tag-only Action references, public vulnerability intake, dependency-version changes hidden inside maintenance setup, or generated license text with guessed ownership is forbidden.

### WU G3-01 — Repair P2-T07b provenance and execute AutoSkill cycle 2

- **WU-ID**: `G3-01`; **Phase**: G; **対応 GAP**: `GAP-044`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/A1-01.acceptance.md && test -f .orchestration/acceptance/P2-T07b.acceptance.md && test -f .orchestration/decisions/G3-01.yaml && grep -q '^status: accepted$' .orchestration/decisions/G3-01.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `A1-01`. **並行可否**: parallel with none; every parallel pairing is forbidden; this WU has exclusive access to AutoSkill run directories.
- **allowed_files**: `.orchestration/autoskill/{config,inputs,runs,outputs}/**`, `.orchestration/skills/candidates/**`, `scripts/skill-{cycle,lifecycle}.mjs`, `tests/unit/skill_lifecycle.test.mjs`, `docs/SKILL_OPTIMIZATION.md`, `.orchestration/{reports,validation}/G3-01*`, `.agents/worklog/**`.
- **forbidden_actions**: promotion; unredacted input; manual candidate count without digest; overwriting cycle 1; mock LLM accepted as AutoSkill real cycle; image build outside approved sandbox task.
- **実装内容**: reconstruct immutable P2-T07b manifest from source console/output with five candidate paths, counts, digests, and manual-copy provenance; run cycle 2 on a new accepted-task corpus; record redaction, provider/auth mode, calls, candidates, decisions, duplication rate, and promotion_allowed=false.
- **決定を要する点**: orchestrator-approved G3-01 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Reconstructed cycle-1 manifest counts/digests match five candidate files — command: `./node_modules/node/bin/node scripts/skill-cycle.mjs verify-manifest --cycle P2-T07b`; expected exit code: `0`.
  - [ ] Cycle 2 input manifest passes redaction and contains only orchestrator-listed tasks — command: `./node_modules/node/bin/node scripts/skill-cycle.mjs verify-input --cycle 2`; expected exit code: `0`.
  - [ ] Cycle 2 executes the accepted real-environment command — command: `./node_modules/node/bin/node scripts/skill-cycle.mjs run --cycle 2 --decision .orchestration/decisions/G3-01.yaml`; expected exit code: `0`.
  - [ ] Cycle 2 run records provider/auth/calls/candidates/decisions/digests and promotion false — command: `./node_modules/node/bin/node scripts/skill-cycle.mjs verify-run --cycle 2`; expected exit code: `0`.
  - [ ] Native lifecycle regression tests pass — command: `./node_modules/node/bin/node --test tests/unit/skill_lifecycle.test.mjs`; expected exit code: `0`.
- **Verification**: `[requires-real-env] ./node_modules/node/bin/node scripts/skill-cycle.mjs run --cycle 2 --decision .orchestration/decisions/G3-01.yaml` → expected exit code `0`; `[local] ./node_modules/node/bin/node scripts/skill-cycle.mjs verify-manifest --cycle P2-T07b && ./node_modules/node/bin/node scripts/skill-cycle.mjs verify-input --cycle 2 && ./node_modules/node/bin/node scripts/skill-cycle.mjs verify-run --cycle 2` → expected exit code `0`. Mock substitution is rejected.
- **証跡パス**: `.orchestration/validation/G3-01.md`, `.orchestration/autoskill/runs/cycle-2.autoskill.md`.
- **想定される逸脱と禁止事項**: editing acceptance prose to match a broken run log, counting copied candidates without source digest, or promotion during the cycle is forbidden.

### WU G3-02 — Merge all three merge_required skill candidates into terminal records

- **WU-ID**: `G3-02`; **Phase**: G; **対応 GAP**: `GAP-045`
- **Preconditions**: command: `grep -q 'status: accepted' .orchestration/acceptance/G3-01.acceptance.md && test "$(grep -c 'merge_required' .orchestration/skills/candidates/p2t07b.triage.md)" -ge 3 && test -f .orchestration/decisions/G3-02.yaml && grep -q '^status: accepted$' .orchestration/decisions/G3-02.yaml`; expected exit code: `0`. Nonzero means 着手禁止.
- **依存 WU**: `G3-01`. **並行可否**: parallel with none; every parallel pairing is forbidden.
- **allowed_files**: `.orchestration/skills/{candidates,merged,promoted,rejected}/**`, `.orchestration/skills/TRIAGE.md`, `scripts/check-skill-registry.mjs`, `scripts/skill-lifecycle.mjs`, `tests/unit/skill_lifecycle.test.mjs`, `docs/SKILL_OPTIMIZATION.md`, `.orchestration/{reports,validation}/G3-02*`, `.agents/worklog/**`.
- **forbidden_actions**: promotion; deleting source candidates; leaving merge_required status; creating three overlapping merged skills; losing anti-resubmission provenance.
- **実装内容**: merge release-validation candidate into one validation-governance candidate; merge two secret candidates into one secrets-governance candidate; move all three source candidates to terminal merged records with target, source digest, validation, decision owner, and anti-resubmission key.
- **決定を要する点**: orchestrator-approved G3-02 decision record. **ワーカー裁量**: none.
- **DoD**:
  - [ ] Three source candidates have terminal merged records and no active merge_required state — command: `./node_modules/node/bin/node scripts/check-skill-registry.mjs --require-terminal p2t07b-release-validation-security-gates p2t07b-secret_management_acceptance_review p2t07b-secrets-management-documentation-scaffold`; expected exit code: `0`.
  - [ ] Exactly two merged targets contain complete provenance and no promotion marker — command: `./node_modules/node/bin/node scripts/check-skill-registry.mjs --check-merged-targets`; expected exit code: `0`.
  - [ ] Skill lifecycle tests and registry gate pass — command: `./node_modules/node/bin/node --test tests/unit/skill_lifecycle.test.mjs && ./node_modules/node/bin/node scripts/check-skill-registry.mjs`; expected exit code: `0`.
  - [ ] Missing source digest, duplicate terminal target, promotion marker, and retained merge_required fixture are rejected — command: `./node_modules/node/bin/node --test tests/unit/skill_lifecycle.test.mjs --test-name-pattern='rejects invalid merged terminal records'`; expected exit code: `0`.
- **Verification**: `[local]` execute all DoD commands → expected exit code `0`.
- **証跡パス**: `.orchestration/validation/G3-02.md`.
- **想定される逸脱と禁止事項**: direct promotion, source deletion, or one merged file per source candidate is forbidden.

## Phase Exit Criteria

Every checkbox below is mandatory. Phase acceptance is forbidden when one command returns a different exit code.

### Phase A0 Exit

For the full canonical range, `--check-spec-register` expands the range and executes both exact register/bijection checks and every existing per-SPEC semantic validator; ID-only success is forbidden.

- [ ] All Phase A0 WUs are accepted — command: `for id in A0-01 A0-02 A0-03 A0-04 A0-05 A0-06 A0-07 A0-08 A0-09; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`.
- [ ] All 20 SPEC IDs have one canonical contract and complete traceability — command: `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec-register SPEC-01..SPEC-20`; expected exit code: `0`.
- [ ] Specification policy suites pass — command: `./node_modules/node/bin/node scripts/opa-test.mjs`; expected exit code: `0`.
- [ ] Missing classification, undeclared default route, and forged identity are fail-closed with exact reasons, while both loaded policies pass positive controls — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/routing_missing_classification.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["missing_classification"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/routing_default_unknown.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["unknown_route"]' && "$OPA_BIN" eval --fail --data policy/agent.rego --data policy/tenants.json --input tests/fixtures/policy/identity_forged_body.json 'not data.eap.agent.allow; data.eap.agent.deny_reason["body_identity_forbidden"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_routing_valid.json 'data.eap.routing.allow = true' && "$OPA_BIN" eval --fail --data policy/agent.rego --data policy/tenants.json --input tests/fixtures/policy/identity_valid.json 'data.eap.agent.allow = true'`; expected exit code: `0`.
- [ ] Invalid remediation requests are rejected before side effects — command: `./node_modules/.bin/vitest run tests/component/request_contract.test.ts`; expected exit code: `0`.
- [ ] Phase evidence is recorded — command: `test -f .orchestration/validation/PHASE-A0.md && grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md`; expected exit code: `0`.

### Phase A Exit

- [ ] All Phase A WUs are accepted — command: `for id in A1-01 A1-02 A2-01 A2-02 A2-03; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`.
- [ ] Current source, gate set, requirements, and release formula structure are consistent without requiring downstream evidence — command: `./node_modules/node/bin/node scripts/validation-manifest.mjs --check && ./node_modules/node/bin/node scripts/spec-check.mjs && ./node_modules/node/bin/node scripts/release-decision.mjs --check-formula`; expected exit code: `0`.
- [ ] Phase evidence is recorded — command: `test -f .orchestration/validation/PHASE-A.md && grep -q '^status: passed$' .orchestration/validation/PHASE-A.md`; expected exit code: `0`.

### Phase B Exit

- [ ] All Phase B WUs are accepted — command: `for id in B1-01 B1-02 B1-03 B2-01 B2-02 B2-03 B2-04; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`.
- [ ] Production service reports every required hop ready — command: `scripts/production-status.sh --require-ready && ./node_modules/node/bin/node scripts/orchestrator/platform-health.mjs --live --require-all-hops`; expected exit code: `0`.
- [ ] Live LLM success and outage proofs pass evidence validation against A0-03 — command: `./node_modules/node/bin/node scripts/release-decision.mjs --check-live-smoke .orchestration/validation/B2-04-live.json .orchestration/validation/B2-04-outage.json --decision .orchestration/decisions/A0-03.yaml`; expected exit code: `0`.
- [ ] Phase evidence is recorded — command: `test -f .orchestration/validation/PHASE-B.md && grep -q '^status: passed$' .orchestration/validation/PHASE-B.md`; expected exit code: `0`.

Phase B integration commands are `[requires-real-env]`. Mock, local gateway, and recorded response evidence return nonzero.

### Phase C Exit

- [ ] All Phase C WUs are accepted — command: `for id in C1-01 C1-02 C2-01; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`.
- [ ] OpenSandbox full remediation and positive-control egress job is green and current-source-bound — command: `./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/C2-01.run-id --workflow validate-release --job opensandbox-integration --require-current-source && gh run view "$(cat .orchestration/validation/C2-01.run-id)" --exit-status`; expected exit code: `0`.
- [ ] CI artifacts prove no skipped test and a complete remote destroy event — command: `./node_modules/node/bin/node scripts/opensandbox-ci-assert.mjs .orchestration/validation/C2-01-ci-artifacts`; expected exit code: `0`.
- [ ] Phase evidence is recorded — command: `test -f .orchestration/validation/PHASE-C.md && grep -q '^status: passed$' .orchestration/validation/PHASE-C.md`; expected exit code: `0`.

Phase C integration commands are `[requires-ci]`. Executor-only tests and local executor results return nonzero.

### Phase D Exit

- [ ] All Phase D WUs are accepted — command: `for id in D1-01 D1-02 D2-01 D2-02; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`.
- [ ] Critical branch coverage and full held-out workflow pass — command: `./node_modules/.bin/vitest run --coverage && npm run flue:e2e:heldout`; expected exit code: `0`.
- [ ] Unsupported input and policy-deny E2E leave source unchanged — command: `./node_modules/.bin/vitest run tests/component/code.test.ts -t 'rejects unsupported repair' && ./node_modules/.bin/vitest run tests/e2e/remediate_e2e.test.ts -t 'denies guest without side effects'`; expected exit code: `0`.
- [ ] Phase evidence is recorded — command: `test -f .orchestration/validation/PHASE-D.md && grep -q '^status: passed$' .orchestration/validation/PHASE-D.md`; expected exit code: `0`.

### Phase E Exit

- [ ] E1-01 is accepted — command: `grep -q 'status: accepted' .orchestration/acceptance/E1-01.acceptance.md`; expected exit code: `0`.
- [ ] Approved staging metric, cross-tenant deny, and evidence redaction pass — command: `EAP_DATA_PROFILE=staging ./node_modules/.bin/vitest run tests/integration/governed_data.test.ts && ./node_modules/node/bin/node scripts/data-evidence-check.mjs .orchestration/validation/E1-01-real.json`; expected exit code: `0`.
- [ ] Phase evidence is recorded — command: `test -f .orchestration/validation/PHASE-E.md && grep -q '^status: passed$' .orchestration/validation/PHASE-E.md`; expected exit code: `0`.

Phase E integration commands are `[requires-real-env]`. Fixture and mock datasource results return nonzero.

### Phase F Exit

- [ ] All Phase F WUs are accepted — command: `for id in F1-01 F1-02 F1-03 F1-05 F1-06 F1-04 F2-01 F2-02; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`.
- [ ] Audit integrity, auth/readiness, recovery, SLO, acceptance, lease, and OPA-outage suites pass — command: `./node_modules/.bin/vitest run tests/unit/audit_integrity.test.ts tests/component/service_auth.test.ts tests/integration/recovery.test.ts tests/integration/slo.test.ts tests/unit/orchestrator_tools.test.ts tests/unit/orchestrator_fail_closed.test.ts`; expected exit code: `0`.
- [ ] Real recovery drill meets the accepted RTO/RPO — command: `./node_modules/node/bin/node scripts/restore-evidence.mjs --drill --decision .orchestration/decisions/F1-05.yaml --evidence .orchestration/validation/F1-05-recovery.json`; expected exit code: `0`.
- [ ] Signed current OPA bundle, activation status, and masked decision logs verify — command: `./node_modules/node/bin/node scripts/opa-check.mjs --verify-bundle artifacts/policy/bundle.tar.gz && ./node_modules/node/bin/node scripts/opa-status.mjs --require-current --decision .orchestration/decisions/F1-04.yaml`; expected exit code: `0`.
- [ ] Phase evidence is recorded — command: `test -f .orchestration/validation/PHASE-F.md && grep -q '^status: passed$' .orchestration/validation/PHASE-F.md`; expected exit code: `0`.

The recovery drill is `[requires-real-env]`.

### Phase G Exit

- [ ] All Phase G WUs are accepted — command: `for id in G1-01 G1-02 G2-01 G2-02 G2-03 G3-01 G3-02; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`.
- [ ] Specification, lock, OPA, and skill registry checks pass — command: `./node_modules/node/bin/node scripts/spec-check.mjs && ./node_modules/.bin/vitest run tests/unit/python_lock.test.ts && ./node_modules/node/bin/node scripts/opa-test.mjs && ./node_modules/node/bin/node scripts/check-skill-registry.mjs`; expected exit code: `0`.
- [ ] AutoSkill cycle 2 and all three terminal merge records verify — command: `./node_modules/node/bin/node scripts/skill-cycle.mjs verify-run --cycle 2 && ./node_modules/node/bin/node scripts/check-skill-registry.mjs --check-merged-targets`; expected exit code: `0`.
- [ ] Distribution, immutable Actions, security policy, and dependency lifecycle checks pass — command: `./node_modules/.bin/vitest run tests/unit/distribution_policy.test.ts`; expected exit code: `0`.
- [ ] Phase evidence is recorded — command: `test -f .orchestration/validation/PHASE-G.md && grep -q '^status: passed$' .orchestration/validation/PHASE-G.md`; expected exit code: `0`.

## Definition of Production Ready

The label `Production Ready` is forbidden until every checkbox passes and the user confirms release acceptance.

The Production Ready `--check-spec-register` command has the same full semantic-expansion requirement as Phase A0 Exit; a stale signed SPEC vector must make it nonzero.

- [ ] All 44 WUs are accepted — command: `for id in A0-01 A0-02 A0-03 A0-04 A0-05 A0-06 A0-07 A0-08 A0-09 A1-01 A1-02 A2-01 A2-02 A2-03 B1-01 B1-02 B1-03 B2-01 B2-02 B2-03 B2-04 C1-01 C1-02 C2-01 D1-01 D1-02 D2-01 D2-02 E1-01 F1-01 F1-02 F1-03 F1-05 F1-06 F1-04 F2-01 F2-02 G1-01 G1-02 G2-01 G2-02 G2-03 G3-01 G3-02; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`.
- [ ] All twelve P0 blockers have accepted closing WUs — command: `for id in A0-01 A0-02 A0-03 A0-04 B1-01 B1-02 B2-01 C1-01 D1-01 E1-01; do grep -q 'status: accepted' ".orchestration/acceptance/$id.acceptance.md" || exit 1; done`; expected exit code: `0`.
- [ ] Specification normalization is current and both user decisions are accepted — command: `grep -q '^status: passed$' .orchestration/validation/PHASE-A0.md && grep -q '^status: accepted$' .orchestration/decisions/A0-03.yaml && grep -q '^status: accepted$' .orchestration/decisions/A0-08.yaml && ./node_modules/node/bin/node scripts/spec-check.mjs --check-spec-register SPEC-01..SPEC-20`; expected exit code: `0`.
- [ ] Direct OPA counterexamples prove classification, route, and identity fail closed with exact reasons, while both loaded policies pass positive controls — command: `OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")" && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/routing_missing_classification.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["missing_classification"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/routing_default_unknown.json 'not data.eap.routing.allow; data.eap.routing.deny_reason["unknown_route"]' && "$OPA_BIN" eval --fail --data policy/agent.rego --data policy/tenants.json --input tests/fixtures/policy/identity_forged_body.json 'not data.eap.agent.allow; data.eap.agent.deny_reason["body_identity_forbidden"]' && "$OPA_BIN" eval --fail --data policy/routing.rego --data policy/tenants.json --input tests/fixtures/policy/production_contract_routing_valid.json 'data.eap.routing.allow = true' && "$OPA_BIN" eval --fail --data policy/agent.rego --data policy/tenants.json --input tests/fixtures/policy/identity_valid.json 'data.eap.agent.allow = true'`; expected exit code: `0`.
- [ ] Production profile proof is current and ready — command: `scripts/production-status.sh --require-ready --evidence .orchestration/validation/B1-01.md`; expected exit code: `0`.
- [ ] Live LLM proof is real/current/redacted and outage evidence matches A0-03 without unmarked synthetic output — command: `./node_modules/node/bin/node scripts/release-decision.mjs --check-live-smoke .orchestration/validation/B2-04-live.json .orchestration/validation/B2-04-outage.json --decision .orchestration/decisions/A0-03.yaml`; expected exit code: `0`.
- [ ] OpenSandbox full workflow proof is a current-source-bound green CI run with no skip — command: `./node_modules/node/bin/node scripts/ci-evidence-check.mjs --run-id-file .orchestration/validation/C2-01.run-id --workflow validate-release --job opensandbox-integration --require-current-source && gh run view "$(cat .orchestration/validation/C2-01.run-id)" --exit-status && ./node_modules/node/bin/node scripts/opensandbox-ci-assert.mjs .orchestration/validation/C2-01-ci-artifacts`; expected exit code: `0`.
- [ ] Governed staging data proof is real and contains no raw rows — command: `./node_modules/node/bin/node scripts/data-evidence-check.mjs .orchestration/validation/E1-01-real.json`; expected exit code: `0`.
- [ ] Every Phase Exit record is present, passed, current-source-bound, and digest-valid — command: `for phase in A0 A B C D E F G; do ./node_modules/node/bin/node scripts/release-decision.mjs --check-phase ".orchestration/validation/PHASE-$phase.md" --require-current-source || exit 1; done`; expected exit code: `0`.
- [ ] Release evaluator binds all non-user-acceptance evidence to the current source and gate manifest — command: `./node_modules/node/bin/node scripts/release-decision.mjs --check-production-ready --exclude-user-acceptance`; expected exit code: `0`.
- [ ] Request contract, signed policy, distribution, and security-maintenance addendum gates pass — command: `./node_modules/.bin/vitest run tests/component/request_contract.test.ts tests/integration/opa_management.test.ts tests/unit/distribution_policy.test.ts`; expected exit code: `0`.
- [ ] User acceptance record exists — command: `test -f .orchestration/acceptance/PRODUCTION_READY.acceptance.md && grep -q '^status: accepted$' .orchestration/acceptance/PRODUCTION_READY.acceptance.md && grep -q '^accepted_by: user$' .orchestration/acceptance/PRODUCTION_READY.acceptance.md`; expected exit code: `0`.

Production Ready uses two stages: the orchestrator runs every checkbox except
`User acceptance record exists`; after all return `0`, it presents the
evidence to the user. Only the user may authorize creation of the final
acceptance record, after which the final checkbox is run. The release evaluator
must not read that final acceptance record.

Mandatory proof paths:

- specification normalization: `.orchestration/validation/PHASE-A0.md`, `.orchestration/validation/A0-01.md` through `.orchestration/validation/A0-09.md`
- user specification decisions: `.orchestration/decisions/A0-03.yaml`, `.orchestration/decisions/A0-08.yaml`
- production profile: `.orchestration/validation/B1-01.md`
- live smoke success/outage: `.orchestration/validation/B2-04-live.json`, `.orchestration/validation/B2-04-outage.json`
- OpenSandbox full workflow: `.orchestration/validation/C2-01.run-id`, `.orchestration/validation/C2-01-ci-artifacts/`
- governed real-data path: `.orchestration/validation/E1-01-real.json`
- phase evidence: `.orchestration/validation/PHASE-A0.md`, `PHASE-A.md`, `PHASE-B.md`, `PHASE-C.md`, `PHASE-D.md`, `PHASE-E.md`, `PHASE-F.md`, `PHASE-G.md`
- recovery: `.orchestration/validation/F1-05-recovery.json`
- policy operations: `.orchestration/validation/F1-04.md`
- distribution/security CI: `.orchestration/validation/G2-03.run-id`
- final decision: `.orchestration/acceptance/PRODUCTION_READY.acceptance.md`

## Change management and new-gap handling

### The only permitted plan-deviation procedure

1. Worker stops before the deviating edit and writes `.orchestration/reports/<WU-ID>.deviation-request.md` with the conflicting plan text, source evidence, blocked DoD, and proposed replacement.
2. Worker sends `AGMSG-RESULT v1 status=blocked` referencing that file. Worker changes no out-of-plan file.
3. Orchestrator reviews the request and writes `.orchestration/plan/revisions/<revision-id>.md` with exact plan diff, affected GAP/WU IDs, dependency changes, and replacement verification commands/exit codes.
4. User approves any scope, production topology, credential, real-data, or acceptance change. Orchestrator approval is sufficient only for a command/path clarification that changes no scope or trust boundary.
5. Orchestrator updates `plans/001-production-work-plan.md`, increments `plan revision`, runs `plans/validate-production-plan.mjs`, writes `.orchestration/acceptance/PLAN-<revision-id>.acceptance.md`, and sends a new AGMSG-TASK. Only that new task authorizes resumed work.

Any edit that skips one of these five steps is forbidden.

### A newly discovered gap during implementation

1. Worker does not fix it in the active WU.
2. Worker appends one evidence-backed row to `.orchestration/reports/<WU-ID>.new-gaps.md` with severity proposal, file:line, impact, and blocking relation.
3. If the new gap invalidates an active DoD or trust boundary, worker sends `status=blocked`. If it does not, worker completes only the existing WU scope.
4. Orchestrator assigns a new GAP-ID, updates the register and traceability tables through the deviation procedure, and creates a new WU or revises one existing WU.

## Traceability: GAP-ID to primary WU-ID

| GAP | WU | GAP | WU | GAP | WU |
| --- | --- | --- | --- | --- | --- |
| GAP-001 | G1-01 | GAP-019 | C1-02 | GAP-037 | B2-04 |
| GAP-002 | A2-01 | GAP-020 | C1-02 | GAP-038 | A2-01 |
| GAP-003 | G1-02 | GAP-021 | D1-01 | GAP-039 | D2-01 |
| GAP-004 | G1-02 | GAP-022 | D1-02 | GAP-040 | D2-02 |
| GAP-005 | G1-01 | GAP-023 | D1-02 | GAP-041 | D2-01 |
| GAP-006 | A2-02 | GAP-024 | D1-02 | GAP-042 | G2-01 |
| GAP-007 | F1-01 | GAP-025 | B2-03 | GAP-043 | D2-02 |
| GAP-008 | B1-01 | GAP-026 | B2-03 | GAP-044 | G3-01 |
| GAP-009 | B1-02 | GAP-027 | B2-04 | GAP-045 | G3-02 |
| GAP-010 | B1-03 | GAP-028 | F1-01 | GAP-046 | G2-02 |
| GAP-011 | B1-03 | GAP-029 | F1-03 | GAP-047 | B2-02 |
| GAP-012 | F1-05 | GAP-030 | F2-01 | GAP-048 | F2-02 |
| GAP-013 | F1-06 | GAP-031 | F2-01 | GAP-049 | C1-02 |
| GAP-014 | B1-03 | GAP-032 | F2-01 | GAP-050 | B2-03 |
| GAP-015 | G1-02 | GAP-033 | G2-01 | GAP-051 | F1-02 |
| GAP-016 | B2-01 | GAP-034 | A1-01 | GAP-052 | C2-01 |
| GAP-017 | C1-01 | GAP-035 | A1-02 | GAP-053 | B1-01 |
| GAP-018 | E1-01 | GAP-036 | C2-01 | GAP-054 | A2-03 |
| GAP-055 | A0-09 | GAP-056 | A1-01 | GAP-057 | G2-03 |
| GAP-058 | G2-03 | GAP-059 | G2-03 | GAP-060 | F1-04 |
| GAP-061 | G2-03 | — | — | — | — |

Coverage assertion: 61 source GAP IDs, 61 mapped GAP IDs, 0 missing, 0 unknown, 0 duplicate primary mappings.

## Reverse traceability: WU-ID to GAP-ID

| WU | GAP IDs |
| --- | --- |
| A0-09 | GAP-055 |
| A1-01 | GAP-034, GAP-056 |
| A1-02 | GAP-035 |
| A2-01 | GAP-002, GAP-038 |
| A2-02 | GAP-006 |
| A2-03 | GAP-054 |
| B1-01 | GAP-008, GAP-053 |
| B1-02 | GAP-009 |
| B1-03 | GAP-010, GAP-011, GAP-014 |
| B2-01 | GAP-016 |
| B2-02 | GAP-047 |
| B2-03 | GAP-025, GAP-026, GAP-050 |
| B2-04 | GAP-027, GAP-037 |
| C1-01 | GAP-017 |
| C1-02 | GAP-019, GAP-020, GAP-049 |
| C2-01 | GAP-036, GAP-052 |
| D1-01 | GAP-021 |
| D1-02 | GAP-022, GAP-023, GAP-024 |
| D2-01 | GAP-039, GAP-041 |
| D2-02 | GAP-040, GAP-043 |
| E1-01 | GAP-018 |
| F1-01 | GAP-007, GAP-028 |
| F1-02 | GAP-051 |
| F1-03 | GAP-029 |
| F1-05 | GAP-012 |
| F1-06 | GAP-013 |
| F1-04 | GAP-060 |
| F2-01 | GAP-030, GAP-031, GAP-032 |
| F2-02 | GAP-048 |
| G1-01 | GAP-001, GAP-005 |
| G1-02 | GAP-003, GAP-004, GAP-015 |
| G2-01 | GAP-033, GAP-042 |
| G2-02 | GAP-046 |
| G2-03 | GAP-057, GAP-058, GAP-059, GAP-061 |
| G3-01 | GAP-044 |
| G3-02 | GAP-045 |

## Specification traceability: SPEC-ID to primary WU-ID

| SPEC | WU | SPEC | WU |
| --- | --- | --- | --- |
| SPEC-01 | A0-01 | SPEC-11 | A0-05 |
| SPEC-02 | A0-01 | SPEC-12 | A0-06 |
| SPEC-03 | A0-01 | SPEC-13 | A0-05 |
| SPEC-04 | A0-02 | SPEC-14 | A0-07 |
| SPEC-05 | A0-03 | SPEC-15 | A0-06 |
| SPEC-06 | A0-04 | SPEC-16 | A0-06 |
| SPEC-07 | A0-04 | SPEC-17 | A0-07 |
| SPEC-08 | A0-05 | SPEC-18 | A0-07 |
| SPEC-09 | A0-04 | SPEC-19 | A0-07 |
| SPEC-10 | A0-05 | SPEC-20 | A0-08 |

Specification coverage assertion: 20 source SPEC IDs, 20 mapped SPEC IDs, 0 missing, 0 unknown, 0 duplicate primary mappings.

## Reverse specification traceability: WU-ID to SPEC-ID

| WU | SPEC IDs |
| --- | --- |
| A0-01 | SPEC-01, SPEC-02, SPEC-03 |
| A0-02 | SPEC-04 |
| A0-03 | SPEC-05 |
| A0-04 | SPEC-06, SPEC-07, SPEC-09 |
| A0-05 | SPEC-08, SPEC-10, SPEC-11, SPEC-13 |
| A0-06 | SPEC-12, SPEC-15, SPEC-16 |
| A0-07 | SPEC-14, SPEC-17, SPEC-18, SPEC-19 |
| A0-08 | SPEC-20 |

## Plan-level query items

Implementation is blocked until the sixteen decision records in the Decision records table are accepted by their named consumers. SPEC-05 and SPEC-20 are unresolved user decisions and cannot be inferred from current code, installed tools, or conflicting documents. F1-04 signing/key custody, F1-05 recovery targets, F1-06 SLO ownership/targets, and G2-03 distribution/security ownership require the named user inputs; workers cannot infer them from git history or local defaults. No other query item remains.

## Plan quality self-audit

- [ ] The plan contains exactly 44 dispatchable WUs — command: `test "$(rg -c '^### WU ' plans/001-production-work-plan.md)" -eq 44`; expected exit code: `0`.
- [ ] Every WU contains each mandatory field exactly once — command: `for p in '^\- \*\*WU-ID\*\*:' '^\- \*\*Preconditions\*\*:' '^\- \*\*依存 WU\*\*:' '^\- \*\*allowed_files\*\*:' '^\- \*\*forbidden_actions\*\*:' '^\- \*\*実装内容\*\*:' '^\- \*\*決定を要する点\*\*:' '^\- \*\*DoD\*\*:' '^\- \*\*Verification\*\*:' '^\- \*\*証跡パス\*\*:' '^\- \*\*想定される逸脱と禁止事項\*\*:'; do test "$(rg -c "$p" plans/001-production-work-plan.md)" -eq 44 || exit 1; done`; expected exit code: `0`.
- [ ] Every DoD checkbox contains a command and expected exit code — command: `awk '/^  - \[ \]/ && ($0 !~ /command:/ || $0 !~ /expected exit code:/) {bad=1} END {exit bad+0}' plans/001-production-work-plan.md`; expected exit code: `0`.
- [ ] WU metadata maps every source GAP exactly once — command: `test "$(rg '^\- \*\*WU-ID\*\*:' plans/001-production-work-plan.md | rg -o 'GAP-[0-9]{3}' | wc -l | tr -d ' ')" -eq 61 && test "$(rg '^\- \*\*WU-ID\*\*:' plans/001-production-work-plan.md | rg -o 'GAP-[0-9]{3}' | sort -u | wc -l | tr -d ' ')" -eq 61`; expected exit code: `0`.
- [ ] A0 metadata maps every source SPEC exactly once — command: `test "$(rg '^\- \*\*WU-ID\*\*: `A0-' plans/001-production-work-plan.md | rg -o 'SPEC-[0-9]{2}' | wc -l | tr -d ' ')" -eq 20 && test "$(rg '^\- \*\*WU-ID\*\*: `A0-' plans/001-production-work-plan.md | rg -o 'SPEC-[0-9]{2}' | sort -u | wc -l | tr -d ' ')" -eq 20`; expected exit code: `0`.
- [ ] Primary and reverse traceability tables each contain all 61 GAP IDs — command: `test "$(sed -n '/^## Traceability: GAP-ID to primary WU-ID/,/^Coverage assertion:/p' plans/001-production-work-plan.md | rg -o 'GAP-[0-9]{3}' | wc -l | tr -d ' ')" -eq 61 && test "$(sed -n '/^## Reverse traceability: WU-ID to GAP-ID/,/^## Specification traceability/p' plans/001-production-work-plan.md | rg -o 'GAP-[0-9]{3}' | wc -l | tr -d ' ')" -eq 61`; expected exit code: `0`.
- [ ] Primary and reverse specification tables each contain all 20 SPEC IDs — command: `test "$(sed -n '/^## Specification traceability: SPEC-ID to primary WU-ID/,/^Specification coverage assertion:/p' plans/001-production-work-plan.md | rg -o 'SPEC-[0-9]{2}' | wc -l | tr -d ' ')" -eq 20 && test "$(sed -n '/^## Reverse specification traceability: WU-ID to SPEC-ID/,/^## Plan-level query items/p' plans/001-production-work-plan.md | rg -o 'SPEC-[0-9]{2}' | wc -l | tr -d ' ')" -eq 20`; expected exit code: `0`.
- [ ] Every policy-owning A0 WU contains a repository-resolved direct negative OPA evaluation DoD — command: `for id in A0-01 A0-02 A0-03 A0-04 A0-05 A0-06 A0-07 A0-08; do sed -n "/^### WU $id /,/^### WU /p" plans/001-production-work-plan.md | rg -q '\- \[ \].*command: `.*OPA_BIN=.*"\$OPA_BIN" eval .*(not |deny)' || exit 1; done`; expected exit code: `0`.
- [ ] Every B/C/D/E precondition requires Phase A0 evidence — command: `for id in B1-01 B1-02 B1-03 B2-01 B2-02 B2-03 B2-04 C1-01 C1-02 C2-01 D1-01 D1-02 D2-01 D2-02 E1-01; do sed -n "/^### WU $id /,/^### WU /p" plans/001-production-work-plan.md | rg -q '^\- \*\*Preconditions\*\*:.*PHASE-A0.md' || exit 1; done`; expected exit code: `0`.
- [ ] Discretionary placeholders, malformed WUs, missing GAPs, and traceability drift are absent — command: `./node_modules/node/bin/node plans/validate-production-plan.mjs`; expected exit code: `0`.
- [ ] Every decision record path is named in its consumer precondition — command: `for f in $(sed -n '/^## Decision records/,/^Workers are forbidden/p' plans/001-production-work-plan.md | rg -o '\.orchestration/decisions/[A-Z0-9-]+\.yaml'); do test "$(rg -F -c "$f" plans/001-production-work-plan.md)" -ge 2 || exit 1; done`; expected exit code: `0`.
