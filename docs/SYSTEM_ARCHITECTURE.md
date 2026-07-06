# System Architecture

## Runtime flow
1. Flue receives the `remediate` workflow payload.
2. The workflow starts the deterministic local OpenAI-compatible gateway for validation, or uses the production gateway boundary when external providers are enabled.
3. Production routing resolves tenant, data classification, task kind, cost budget, and latency target through `eap.routing` and routing/tenant data documents.
4. The workspace is copied into `artifacts/demo/workspace/<repo>-<run-id>` or prepared behind the SandboxExecutor boundary.
5. Code localization identifies hypotheses and records evidence.
6. OPA evaluates whether `apply_patch` is allowed.
7. Patch candidates are generated and selected candidates are applied through the local executor or OpenSandbox executor.
8. Pytest verifies the patched workspace.
9. The scanner rescans the workspace and the closure gate evaluates remaining hypotheses.
10. The data guard runs SQLGlot, DuckDB, and Presidio.
11. Flue/Pi agent session summarizes verified evidence only.
12. Audit JSONL, OpenTelemetry JSONL, optional OTLP telemetry, ledger JSON, and validation logs are written.

## Components
- `src/agents/remediator.ts`: Flue/Pi agent profile and bounded explanatory tool.
- `src/workflows/remediate.ts`: orchestration of localization, policy, patch, verify, data guard, and closure.
- `src/lib/code.ts`: code localization and verifier tools.
- `src/lib/ledger.ts`: hypothesis ledger and closure gate.
- `src/lib/opa.ts`: real OPA binary adapter.
- `src/lib/productionGateway.ts`: production LLM gateway using typed provider contracts and env-injected keys; see `docs/PRODUCTION_GATEWAY_DESIGN.md`.
- `src/lib/router.ts`: deterministic routing policy over tenant, classification, task, cost, and latency.
- `src/lib/sandbox*.ts`: SandboxExecutor implementations for `local` and `opensandbox`; see `docs/SANDBOX_INTEGRATION_DESIGN.md`.
- `src/lib/dataProxy.ts`: TypeScript bridge to the Python data guard.
- `scripts/data_guard.py`: SQLGlot/DuckDB/Presidio governed data path.
- `src/lib/telemetry.ts`: OpenTelemetry trace export.
- `policy/routing.rego` and `policy/sandbox.rego`: `eap.routing` and `eap.sandbox` authorization.
- `policy/data/*.json`: routing, sandbox, and tenant data documents.
- `.orchestration/skills/`: skill registry, promoted remediator skill, and optimization-loop evidence.
