# Production Gateway Design

## Purpose

This document defines the production LLM gateway and model-routing design for the Flue/Pi evidence agent platform.

The current deterministic local OpenAI-compatible gateway remains the validation provider. It is used by `validate-release` so release gates stay reproducible and free of external LLM nondeterminism. The production gateway is an additional Pi provider registration behind the same `openai-completions` contract.

## SPEC-05 canonical production rule

The sole normative rule is `production_fallback_prohibited`. Production can use only its approved provider chain. The deterministic local gateway is unreachable from production routing. When that chain is exhausted, the exact gateway result is `ok:false, reason=llm_unavailable`, and the workflow outcome is `typed_failure_no_summary`; no summary or other content is returned.

Synthetic output is permitted only under `local_validation_only` and must carry `evidence_status=explicitly_marked_non_evidence`. It cannot satisfy production, release, acceptance, audit, or remediation evidence. Missing or different markers deny authorization.

Execution-state authorization uses `decision.execution`:

- When `execution` is present, `environment` is required and must be exactly `production` or `local_validation`; missing, malformed, or unknown values deny.
- `fallback_mode` uses the closed vocabulary `none`, `local`, or `deterministic_local`; missing is permitted and any other value denies. `environment=production` denies both local modes and every `local_gateway` provider.
- Any production exhaustion/result state requires `provider_chain_exhausted=true` and the exact three-field result `{ok:false, reason:llm_unavailable, workflow_outcome:typed_failure_no_summary}`. Missing, false, or malformed exhaustion and any `content` field deny.
- Any `synthetic_output` object requires `environment=local_validation`, `scope=local_validation_only`, and `evidence_status=explicitly_marked_non_evidence`.
- These execution-state rules are additional to the complete tenant, route, provider, model, and trusted-classification tuple; they never authorize a route by themselves.

## Scope

In scope:

- Production provider registration for external and self-hosted LLM providers.
- Policy-driven model routing.
- Redaction before outbound calls.
- Audit and OpenTelemetry evidence for every gateway call.
- Fail-closed authorization and dependency posture.
- Contract testing with mock providers.

Out of scope:

- Learned, semantic, or adaptive routers.
- Secret-manager integration. API keys are environment-injected until G3/P2-T05.
- Live-provider smoke tests as release gates.
- External OpenMetadata or Trino integration.
- Side-effecting tool execution by the LLM path.
- Replacing `src/lib/localGateway.ts` in release validation.

## Architecture

```text
Flue/Pi summarization request
  -> production gateway boundary
  -> routing input builder
  -> offline prompt redaction
  -> OPA eap.routing authorization
  -> routing policy lookup
  -> provider adapter using openai-completions contract
  -> response normalization
  -> audit JSONL + OpenTelemetry span
  -> verified-evidence summary returned to workflow

Production provider chain:
  primary provider
    -> secondary provider
    -> typed failure: ok:false, reason=llm_unavailable
       workflow outcome: typed_failure_no_summary
```

The agent loop remains gated. The LLM path summarizes verified evidence only. Tool execution stays in typed workflow tools controlled by OPA, verifiers, the data guard, and closure gates.

## Prod Provider Path: Gateway -> LiteLLM

Phase 8 production routing uses `PI_PROVIDER=prod` to select `policy/routing.prod.json`. That path is:

```text
Flue/Pi request
  -> platform gateway
  -> redaction, classification, OPA route authorization, fail-closed handling, audit primary record
  -> LiteLLM Proxy on 127.0.0.1
  -> approved worker aliases only
```

Responsibility split:

| Layer | Owns | Must not own |
| --- | --- | --- |
| Platform gateway | Redaction, data-classification decision, OPA authorization, fail-closed behavior, task correlation metadata, and primary audit records. | Provider fallback policy outside the approved route document or direct upstream provider keys. |
| LiteLLM Proxy | Approved model alias resolution, in-list fallback, rate limits, virtual-key enforcement, and provider cost/usage reporting. | Raw prompt logging, policy decisions, data classification, or bypass routes around the gateway. |

`PI_PROVIDER=local` or an unset value selects `policy/routing.json`, which is the deterministic validation path. The local path may use the deterministic local gateway for CI and regression validation. The prod path must not include deterministic local fallback; if all approved LiteLLM aliases are unavailable, the gateway returns `ok:false` with `reason=llm_unavailable`.

## Typed Contracts

`schemas/routing-policy.schema.json` is the sole production routing document shape and `policy/routing.prod.json` is an instance of it. The document is flat (`version`, `defaults`, `classification`, `routes`, `providers`) and is passed directly as `input.policy` to `data.eap.routing`; the former `routing_prod` wrapper is invalid and cannot authorize.

`schemas/run-outcome.schema.json` defines the complete workflow run outcome enum: `passed`, `needs_review`, and `failed`. Missing, unknown, or malformed outcomes are invalid. A `failed` outcome requires one typed failure code; `passed` and `needs_review` prohibit a failure object. Audit sink, telemetry emission, sandbox lifecycle, and sandbox evidence failures use `audit_sink_failure`, `telemetry_emission_failure`, `sandbox_lifecycle_failure`, and `sandbox_evidence_failure` and can never be represented as success.

The production gateway uses the same provider shape as the deterministic local gateway:

- Provider API: `openai-completions`
- Endpoint behavior: OpenAI-compatible `/chat/completions`, including streaming support where the provider offers it.
- Registration: a Pi provider name maps to `{ api, baseUrl, apiKey, models }`.
- Model identifiers: loaded from routing config, never hard-coded in code.

Request contract:

| Field | Source | Notes |
| --- | --- | --- |
| `tenant` | workflow payload | Required for routing and OPA authorization. |
| `user` | workflow payload | Used for audit and policy context. |
| `task_kind` | workflow or agent call site | Example: `verified_evidence_summary`. |
| `cost_budget` | tenant or run config | Upper bound used by deterministic routing policy. |
| `latency_target` | tenant or run config | Target class, not a runtime learned signal. |
| `messages` | Flue/Pi request | Redacted before external provider call. |
| `audit_id` | workflow audit context | Propagated to audit and telemetry. |
| `trace_id` | OpenTelemetry active span | Propagated to audit and provider metadata where supported. |

The public request has no `data_classification`, classification/proof, `routing_policy_path`, or `approval_ref` field. Before route selection, the fixed local data guard classifies the complete raw ordered message array and returns closed, canonical, SHA-256-bound evidence plus redacted messages. The gateway accepts only a result it validated in-process, never emits automatic `public`, and never downgrades after redaction.

Successful response contract:

| Field | Notes |
| --- | --- |
| `provider` | Actual provider used after fallback. |
| `model_id` | Actual model used after fallback. |
| `content` | Summary text returned to the agent layer. |
| `usage` | Input tokens, output tokens, and total tokens when available. |
| `latency_ms` | Measured gateway call latency. |
| `estimated_cost` | Deterministic estimate from routing config pricing. |
| `routing_decision` | Policy version, selected route, and fallback state. |
| `content_digests` | Hashes of redacted request and response content. |

Raw prompts, raw responses, and API keys are not written to audit logs.

Exhausted production chain failure contract:

| Field | Exact value |
| --- | --- |
| `ok` | `false` |
| `reason` | `llm_unavailable` |
| `workflow_outcome` | `typed_failure_no_summary` |

The failure object has exactly these fields. In particular it has no `content`, provider-generated summary, deterministic summary, or synthetic success body.

## Routing Policy

Routing is a pure function:

```text
{tenant, data_classification, task_kind, cost_budget, latency_target}
  -> {provider, model_id, fallback_chain}
```

The policy lives in the fixed deployment-selected JSON document: `policy/routing.json` for local validation or `policy/routing.prod.json` for production. A request cannot choose the path. Its only valid shape is the direct flat `schemas/routing-policy.schema.json` document; the former `routing_prod` wrapper is rejected. OPA authorizes the selected route through `eap.routing` using the same fail-closed adapter posture as `src/lib/opa.ts`.

Learned routers are a recorded non-goal. Revisit only if a future requirement proves static policy cannot express tenant, classification, cost, and latency constraints.

## Security Invariants

| # | Invariant | Enforcement point | Evidence / test idea |
| --- | --- | --- | --- |
| 1 | Raw outbound messages are classified before redaction, and redaction runs before any external call without downgrading the class. | Fixed data-guard IPC and production gateway before route selection/provider dispatch. | Guard tests bind raw/redacted digests and maximum sensitivity; contract tests assert confidential/restricted or guard failure dispatches nothing. |
| 2 | Audit ID and OpenTelemetry trace ID are propagated on every call. | Gateway call context; audit append through `src/lib/audit.ts`; span through `src/lib/telemetry.ts`. | Contract test asserts audit JSONL has `audit_id`, `trace_id`, provider, model_id, routing decision, token counts, latency, and content digests. |
| 3 | Request and response content are recorded as hashes, not raw content. | Audit event builder after redaction and after response normalization. | Unit test asserts audit records contain request/response digest fields and do not contain raw prompt or raw completion text. |
| 4 | Fail closed on routing policy unavailable, redaction unavailable, or OPA deny. | Gateway preflight: load routing config, run redaction, call `eap.routing`; any failure returns no external call. | Mock provider receives zero calls when config load, redaction, or OPA authorization fails. |
| 5 | API keys are environment-injected only. | Provider adapter construction reads named environment variables; config stores env var names, not secret values. | Static test scans routing config and audit logs for key material; runtime test asserts missing key fails closed before dispatch. |
| 6 | LLM output is summarization-only and cannot authorize side effects. | Agent/workflow boundary: typed tools and OPA remain the only side-effect authority. | Regression test confirms a model response cannot trigger patching without workflow policy and verifier gates. |

API keys are never logged, never sent in agmsg messages, and never written to audit records.

## Failure Posture

- Routing config missing, malformed, or policy version unauthorized: fail closed, no external call.
- `eap.routing` unavailable or OPA deny: fail closed, no external call.
- Classification/redaction unavailable, malformed, forged, stale, mismatched, timed out, or oversized: return `classification_unavailable`, fail closed, and make no provider call.
- Provider API key missing: fail closed, no external call.
- Primary provider timeout or provider error: try only the configured approved production provider chain.
- All approved production providers fail: return exactly `ok:false, reason=llm_unavailable`; the workflow records `typed_failure_no_summary` and no summary content.
- Production never reaches the deterministic local gateway and never converts exhaustion into synthetic success.
- Local validation may emit synthetic output only with `scope=local_validation_only` and `evidence_status=explicitly_marked_non_evidence`.
- Audit sink write failure, telemetry emission failure, sandbox lifecycle failure, or missing sandbox evidence terminates the run with its typed `failed` outcome from `schemas/run-outcome.schema.json`; none may be downgraded to warning or represented as success.

## Provider Matrix

| Provider | Contract | Default model_id | Low-cost model_id | Key source | Notes |
| --- | --- | --- | --- | --- | --- |
| Anthropic API | Anthropic adapter normalized to `openai-completions` | `claude-sonnet-5` | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` | Default production route candidate. |
| OpenAI API | OpenAI-compatible completions | `gpt-5.5` | Config-selected | `OPENAI_API_KEY` | Secondary provider candidate. |
| Self-hosted OpenAI-compatible endpoint | OpenAI-compatible completions | Config-selected | Config-selected | endpoint-specific env vars | Example: vLLM. |
| Deterministic local gateway | Existing local `openai-completions` provider | `fixbot` | `fixbot` | test key only | Local validation only; unreachable from production and always non-evidence when output is synthetic. |

All model IDs are configurable. Code must not hard-code provider model names.

## Superseded production fallback passages

The accepted SPEC-05 decision makes these earlier locations historical and non-normative:

- `SUPERSEDED by SPEC-05: fallback chain and deterministic-fallback success passages` — the former architecture diagram, routing example, failure-posture success branch, and provider-matrix “degraded fallback” note in this document. The current canonical rule above replaces all of them.
- `SUPERSEDED by SPEC-05: production local_gateway provider declaration` — the former `local_gateway` declaration has been removed from `policy/routing.prod.json`; OPA also denies any production local-gateway decision.
- `SUPERSEDED by SPEC-05: production deterministic-fallback success branch` — the branch in `src/lib/productionGateway.ts` is not an authorized production success path and must be removed by the runtime-owning work unit; it cannot produce evidence.

## Testing and Gates

CI uses contract tests against a mock provider by extending the local gateway harness. The release gate remains deterministic.

Proposed gate:

- Name: `llm_contract` (final name to be confirmed in P1-T03).
- Scope: mock provider registration, routing config selection, redaction preflight, OPA allow/deny, audit/trace propagation, fallback behavior, and no raw content in audit records.
- Excluded from release gates: live Anthropic, OpenAI, or self-hosted provider smoke tests.

Live-provider smoke is an ops runbook action. It validates credentials, provider reachability, and basic latency without deciding release validity.

## G12 Measurement

Every production gateway call emits an OpenTelemetry span through the existing JSONL exporter pattern.

The only valid span name is `gateway.call`. `schemas/telemetry-event.schema.json` requires non-empty `audit_id` and `trace_id` on both the audit and span sides and exact equality of both values. Missing IDs, mismatches, and alternate span names are invalid evidence.

Required span attributes:

- `gateway.provider`
- `gateway.model_id`
- `gateway.routing_policy_version`
- `gateway.route_id`
- `gateway.fallback_index`
- `gateway.latency_ms`
- `gateway.input_tokens`
- `gateway.output_tokens`
- `gateway.estimated_cost`
- `gateway.data_classification`
- `gateway.task_kind`

Aggregation, dashboards, and budget alerts are deferred to Phase 5. P1-T03 only needs per-call evidence emission.

## Migration Plan

### P1-T03 minimal implementation scope

- Add one production provider adapter using an environment-provided API key.
- Add the redaction hook before external dispatch.
- Propagate audit ID and trace ID through gateway calls.
- Add routing config with two entries.
- Add `eap.routing` authorization with fail-closed behavior.
- Add mock-provider contract tests.
- Keep `validate-release` on the deterministic local gateway.

### Later phases

- Add Anthropic, OpenAI, and self-hosted providers as independent config entries.
- Add manual live-provider smoke runbook.
- Add richer cost estimation and Phase 5 aggregation.
- Add secret-manager integration under G3/P2-T05.
- Add tenant-owned routing policy review workflow.

## Traceability Proposals

These are proposed requirement IDs only. This task does not edit existing traceability files.

| Proposed ID | Requirement | Evidence target |
| --- | --- | --- |
| REQ-GATEWAY-001 | The system shall support a production LLM gateway as an additional provider behind the existing typed provider boundary. | P1-T03 implementation and `llm_contract` gate. |
| REQ-ROUTING-001 | Model routing shall be a deterministic policy function over tenant, data classification, task kind, cost budget, and latency target. | Routing config tests and `eap.routing` OPA tests. |
| REQ-REDACTION-002 | The gateway shall redact outbound prompts before any external provider call. | Mock provider capture tests. |
| REQ-AUDIT-002 | Every gateway call shall record audit ID, trace ID, provider, model ID, routing decision, token counts, latency, content digests, and estimated cost. | Audit JSONL assertions. |
| REQ-FAILCLOSED-002 | Routing policy, redaction, secret, or OPA failures shall prevent external provider calls. | Fail-closed contract tests. |
| REQ-MEASURE-001 | Gateway calls shall emit latency, token, and cost telemetry for G12 measurement. | OpenTelemetry JSONL assertions. |

## Open Questions

- No conflicts were found with the existing docs. `docs/DEPLOYMENT.md` says production model routing can replace `src/lib/localGateway.ts` behind typed boundaries; this design chooses coexistence for validation reproducibility and production routing.
- P1-T03 should confirm the final release gate name for `llm_contract`.
- P1-T03 should choose the first production provider adapter for implementation.
