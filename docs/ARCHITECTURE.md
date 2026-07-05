# Architecture

## Overview

```text
Flue workflow
  -> deterministic local OpenAI-compatible gateway
  -> Flue/Pi remediator agent profile
  -> code localization and hypothesis ledger
  -> OPA/Rego policy gate
  -> patch candidate fan-out
  -> selected patch application
  -> pytest verification
  -> rescan and closure gate
  -> SQLGlot + DuckDB + Presidio data guard
  -> OpenTelemetry JSONL trace
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
- `policy/agent.rego`: allow, deny, approval, tenant, and tool policy rules.
- `scripts/data_guard.py`: SQLGlot/DuckDB/Presidio governed data path.
- `src/lib/dataProxy.ts`: TypeScript bridge to the Python data guard.
- `src/lib/localGateway.ts`: deterministic OpenAI-compatible gateway for repeatable Flue/Pi execution.
- `src/lib/telemetry.ts`: OpenTelemetry span export to JSONL evidence.
- `src/lib/audit.ts`: append-only audit events.

## Data stores and artifacts

- Ledger: `artifacts/demo/hypothesis-ledger.json`.
- Audit: `artifacts/audit/remediation.jsonl`.
- Trace: `artifacts/telemetry/traces.jsonl`.
- Validation logs: `artifacts/validation/`.
- Node dependency SBOM: `artifacts/sbom/npm-cyclonedx.json`.

## Failure posture

- OPA missing or failing: fail closed.
- High-risk action: requires review, no auto execution.
- Verification failure: ledger remains open.
- Unsafe SQL: rejected before DuckDB execution.
- Missing evidence: closure denied.
