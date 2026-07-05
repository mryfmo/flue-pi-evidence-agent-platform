# System Architecture

## Runtime flow
1. Flue receives the `remediate` workflow payload.
2. The workflow starts a deterministic local OpenAI-compatible gateway and registers it as a provider.
3. The workspace is copied into `artifacts/demo/workspace/<repo>-<run-id>`.
4. Code localization identifies hypotheses and records evidence.
5. OPA evaluates whether `apply_patch` is allowed.
6. Patch candidates are generated and selected candidates are applied.
7. Pytest verifies the patched workspace.
8. The scanner rescans the workspace and the closure gate evaluates remaining hypotheses.
9. The data guard runs SQLGlot, DuckDB, and Presidio.
10. Flue/Pi agent session summarizes verified evidence only.
11. Audit JSONL, OpenTelemetry JSONL, ledger JSON, and validation logs are written.

## Components
- `src/agents/remediator.ts`: Flue/Pi agent profile and bounded explanatory tool.
- `src/workflows/remediate.ts`: orchestration of localization, policy, patch, verify, data guard, and closure.
- `src/lib/code.ts`: code localization and verifier tools.
- `src/lib/ledger.ts`: hypothesis ledger and closure gate.
- `src/lib/opa.ts`: real OPA binary adapter.
- `src/lib/dataProxy.ts`: TypeScript bridge to the Python data guard.
- `scripts/data_guard.py`: SQLGlot/DuckDB/Presidio governed data path.
- `src/lib/telemetry.ts`: OpenTelemetry trace export.
