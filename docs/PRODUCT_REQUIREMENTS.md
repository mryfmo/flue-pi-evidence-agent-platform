# Product Requirements

## Purpose
The platform is an evidence-driven remediation system for controlled code repair and governed customer-data analysis. It must not present an agent transcript as proof of completion. It must complete only when evidence, policy, verification, data guard, and audit gates all pass.

## Users
- Platform engineer: operates release gates and reviews audit outputs.
- Software engineer: submits a code issue for evidence-driven remediation.
- Data analyst: requests aggregate-only governed metrics.
- Security reviewer: reviews OPA decisions, traces, and failure cases.

## Non-negotiable outcomes
- PR-001: Remediation execution provides a governed agent capability whose observable behavior is validated end to end.
- PR-002: Every remediation run creates a hypothesis ledger and evidence graph.
- PR-003: No patch is applied until OPA authorizes the tool request.
- PR-004: A run does not close while unresolved hypotheses remain.
- PR-005: Data analysis enforces aggregate-only queries, rejects unsafe SQL and raw PII, and fails closed when validation or anonymization cannot be verified.
- PR-006: Unsafe SQL, raw PII projection, mutation SQL, and multi-statement SQL are rejected.
- PR-007: OpenTelemetry spans and JSONL audit records are emitted.
- PR-008: Release creation is blocked unless all quality gates pass.

## Normalized authorization specifications

- SPEC-04: Agent authorization shall consume only gateway/PEP-owned verified identity and request contexts, deny missing or mismatched identity, tenant, role, verification, and request-binding claims, reject body identity fields, and preserve tool and high-risk approval controls.
- SPEC-05: The canonical production rule is production_fallback_prohibited. Exhausted provider chains return ok:false with reason=llm_unavailable and workflow outcome typed_failure_no_summary; production cannot reach the local gateway, and synthetic output is local-validation-only explicitly marked non-evidence.
- SPEC-06: Remediation success shall be decided by one issue-scoped schema-bound data.eap.closure.remediation_success predicate, with closed as its alias.
- SPEC-07: Every required regression and impact result shall have a unique ID, belong to the issue, be present, and pass; contradictory duplicates fail closed.
- SPEC-09: Every uniquely identified hypothesis shall have its own passing evidence, and each patchable hypothesis shall have at least two distinct candidate IDs without cross-hypothesis counting.
- SPEC-12: Acceptance tiers shall be derived from one closed schema-bound risk-input contract; only the exact low-risk predicate may auto-accept and every missing, unknown, malformed, or contradictory input shall fail closed to review.
- SPEC-15: The versioned HTTP contract shall define every supported operation, request and response schema, success and negative status, a closed error envelope, and only resolvable references; the remediation runtime boundary shall enforce the closed version-1 request, raw-byte and Unicode limits, strict media type and UTF-8, and gateway-owned verified identity before side effects.
- SPEC-16: A pending approval shall be persisted before needs_review and bind tenant, task/run, source, evidence, action, immutable identities, expiry, decision, and exactly-once idempotent resume state; every authorization, replay, and conflict path shall revalidate the complete stored identity and chronology tuple.
- SPEC-20: REQ-PI-001 and REQ-DATA-001 shall remain capability-level requirements whose conformance is established only by the exact canonical-manifest content identifier of all current capability implementations, tests, configs/helpers, package and Python manifests/locks, dependency declarations, and environment-bootstrap inputs, backed by re-hashable machine artifacts, cryptographically verified against active non-caller OPA trust data containing the exact six-row artifact catalog, evaluated against OPA runtime time, bound per row to immutable artifact and signed execution-attestation tuples, and bound as one exact six-attestation bundle to the trusted current run/source; Git-HEAD-only, omitted-source, absent, malformed, inactive, expired, test-only, wrong-environment, unknown-key, source/run-rotated, catalog-missing/extra/duplicated/substituted, invalid-signature, payload/body-disagreeing, replayed, arbitrary-bundle, mixed-abstraction, tool-identity, caller-supplied, cross-run, stale, contradictory, synthetic, self-attested, unverified, or unbound evidence shall fail closed. Binding unpinned declarations and an unresolved lock does not establish hermetic dependency resolution.

The remaining accepted specifications retain their existing canonical catalog text:

- SPEC-01: Before redaction, `flue-pi-data-guard` shall classify the complete raw outbound message array; a known secret/credential match is `restricted`, otherwise any Presidio finding is `confidential`, otherwise the result is `internal`. The maximum sensitivity across all messages applies, redaction never downgrades it, and automatic `public` is prohibited. Routing authorization shall consume only the closed, SHA-256-bound guard result verified by the gateway/PEP; provenance strings do not independently prove authenticity.
- SPEC-02: Routing authorization shall deny missing, malformed, unknown, or untrusted classification values under REQ-FAILCLOSED-002.
- SPEC-03: Routing authorization shall validate route id, provider, model, and classification against the explicit routing catalog; route_id=default has no magic authorization meaning.
- SPEC-08: Production routing shall use one flat schema-validated policy document consumed directly by routing authorization; wrapped or malformed policy documents shall not authorize.
- SPEC-10: Production gateway SLI evidence shall use only gateway.call spans correlated to audit records by exact equality of emitted audit_id and trace_id fields.
- SPEC-11: Governed workflow run outcomes shall use the closed passed, needs_review, or failed enum, and missing, unknown, or malformed values shall be rejected.
- SPEC-13: Audit sink, telemetry emission, sandbox lifecycle, and sandbox evidence failures shall produce explicit typed failed outcomes and shall never be represented as success.
- SPEC-14: Every persistent ledger, audit, and evidence artifact shall satisfy the closed tenant-bound artifact schema, use a tenant-scoped path, and bind lifecycle, PII, retention, deletion, legal-hold, DSAR, access-isolation, source, and integrity metadata; retention target values remain user-owned by F1-05.
- SPEC-17: Sandbox egress shall default deny and authorize only a gateway-bound verified same-tenant request matching one complete enabled catalog row, with any required unexpired persisted approval bound to the same tenant, task, run, source, evidence, action, request, and destination tuple.
- SPEC-18: The production policy inventory shall list every caller-facing entry point, including cc_guard as the orchestrator command/path boundary without claiming tenant authorization semantics.
- SPEC-19: Governed terms and controlled resources shall have exactly one normative glossary and one canonical controlled-resource catalog, referenced rather than reproduced by other documents.

A0-01-R3 closes only runtime classification production and PEP consumption. Production exposure remains blocked until B2-01 supplies verified invocation context, source-bound single-use approval, and a gateway-owned tenant audit sink, and B2-02 establishes the production redaction corpus/recognizer contract. The bounded known-secret patterns complement Presidio and are not exhaustive secret detection.

## SPEC-20 normative capability requirements

- REQ-PI-001: Remediation execution shall provide externally observable governed-agent behavior, reject unauthorized or invalid execution, and fail closed when the execution capability or its evidence cannot be verified.
- REQ-DATA-001: Governed data analysis shall provide aggregate-only results without raw PII, reject unsafe or unauthorized requests, and fail closed when query safety, isolation, or anonymization outcomes cannot be verified.

Conformance evidence is limited to the named behavior, negative-behavior, and fail-closed capability tests in `spec20-conformance-v1`. File existence, marker strings, installed packages, self-attestation, and tool-name detection are not conformance evidence.

The default `data.eap.conformance.satisfied` predicate is production-only and requires an active, non-caller-controlled `data.eap.conformance_trust` deployment document. That OPA data supplies the production environment, producer/verifier/audience, active public key and algorithm, key validity, expected current source/run freshness anchor, and an exact six-row requirement/test artifact path-and-digest catalog. Production artifact locations can change through deployment trust data without editing Rego. Missing, malformed, inactive, expired, test-only, wrong-environment, unknown-key, source/run-mismatched, or incomplete/duplicated/substituted catalog data fails closed. Authorization uses OPA runtime `time.now_ns()`; neither caller input nor frozen trust data supplies the current clock. The signed payload binds one run, requirement, test, outcome, source revision/digest, immutable artifact path/content/subject digest, producer, verifier, verification status, and non-synthetic/non-self-attested disposition on the same row. The bundle digest binds the trusted shared run/source identity to the canonically sorted exact six verified-attestation digests. Issuer, audience, status, owner, origin, and `caller_supplied` values remain defense-in-depth metadata; strings and booleans never authenticate caller JSON without successful signature, bundle, artifact, runtime-freshness, and external trust-anchor verification.

A separate `data.eap.conformance.satisfied_test_vector` predicate accepts only an explicitly loaded, active `test_only` trust document. Its static signatures identify `test-vector:local-machine`, not CI or KMS, and can never satisfy the production predicate. The six test-vector artifacts are actual machine-produced validation records under `.orchestration/validation/A0-08.artifacts/`; validation re-reads and SHA-256 hashes their exact bytes. A0-08 defines and proves this fail-closed contract only. Operational production signing-key custody, issuance, rotation, and live trust-data deployment remain governed by the plan's dedicated signing/key-custody decision and implementation; this work does not fabricate those facilities.

The canonical sorted `spec20-capability-source-manifest-v1` enumerates every repository-controlled input used by the six capability executions: PI/data implementations and tests, tenant policy data, OPA adapter and its local type helper, npm and Python declarations and locks, the Python environment bootstrap script, project test/type configs, and the SPEC-20 documents, conformance policy, and checker. This includes `requirements.txt` and `scripts/setup-python.mjs`, which declare and construct the Python environment used by the data capability. `source_digest` is SHA-256 over each manifest entry's `path + NUL + exact file bytes + NUL`; the 64-hex `source_revision` is the same content-derived identifier, not Git HEAD. Thus dirty or untracked capability bytes change both identifiers. The checker validates exact manifest membership and uses actual OPA evaluation to deny the old signed bundle after independent byte mutations of implementations, tests, lock/config inputs, the Python dependency declaration, and its bootstrap script. The manifest control file itself, signed fixture, test trust, embedded conformance test vectors, signatures, and machine artifacts are generated validation material and remain outside the content bundle to avoid a self-signing cycle.

This source binding is not a claim of hermetic Python dependency resolution. `requirements.txt` currently contains unpinned requirements and ranges, and `uv.lock` contains no resolved dependency package entries. A0-08 binds the current repository declarations and bootstrap path, while exact dependency versions, interpreter/environment provenance, and reproducible resolution remain a production-hardening obligation for an authorized later work unit.

## Non-normative current design inventory

The current implementation uses the Flue/Pi execution path and SQLGlot, DuckDB, and Presidio data controls. These names describe the present design only; changing them does not change the normative capability predicate. The historical deterministic-local-gateway mechanism for REQ-PI-001 and SQLGlot/DuckDB/Presidio identities for REQ-DATA-001 in `docs/SPECIFICATION.md` are superseded as normative clauses and remain non-normative historical inventory.

## Out of scope for this package
This package is a single-host OSS-integrated implementation by default. Docker-based validation and GitHub Actions CI are in scope, and the production LLM gateway exists behind typed contracts with environment-injected provider keys. It does not claim Kubernetes, external OpenMetadata, external Trino, or production secret-manager deployment; those remain extension targets behind the same typed tool contracts.

## Non-normative Reference Implementation (Phase 8)

The Phase 8 reference implementation uses Claude Code as the interactive
orchestrator and acceptance UI. The platform boundary remains
orchestrator-independent: governed decisions are still made by deterministic
scripts, policy, audit, validation, and gateway checks, not by Claude Code prose.

The production LLM path that satisfies the production gateway requirement is
the composite path:

```text
Platform Gateway
  redaction, data classification, fail-closed policy, audit metadata
  -> LiteLLM Proxy
       approved alias resolution, fallback, provider cost metadata
       -> Anthropic approved models
```

The approved aliases are implemented in `config/litellm/config.yaml`:
`worker-fast`, `worker-main`, and `worker-heavy`. Production routing uses
`policy/routing.prod.json`, where governed routes target the `litellm`
provider and environment-injected `LITELLM_BASE_URL` /
`LITELLM_VIRTUAL_KEY` credentials.

Phase 8 closes the previous open implementation questions as follows:

- Production LLM selection is decided as Anthropic models behind LiteLLM Proxy
  approved aliases.
- The tool allow-list boundary includes Claude Code hooks registered in
  `.claude/settings.json` and enforced by `policy/cc_guard.rego`; the policy is
  part of the governed `policy/` control zone.
- Orchestrator actions use `scripts/orchestrator/delegate.mjs`,
  `status.mjs`, `accept.mjs`, `platform-health.mjs`, and
  `scripts/audit-trace.mjs`; free-form chat is not an acceptance ledger.

Related documents:

- `docs/INTEGRATION_BOUNDARY.md`
- `docs/LITELLM_PROXY.md`
- `docs/ORCHESTRATOR_INTERFACE.md`
- `docs/PRODUCTION_GATEWAY_DESIGN.md`
