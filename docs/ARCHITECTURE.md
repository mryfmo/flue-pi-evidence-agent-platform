# Architecture

## Overview

```text
Flue workflow
  -> deterministic local OpenAI-compatible gateway
  -> production gateway boundary when external providers are enabled
  -> routing policy + OPA eap.routing authorization
  -> Flue/Pi remediator agent profile
  -> code localization and hypothesis ledger
  -> OPA/Rego policy gate
  -> SandboxExecutor boundary (local | opensandbox)
  -> patch candidate fan-out
  -> selected patch application
  -> pytest verification
  -> rescan and closure gate
  -> SQLGlot + DuckDB + Presidio data guard
  -> OpenTelemetry JSONL trace
  -> optional OTLP export
  -> JSONL audit trail
```

## Core principle

The agent is not allowed to execute arbitrary side effects. The Flue/Pi path summarizes verified evidence. Side effects are performed by typed workflow tools after policy and verification gates.

## Components

- `src/app.ts`: Flue application entrypoint and OpenTelemetry observer registration.
- `src/agents/remediator.ts`: Flue/Pi agent profile with a bounded explanatory tool.
- `src/workflows/remediate.ts`: orchestration of localization, policy, patch fan-out, verification, data guard, closure, audit, and evidence summary.
- `src/workflows/smoke.ts`: minimal Flue runtime smoke workflow.
- `src/lib/code.ts`: workspace copy, fault localization, patch generation, patch application, pytest verification, and rescan.
- `src/lib/ledger.ts`: durable JSON ledger model, evidence graph, patch records, impact graph, and closure gate.
- `src/lib/opa.ts`: real OPA binary adapter with fail-closed behavior.
- `src/lib/productionGateway.ts`: production LLM gateway behind the typed Pi provider boundary; see `docs/PRODUCTION_GATEWAY_DESIGN.md`.
- `src/lib/router.ts`: deterministic tenant/classification/task/cost/latency routing policy.
- `src/lib/sandbox*.ts`: SandboxExecutor boundary for local and OpenSandbox workspace execution; see `docs/SANDBOX_INTEGRATION_DESIGN.md`.
- `policy/agent.rego`: allow, deny, approval, tenant, and tool policy rules.
- `policy/routing.rego`, `policy/sandbox.rego`, and policy data documents: `eap.routing`, `eap.sandbox`, and tenant/routing/sandbox facts.
- `scripts/data_guard.py`: SQLGlot/DuckDB/Presidio governed data path.
- `src/lib/dataProxy.ts`: TypeScript bridge to the Python data guard.
- `src/lib/localGateway.ts`: deterministic OpenAI-compatible gateway for repeatable Flue/Pi execution.
- `src/lib/telemetry.ts`: OpenTelemetry span export to JSONL evidence.
- `src/lib/audit.ts`: append-only audit events.
- `.orchestration/skills/`: skill registry, promoted remediator skill, Hermes-subset policy, and optimization-loop evidence.

## Data stores and artifacts

- Ledger: `artifacts/demo/hypothesis-ledger.json`.
- Audit: `artifacts/audit/remediation.jsonl`.
- Trace: `artifacts/telemetry/traces.jsonl`.
- Validation logs: `artifacts/validation/`.
- Node dependency SBOM: `artifacts/sbom/npm-cyclonedx.json`.
- Python dependency SBOM: `artifacts/sbom/python-cyclonedx.json`.
- Policy bundle: `artifacts/policy/bundle.tar.gz`.
- Skill registry evidence: `.orchestration/skills/`.

## Failure posture

- OPA missing or failing: fail closed.
- Routing, redaction, secret, or production gateway policy failure: fail closed before any external provider call.
- OpenSandbox runtime failure: fail closed with no silent fallback to local execution.
- High-risk action: requires review, no auto execution.
- Verification failure: ledger remains open.
- Unsafe SQL: rejected before DuckDB execution.
- Missing evidence: closure denied.
