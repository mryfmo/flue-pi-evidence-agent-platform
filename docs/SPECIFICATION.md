# Specification

## REQ-FLUE-001
The system shall use Flue as the agent harness runtime and shall build a Node target through the Flue CLI.

## REQ-PI-001
The system shall exercise the Flue/Pi model provider path through a deterministic local OpenAI-compatible gateway. The path is used for verified-evidence summarization, not for unrestricted side-effect execution.

## REQ-OPA-001
Patch operations shall be authorized by real OPA/Rego before execution. OPA unavailability shall fail closed.

## REQ-EVIDENCE-001
Defects shall be represented as hypotheses. A run may close only when every localized hypothesis is verified, required evidence kinds are present, verification passes, and rescanning finds no remaining issue evidence.

## REQ-PATCH-001
The system shall generate more than one patch candidate per localized hypothesis and record both selected and unselected alternatives in the ledger.

## REQ-DATA-001
Customer-data style analysis shall use SQLGlot validation, DuckDB aggregate execution, and Presidio redaction. Raw PII projection, mutation SQL, and multi-statement SQL shall be rejected.

## REQ-OBS-001
The system shall emit OpenTelemetry spans and JSONL audit records during the E2E workflow. The release gate shall assert that required spans and audit events exist.

## REQ-VALIDATION-001
The release shall include executable gates for documentation traceability, format, lint, typecheck, OPA, Python compile/lint/type/security/tests, Vitest unit/component/system/E2E/failure/security/regression tests, Flue build, E2E artifact assertion, production npm audit, and CycloneDX SBOM generation.

## REQ-RELEASE-001
No artifact may be labeled releasable unless `npm run validate-release` passes and writes a passing `artifacts/validation/final_verification_report.json`.

## REQ-GATEWAY-001
The system shall support a production LLM gateway as an additional provider behind the existing typed provider boundary.

## REQ-ROUTING-001
Model routing shall be a deterministic policy function over tenant, data classification, task kind, cost budget, and latency target.

## REQ-REDACTION-002
The gateway shall redact outbound prompts before any external provider call.

## REQ-AUDIT-002
Every gateway call shall record audit ID, trace ID, provider, model ID, routing decision, token counts, latency, content digests, and estimated cost.

## REQ-FAILCLOSED-002
Routing policy, redaction, secret, or OPA failures shall prevent external provider calls.

## REQ-MEASURE-001
Gateway calls shall emit latency, token, and cost telemetry for G12 measurement.
