# Production Gateway Design

## Purpose

This document defines the production LLM gateway and model-routing design for the Flue/Pi evidence agent platform.

The current deterministic local OpenAI-compatible gateway remains the validation provider. It is used by `validate-release` so release gates stay reproducible and free of external LLM nondeterminism. The production gateway is an additional Pi provider registration behind the same `openai-completions` contract.

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

Fallback:
  primary provider
    -> secondary provider
    -> deterministic local gateway
       audit marker: deterministic-fallback
```

The agent loop remains gated. The LLM path summarizes verified evidence only. Tool execution stays in typed workflow tools controlled by OPA, verifiers, the data guard, and closure gates.

## Typed Contracts

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
| `data_classification` | data guard / workflow classification | Example: `public`, `internal`, `restricted`. |
| `cost_budget` | tenant or run config | Upper bound used by deterministic routing policy. |
| `latency_target` | tenant or run config | Target class, not a runtime learned signal. |
| `messages` | Flue/Pi request | Redacted before external provider call. |
| `audit_id` | workflow audit context | Propagated to audit and telemetry. |
| `trace_id` | OpenTelemetry active span | Propagated to audit and provider metadata where supported. |

Response contract:

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

## Routing Policy

Routing is a pure function:

```text
{tenant, data_classification, task_kind, cost_budget, latency_target}
  -> {provider, model_id, fallback_chain}
```

The policy lives in versioned JSON or YAML. OPA authorizes use of the selected route through a new Rego package, `eap.routing`, using the same fail-closed adapter posture as `src/lib/opa.ts`.

Example schema:

```json
{
  "version": "2026-07-05.p1",
  "defaults": {
    "fallback_chain": [
      {
        "provider": "openai",
        "model_id": "gpt-5.5"
      },
      {
        "provider": "local",
        "model_id": "fixbot",
        "mode": "deterministic-fallback"
      }
    ]
  },
  "routes": [
    {
      "id": "acme-internal-summary-fast",
      "match": {
        "tenant": "acme",
        "data_classification": "internal",
        "task_kind": "verified_evidence_summary",
        "cost_budget": "standard",
        "latency_target": "interactive"
      },
      "provider": "anthropic",
      "model_id": "claude-sonnet-5",
      "fallback_chain": [
        {
          "provider": "openai",
          "model_id": "gpt-5.5"
        },
        {
          "provider": "local",
          "model_id": "fixbot",
          "mode": "deterministic-fallback"
        }
      ]
    },
    {
      "id": "acme-public-summary-low-cost",
      "match": {
        "tenant": "acme",
        "data_classification": "public",
        "task_kind": "verified_evidence_summary",
        "cost_budget": "low",
        "latency_target": "batch"
      },
      "provider": "anthropic",
      "model_id": "claude-haiku-4-5-20251001",
      "fallback_chain": [
        {
          "provider": "vllm",
          "model_id": "tenant-summary-small"
        },
        {
          "provider": "local",
          "model_id": "fixbot",
          "mode": "deterministic-fallback"
        }
      ]
    }
  ],
  "providers": {
    "anthropic": {
      "type": "anthropic_api",
      "api_key_env": "ANTHROPIC_API_KEY"
    },
    "openai": {
      "type": "openai_api",
      "api_key_env": "OPENAI_API_KEY"
    },
    "vllm": {
      "type": "openai_compatible",
      "base_url_env": "VLLM_BASE_URL",
      "api_key_env": "VLLM_API_KEY"
    },
    "local": {
      "type": "local_gateway"
    }
  }
}
```

Learned routers are a recorded non-goal. Revisit only if a future requirement proves static policy cannot express tenant, classification, cost, and latency constraints.

## Security Invariants

| # | Invariant | Enforcement point | Evidence / test idea |
| --- | --- | --- | --- |
| 1 | Outbound prompt redaction runs before any external call. | Production gateway request path before provider dispatch; reuse offline deterministic Presidio/data_guard recognizer patterns. | Mock provider contract test asserts sensitive input is absent from captured outbound request and redaction failure prevents dispatch. |
| 2 | Audit ID and OpenTelemetry trace ID are propagated on every call. | Gateway call context; audit append through `src/lib/audit.ts`; span through `src/lib/telemetry.ts`. | Contract test asserts audit JSONL has `audit_id`, `trace_id`, provider, model_id, routing decision, token counts, latency, and content digests. |
| 3 | Request and response content are recorded as hashes, not raw content. | Audit event builder after redaction and after response normalization. | Unit test asserts audit records contain request/response digest fields and do not contain raw prompt or raw completion text. |
| 4 | Fail closed on routing policy unavailable, redaction unavailable, or OPA deny. | Gateway preflight: load routing config, run redaction, call `eap.routing`; any failure returns no external call. | Mock provider receives zero calls when config load, redaction, or OPA authorization fails. |
| 5 | API keys are environment-injected only. | Provider adapter construction reads named environment variables; config stores env var names, not secret values. | Static test scans routing config and audit logs for key material; runtime test asserts missing key fails closed before dispatch. |
| 6 | LLM output is summarization-only and cannot authorize side effects. | Agent/workflow boundary: typed tools and OPA remain the only side-effect authority. | Regression test confirms a model response cannot trigger patching without workflow policy and verifier gates. |

API keys are never logged, never sent in agmsg messages, and never written to audit records.

## Failure Posture

- Routing config missing, malformed, or policy version unauthorized: fail closed, no external call.
- `eap.routing` unavailable or OPA deny: fail closed, no external call.
- Redaction unavailable or redaction check fails: fail closed, no external call.
- Provider API key missing: fail closed, no external call.
- Primary provider timeout or provider error: try the configured fallback chain.
- Fallback reaches deterministic local gateway: return deterministic summary and record `deterministic-fallback` in audit and telemetry.
- All fallbacks fail: return a typed gateway failure to the workflow; do not fabricate a summary.

## Provider Matrix

| Provider | Contract | Default model_id | Low-cost model_id | Key source | Notes |
| --- | --- | --- | --- | --- | --- |
| Anthropic API | Anthropic adapter normalized to `openai-completions` | `claude-sonnet-5` | `claude-haiku-4-5-20251001` | `ANTHROPIC_API_KEY` | Default production route candidate. |
| OpenAI API | OpenAI-compatible completions | `gpt-5.5` | Config-selected | `OPENAI_API_KEY` | Secondary provider candidate. |
| Self-hosted OpenAI-compatible endpoint | OpenAI-compatible completions | Config-selected | Config-selected | endpoint-specific env vars | Example: vLLM. |
| Deterministic local gateway | Existing local `openai-completions` provider | `fixbot` | `fixbot` | test key only | Validation provider and degraded fallback only. |

All model IDs are configurable. Code must not hard-code provider model names.

## Testing and Gates

CI uses contract tests against a mock provider by extending the local gateway harness. The release gate remains deterministic.

Proposed gate:

- Name: `llm_contract` (final name to be confirmed in P1-T03).
- Scope: mock provider registration, routing config selection, redaction preflight, OPA allow/deny, audit/trace propagation, fallback behavior, and no raw content in audit records.
- Excluded from release gates: live Anthropic, OpenAI, or self-hosted provider smoke tests.

Live-provider smoke is an ops runbook action. It validates credentials, provider reachability, and basic latency without deciding release validity.

## G12 Measurement

Every production gateway call emits an OpenTelemetry span through the existing JSONL exporter pattern.

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
