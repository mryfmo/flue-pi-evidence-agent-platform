# Specification

## REQ-FLUE-001
The system shall use Flue as the agent harness runtime and shall build a Node target through the Flue CLI.

## REQ-PI-001 (non-normative historical inventory)
The system shall exercise the Flue/Pi model provider path through a deterministic local OpenAI-compatible gateway. The path is used for verified-evidence summarization, not for unrestricted side-effect execution.

## REQ-OPA-001
Patch operations shall be authorized by real OPA/Rego before execution. OPA unavailability shall fail closed.

## REQ-EVIDENCE-001
Defects shall be represented as hypotheses. Remediation closure is governed exclusively by the `remediation-closure-v1` contract in `schemas/remediation-closure.schema.json` and `data.eap.closure.remediation_success`; `data.eap.closure.closed` is an alias of that predicate. The combined schema and canonical policy-source contract digest is `sha256:b54388e5bf8f17ef14ca4a5facf4103c48502ae52be35f70142a9d2cf9391b00`.

## REQ-PATCH-001
The system shall generate more than one distinct patch candidate per localized patchable hypothesis and record both selected and unselected alternatives in the ledger. Candidate sufficiency for closure is evaluated by the canonical predicate referenced by REQ-EVIDENCE-001, never by aggregate candidate count.

## REQ-DATA-001 (non-normative historical inventory)
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

## REQ-SANDBOX-001
The product shall support OpenSandbox as the required execution-isolation layer for remediation workspace operations.

## REQ-SANDBOX-002
OpenSandbox runtime failures shall fail closed with no silent fallback to local execution.

## REQ-SANDBOX-003
Sandboxes shall isolate credentials and deny network egress by default.

## REQ-SANDBOX-004
Sandbox lifecycle operations shall emit audit evidence.

## REQ-HTTP-REQUEST-001
`POST /v1/remediations` is the runtime remediation trust boundary. It accepts only a valid, unambiguous `Content-Type` with `application/json` media-type essence; comma-joined values and case-insensitively duplicate parameter names are rejected. The raw body is capped at 65,536 bytes. It decodes strict UTF-8 and accepts exactly one closed JSON object conforming to `schemas/remediation-request.schema.json`: integer `version` equal to `1`, required `workspace` of 1..4,096 Unicode code points, and optional `issue` of 0..8,192 Unicode code points. Unknown fields, lone surrogates, coercion, defaults, and caller identity or provenance fields are rejected before workflow or other side effects.

Identity is read only from the gateway/PEP-owned A0-02 trusted request context. Authentication failures use `401`; complete but unauthorized tenant, binding, or remediation-role tuples use `403`. The private Flue workflow app is not mounted on the public app; every unknown public path, including raw workflow path variants under any encoding, uses the canonical `404 not_found` envelope. The stable error mapping is `400 invalid_request`, `401 authentication_required`, `403 authorization_denied`, `404 not_found`, `413 payload_too_large`, `415 unsupported_media_type`, and `500 internal_error`. Every failure is the closed JSON envelope `{version: 1, error: {code, message, request_id}}`; it contains no request body, sensitive identity, stack, or internal path.
