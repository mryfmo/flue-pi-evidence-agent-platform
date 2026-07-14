# Plan 001: A0-01-R3 guard-produced runtime classification

> **Executor instructions**: Execute only the accepted semantics in `.orchestration/decisions/A0-01-R3.yaml`. Step 1 remains a separate controlled delegation. Stop rather than broadening detection patterns or inventing trust metadata.
>
> **Drift check**: before work, run the literal `R3_RUNTIME_PATHS` commands in Scope and require both tracked/untracked output empty; HEAD must equal `e5d077b`. After work, rerun them and require tracked output is a subset of that exact array and untracked output is empty. Separately require `git diff e5d077b -- policy/routing.json` to equal only the accepted prerequisite. `base..HEAD` alone is forbidden because it misses uncommitted work.

## Status

- **Priority**: P0
- **Effort**: S
- **Risk**: HIGH — no implemented classification producer/PEP evidence boundary exists.
- **Depends on**: accepted `.orchestration/decisions/A0-01-R3.yaml`; user-approved controlled edit limited to `policy/routing.json` classification catalog. Production exposure remains blocked by the exact B2-01 invocation/approval integration contract and B2-02 redaction contract in `.orchestration/plan/revisions/B2-01-R1-gateway-invocation-approval-v1.md`.
- **Category**: security/correctness
- **Planned at**: commit `e5d077bb4bab411d3448c4b5742108247d5d94ab`, 2026-07-13
- **State**: READY; Step 0 accepted by the user on 2026-07-14. Controlled Step 1 and runtime Step 2 remain separately delegated.

## Plan quality self-audit

- Atomic scope: one guard-output/PEP verification path; required sections and measured `file:line` evidence are present.
- Four Positive/Adversarial verify pairs, seven done checks, five specific STOP conditions, and six security invariants are machine-reviewable.
- This repo's production-plan validator is mandatory; the external skill validator/hook/CI entry points are unavailable here, so its independent-review checklist is applied by a separate reviewer.
- This repo has `make validate-release`, not `make verify`; do not invent `make verify`.

## Why this matters

Strict Rego correctly rejects current scalar-only gateway decisions. Adding caller-supplied `classification` to `ProductionGatewayRequest`, or wrapping its scalar with constant proof strings, would merely move the forgery into TypeScript. Authorization must use classification emitted by the fixed `flue-pi-data-guard` process and verified inside the gateway/PEP, never a public request field.

## Current state

- `src/lib/dataProxy.ts:20` defines only `{redacted_text,entities_found}` and `src/lib/dataProxy.ts:25-47` runs an unbounded child then casts unvalidated JSON.
- `scripts/data_guard.py:206` redacts text but emits no class, digest, schema version, producer, or evidence kind; `scripts/data_guard.py:220` exposes only `redact_text`.
- `src/lib/productionGateway.ts:22` publicly extends `RoutingInput`, exposing untrusted `data_classification`; lines 28/31 also expose policy-path and approval authority. `src/lib/productionGateway.ts:241` independently redacts each message; `src/lib/productionGateway.ts:247` authorizes without guard classification.
- `src/lib/router.ts:69` accepts no verified guard result; strict `policy/routing.rego:29` expects `decision.classification.value` and `policy/routing.rego:35` exact provenance.
- No product caller invokes `callProductionGateway`; `rg -n "callProductionGateway" src` matches only its definition. The HTTP PEP at `src/app.ts:150` verifies identity context but is not connected to LLM classification.
- `tests_py/test_data_guard.py:28` covers redaction only; existing `tests/component/data_proxy.test.ts` has no classification IPC adversarial matrix; `tests/contract/llm_contract.test.ts:99` constructs caller-authoritative gateway requests.
- Current gateway assertions at `tests/contract/llm_contract.test.ts:127`, `tests/contract/llm_contract.test.ts:271`, `tests/contract/llm_contract.test.ts:407`, `tests/failure/llm_outage.test.ts:17`, `tests/failure/llm_outage.test.ts:56`, `tests/component/routing.test.ts:55`, and `tests/component/routing.test.ts:93` exercise no real producer/PEP evidence path.
- `docs/PRODUCT_REQUIREMENTS.md:36` requires guard-produced PEP input, while `docs/INTEGRATION_BOUNDARY.md:75` says the scalar is only an input to classification flow.
- `src/lib/productionGateway.ts:187` and `:321` still copy caller `data_classification` to telemetry/provider metadata. `routing_policy_path` selects the authorization catalog, and truthy caller `approval_ref` bypasses `confidential_requires_approval`; all three are R3-mandatory removals.
- `audit_log_path`, identity/tenant/selectors, correlation IDs, and metadata labels also remain caller-origin. Because no product caller exists, their verified invocation context and gateway-owned sink are assigned as blocking B2-01 integration requirements; R3 does not claim to close that wider gateway boundary.
- `.orchestration/decisions/A0-01-R3.yaml` now defines raw-source classification, a closed precedence table, max-sensitivity aggregation, no post-redaction downgrade, guard-owned route selection, reserved/unreachable automatic `public`, and typed zero-dispatch failure.
- A bounded loopback-allowed full Vitest diagnostic at `e5d077b` terminated in 51.03 seconds with 15 failures, all confined to the missing guard-classification/PEP path or the stale wrapped production-policy assertion; 127 tests passed and 4 skipped. No unknown failure remains.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Boundary search | `rg -n "callProductionGateway|redactText|redact_text|classification" src scripts tests_py tests` | only approved producer/PEP path |
| Python | `./node_modules/node/bin/node scripts/run-with-timeout.mjs 90 .venv/bin/python -m pytest -q tests_py/test_data_guard.py` | exit 0, not 124 |
| Focused TS | `./node_modules/node/bin/node scripts/run-with-timeout.mjs 120 ./node_modules/.bin/vitest run tests/component/data_proxy.test.ts tests/component/routing.test.ts tests/contract/llm_contract.test.ts tests/failure/llm_outage.test.ts --pool=forks` | exit 0, not 124 |
| Contract | `./node_modules/node/bin/node scripts/spec-check.mjs --check-spec SPEC-01,SPEC-02,SPEC-03 && ./node_modules/node/bin/node scripts/opa-test.mjs && ./node_modules/node/bin/node scripts/opa-check.mjs` | exit 0; OPA 166/166 |
| Static/scope | `npm run typecheck && npm run lint && npm run format:check`, then the literal Scope oracle | exit 0; tracked subset, untracked empty |
| Full later | bounded `./node_modules/.bin/vitest run --pool=forks` then `make validate-release` | exit 0; no residual worker |
| Plan gate | `./node_modules/node/bin/node plans/validate-production-plan.mjs` | exit 0; 44 WUs / 61 GAPs / 20 SPECs |

## Scope

**Approved runtime/test files**:

- `scripts/data_guard.py`, `src/lib/dataProxy.ts`, `src/lib/router.ts`, `src/lib/productionGateway.ts`
- `tests_py/test_data_guard.py`, existing `tests/component/data_proxy.test.ts`
- `tests/component/routing.test.ts`, `tests/contract/llm_contract.test.ts`, `tests/failure/llm_outage.test.ts`

**Approved specification/decision files**:

- new `.orchestration/decisions/A0-01-R3.yaml`
- `docs/PRODUCT_REQUIREMENTS.md`, `docs/POLICY_MODEL.md`, `docs/INTEGRATION_BOUNDARY.md`, `docs/PRODUCTION_GATEWAY_DESIGN.md`

**Mandatory controlled file, separate delegation only**: `policy/routing.json`, adding only the existing exact classification catalog.

**Forbidden**: public `ProductionGatewayRequest.data_classification`, `routing_policy_path`, `approval_ref`, or classification/proof fields; scalar auto-wrap; truthy-string approval; proof constants without verified guard evidence; `policy/routing.rego`, `policy/routing.prod.json`, routing schemas/Rego tests, prod routes/providers/fallbacks/models, other policy, task/main-plan edits, commit/push/release.

**Literal runtime scope oracle**:

```bash
R3_RUNTIME_PATHS=(scripts/data_guard.py src/lib/dataProxy.ts src/lib/router.ts src/lib/productionGateway.ts tests_py/test_data_guard.py tests/component/data_proxy.test.ts tests/component/routing.test.ts tests/contract/llm_contract.test.ts tests/failure/llm_outage.test.ts docs/PRODUCT_REQUIREMENTS.md docs/POLICY_MODEL.md docs/INTEGRATION_BOUNDARY.md docs/PRODUCTION_GATEWAY_DESIGN.md)
git diff --name-only -- "${R3_RUNTIME_PATHS[@]}"
git ls-files --others --exclude-standard -- "${R3_RUNTIME_PATHS[@]}"
git diff --check -- "${R3_RUNTIME_PATHS[@]}"
```

Pre-task the first two outputs are empty. Post-task, the first output is checked line-by-line against the array, the second stays empty, and diff-check exits 0. The orchestrator snapshots full `git status --porcelain=v1` before delegation and rejects any new path outside this array plus the separately accepted policy/evidence paths.

## Steps

### Step 0: Record accepted classification semantics — complete

Use `.orchestration/decisions/A0-01-R3.yaml` for the user-approved high-level semantics: classify raw outbound content; deterministic secret/credential detection wins over Presidio; any Presidio entity is confidential; otherwise internal; `public` is reserved and is never emitted without separately verified public-origin proof; aggregate maximum sensitivity; redaction never downgrades; route selection uses only the guard class; public request classification is removed; any failure returns typed `classification_unavailable` with zero dispatch. Exact regex and IPC mechanics below are orchestrator-owned implementation design, not attributed to the user. Known-pattern detection is not exhaustive; production external release remains blocked on B2-02.

**Verify** — Positive: the decision contains expected classes for no findings, PII, generic secret/credential, mixed messages, and guard failure; this plan separately fixes exact patterns and counterexamples.

**Verify** — Adversarial: automatic `public`, caller scalar authority, post-redaction downgrade, broadened secret heuristics, or absent zero-dispatch failure blocks implementation.

### Step 1: Complete the controlled local catalog prerequisite

After explicit authorization, delegate only `policy/routing.json` using `AGMSG_FROM=codex-gpt56sol-flue node scripts/orchestrator/delegate.mjs --task-id A0-01-R3-POLICY --task-file .orchestration/tasks/A0-01-R3-POLICY.md --to codex-gpt56sol-high-a004 --lease policy/routing.json`; render with `AGMSG_AGENT=codex-gpt56sol-flue node scripts/orchestrator/status.mjs --task-id A0-01-R3-POLICY`, then accept only through `accept.mjs` after exact-diff review. Add only:

```json
"classification":{"producer":"flue-pi-data-guard","verified_by":"flue-pi-platform-gateway","evidence_kind":"presidio-sqlglot-redaction-v1","enum":["public","internal","confidential","restricted"]}
```

**Verify** — Positive: `git diff -- policy/routing.json` shows exactly that member; OPA remains 166/166.

**Verify** — Adversarial: any route/provider/default/version change blocks acceptance.

### Step 2: Produce and verify bound guard evidence

The orchestrator-owned restricted detector is deliberately bounded to these exact Python `re.ASCII` patterns:

```text
pem_private_key = -----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----
aws_access_id = \bA[KS]IA[A-Z0-9]{16}\b
github_legacy_or_app = \bgh[pousr]_[A-Za-z0-9_.-]{20,}\b
github_fine_grained_pat = \bgithub_pat_[A-Za-z0-9_]{20,}\b
openai_style_key = \bsk-[A-Za-z0-9_-]{20,}\b
slack_xox_token = \bxox[bpars]-[A-Za-z0-9-]{10,}\b
slack_app_token = \bxapp-[A-Za-z0-9-]{10,}\b
slack_workflow_token = \bxwfp-[A-Za-z0-9-]{10,}\b
explicit_assignment = (?i)\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|aws[_-]?secret[_-]?access[_-]?key|aws[_-]?session[_-]?token|private[_-]?key|password|passwd|secret|token)\b\s*[:=]\s*["']?[^\s"']{8,}["']?
```

For every family test the exact lower boundary, one-character-short non-match, surrounding punctuation, and look-alike prefix non-match. The Slack families cover the current officially documented `xoxb-`, `xoxp-`, `xapp-`, and `xwfp-` prefixes; this known-pattern layer still complements Presidio and cannot claim complete secret discovery. B2-02 corpus/recognizer acceptance remains required before production external release.

The exact IPC contract is:

- Command: `scripts/data_guard.py classify_messages`; TypeScript sends exact UTF-8 bytes for `{"schema_version":1,"messages":[...]}`.
- Request keys are exactly `schema_version,messages`; each message keys exactly `role,content`; duplicate/extra/missing keys reject; roles are the closed enum; length is 1..128; total stdin is at most 1,048,576 bytes.
- Result keys and insertion order are exactly `schema_version,producer,evidence_kind,request_sha256,redacted_sha256,classification,entities_found,messages`; emitted classification is only `internal|confidential|restricted`; count is a non-negative integer; roles/order/count exactly match input.
- `request_sha256` is 64 lowercase hex over exact stdin bytes. `redacted_sha256` is over UTF-8 `json.dumps(messages, ensure_ascii=False, separators=(",", ":"))`, with each Python dict inserted as `role` then `content`; TypeScript `JSON.stringify(messages)` must be byte-identical before acceptance.
- Python rejects duplicate request keys with `object_pairs_hook`. It writes exactly one compact result JSON plus one LF using `ensure_ascii=False` and the key order above. TypeScript first requires `Object.keys(parsed)` to equal the listed result-key sequence, then requires `stdout === JSON.stringify(parsed) + "\n"`; the explicit sequence check rejects reordered keys, while the byte check rejects duplicate, whitespace-padded, multi-line, or otherwise non-canonical bytes without a custom parser.
- Deadline is 5,000 ms; stdout at most 1,048,576 bytes; stderr at most 65,536 bytes; any breach, including stdin `EPIPE`, aborts/kills, waits for close, settles exactly once as `classification_unavailable`, and leaves no timer/listener/child.

Test first, then add only the fixed `classify_messages` command and exact plan-owned request/result/digest contract. Hash exact stdin before parsing. Reject every contract deviation or automatic `public`.

In `dataProxy.ts`, replace cast-only parsing for this path with a closed runtime validator. Invoke only the fixed child path with a 5,000 ms deadline, 1 MiB stdout limit, 64 KiB stderr limit, abort/kill on any limit, and exactly-once settlement after close. Recompute both digests, validate enum/version/producer/evidence kind and roles/order/count, then privately add `verified_by=flue-pi-platform-gateway`. The internal result is not accepted as a `ProductionGatewayRequest` property.

**Verify** — Positive: Python and data-proxy tests accept one genuine bound result and preserve redacted roles/order.

**Verify** — Adversarial: duplicate/extra/missing/reordered field, non-canonical result bytes, stale digest, swapped message, forged producer/kind, unknown/public class, malformed JSON, nonzero child exit, stdin `EPIPE`, 5,001 ms hang, stdout/stderr overflow, abort race, or caller classification input fails closed; child exits and promise settles once with no residual timer/listener/process.

### Step 3: Integrate the private PEP result

Stop extending public `ProductionGatewayRequest` from `RoutingInput`; remove `data_classification`, `routing_policy_path`, and `approval_ref`. Load only the deployment-profile fixed policy path (`policy/routing.json` or `policy/routing.prod.json`), never a request path. `callProductionGateway` invokes the verified guard before selection, constructs internal `RoutingInput.data_classification` and classification proof from the same guard value, and uses that value in OPA, span, audit, and provider metadata. Until a verified approval context is integrated, no approval field reaches the decision and confidential external stays `confidential_requires_approval`. Remove `.routing_prod` loader compatibility; preserve named denials and local strictness.

**Verify** — Positive: focused/Python/contract/static commands pass; genuine internal guard output reaches provider and outage paths; genuine confidential/restricted values reach their exact denial branches.

**Verify** — Adversarial: a structural request containing removed `data_classification`, `routing_policy_path`, `approval_ref`, or proof cannot affect policy, approval, telemetry, audit, or provider metadata; forged evidence dispatches zero requests; wrapped policy fails closed.

Update all four normative documents with non-optional assertions: `PRODUCT_REQUIREMENTS` names raw-source producer classification and the B2-02 residual blocker; `POLICY_MODEL` states no caller catalog/approval/class authority and confidential external denial; `INTEGRATION_BOUNDARY` defines fixed deployment policy and closed IPC/metadata ownership; `PRODUCTION_GATEWAY_DESIGN` removes the three public fields and binds route/span/audit/provider class to the verified guard result. `rg` must find no prose claiming request-body classification or truthy approval authority.

### Step 4: Accept gates

Run Python → focused TS → SPEC/OPA → static/scope. The sandbox catalog repair is already complete at `aa04655`; run the bounded full suite after the focused commands pass, then start release validation from gate 1.

**Verify**: every command meets Expected; timeout, partial output, or remaining worker is failure.

## Test plan

- Python: accepted mapping table, redaction, raw/redacted digests, mixed-message aggregation, ambiguous failure.
- Data proxy: closed parser and every evidence mutation; prove scalar is not passed as authoritative output.
- Routing/gateway: internal guard-produced allow; missing/forged/mismatch deny and zero dispatch; removed public authority fields; trusted fixed document; local strictness; restricted/confidential exact denials.
- Outage: genuine verified classification reaches `llm_unavailable`, not classification denial.
- Documentation: removed request authority, trusted policy owner, confidential denial, metadata source, heuristic limitation, and B2-01/B2-02 blockers.

## Done criteria

- [x] Step 0 decision is explicit, accepted, and covers every listed semantic choice.
- [ ] Public request has no data-classification, policy-path, approval, classification, or proof authority; all effective classification metadata comes from one verified guard result.
- [ ] Actual fixed guard process emits class plus content-bound evidence; PEP closed-validates it before adding verifier metadata.
- [ ] Missing/forged/stale/mismatched/unclassifiable evidence denies with zero dispatch; local has no bypass.
- [ ] Controlled local catalog is separately authorized/delegated/accepted; prod policy/Rego/schemas/routes/providers are unchanged.
- [ ] Python, focused, SPEC/OPA 166/166, static, scope, and plan-quality gates pass.
- [ ] Full bounded suite/release passes later; plan revision changed no source and created no commit.
- [ ] Acceptance states R3 closes classification only; B2-01 verified invocation context, source-bound single-use approval, and audit sink plus B2-02 production redaction remain production blockers.

## STOP conditions

- Decision record drift, automatic `public`, caller authority, post-redaction downgrade, or detection beyond the orchestrator-owned fixed pattern table.
- Guard cannot emit a class independently of the caller scalar, or output cannot bind exact messages/redaction.
- Design exposes data classification, policy selection, approval, verified classification/proof on public request input, or relies on strings/type branding as authenticity.
- Passing requires Rego/schema weakening, local bypass, wrapper compatibility, new route/provider, or forbidden-file change.
- Verification fails twice, full run times out, or workers remain; report partial evidence.

## Maintenance notes

- Keep guard evidence versioned and content-bound; constants are metadata, not authentication.
- Any classification mapping or proof change requires coordinated decision, producer, PEP, policy, docs, and counterexample review.
- Keep the only public authority path at the PEP; internal TypeScript types do not create trust.

## 安全回帰

- Caller scalar alone never authorizes or becomes proof.
- Caller cannot submit or overwrite verified classification.
- Only bound, closed-validated guard output reaches OPA.
- Missing/forged/stale/mismatched evidence never dispatches.
- Local mode never bypasses guard/PEP verification.
- Rego, schemas, prod policy, routes/providers/fallbacks remain strict and unchanged.
- Caller-controlled catalog or truthy approval can never authorize; confidential external remains denied pending verified approval integration.
