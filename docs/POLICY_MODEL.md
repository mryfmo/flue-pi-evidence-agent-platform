# Policy Model

OPA is the authority for side-effect permission.

Inputs:
- verified identity context and bound request context for `data.eap.agent`
- tool
- risk
- resource
- routing decision and catalog data for `data.eap.routing`

Data:
- `policy/tenants.json` is loaded into OPA as `data.eap.tenants.allowed`.
- Agent, routing, and sandbox policies allow only tenants present in that list.
- Missing or empty tenant data does not satisfy the allow rules, so tenant authorization fails closed.

Bundle:
- `scripts/opa-bundle.mjs` builds `artifacts/policy/bundle.tar.gz` from `policy/` with the git short SHA as the OPA bundle revision.
- Bundle serving and distribution are deployment concerns outside the local policy model.

Outputs:
- allow
- requires_approval
- deny_reason

Fail-closed behavior is implemented in `src/lib/opa.ts`. If the OPA binary is missing or policy evaluation fails, the decision is `allow=false` and `requires_approval=true`.

## Production policy entry-point inventory

| Package | Caller-facing entry points | Boundary |
| --- | --- | --- |
| `data.eap.agent` | `allow`, `requires_approval`, `deny_reason` | Verified tool authorization. |
| `data.eap.routing` | `allow`, `deny_reason` | Tenant-bound model route and execution authorization. |
| `data.eap.sandbox` | `allow`, `requires_approval`, `deny_reason` | Default-deny sandbox and coherent-row egress authorization. |
| `data.eap.approval` | `allow_approve`, `allow_reject`, `allow_expire`, `allow_resume`, `idempotent_replay`, `idempotency_conflict`, `deny_reason` | Persisted approval lifecycle authorization. |
| `data.eap.closure` | `remediation_success`, `closed` | Schema-bound remediation closure. |
| `data.eap.cc_guard` | `allow`, `deny_reason` | Orchestrator command/path boundary for controlled paths, leases, and release-branch commands. It does not authenticate identities, establish tenant membership, or supply tenant authorization semantics. |

The canonical governed terms and controlled-resource catalog are defined only in `docs/INTEGRATION_BOUNDARY.md` under “Canonical glossary (normative)” and “Canonical controlled-resource catalog (normative).”

Sandbox policy consumes gateway/PEP-owned identity and bound request contexts. Its egress catalog is a collection of closed, typed rows; each row must contain exactly tenant, destination, HTTPS protocol, numeric port, action, enabled, boolean approval requirement, and a non-empty unique known-role array. Missing, malformed, unknown, extra-field, duplicate, or ambiguous rows deny before `requires_approval` or `allow` can authorize egress.

Approval-required rows consume the canonical A0-06 `schemas/approval-state.schema.json` record and `policy/approval.rego` integrity predicate; no sandbox-specific weaker approval record exists. The canonical record must be persisted, immutable, integrity-verified, schema-valid, approved by an authorized verified same-tenant approver, chronologically valid, unexpired, and `not_resumed`. A separate closed `egress_authorization_context` binds its approval ID and approved action to the complete selected catalog tuple and the same tenant, task, run, source, evidence, and request binding. Record-context booleans or caller-shaped tuple fields alone never authorize egress. Provenance strings do not make caller-controlled input authentic.

## Agent Identity Trust

Agent policy consumes only gateway/PEP-constructed `identity_context` and `request_context`. The identity context contains an immutable non-empty `subject_id`, authenticated principal type, tenant memberships, role claims, logical issuer `flue-pi-identity-authority`, audience `flue-pi-agent-policy`, verification status and owner, and a request-binding ID. The request context contains the tenant and the same binding ID. The authentication vendor and runtime mechanism remain outside this contract.

The gateway/PEP owns identity verification and must construct the OPA input after authentication, prevent callers from supplying or overwriting either context, and bind the two contexts to the same request. The issuer, audience, and verifier strings are validation metadata, not standalone proof that caller-controlled JSON is authentic. Request-body `user`, `tenant`, `role`, issuer, audience, or verification fields never authorize an agent request.

Authorization fails closed with deterministic reasons for missing or malformed contexts, anonymous principals, issuer/audience/verifier or verification-status mismatch, tenant membership or allowlist mismatch, missing/unknown/insufficient roles, request-binding mismatch, and body identity fields. `platform_engineer`, `software_engineer`, `data_analyst`, and `security_reviewer` are the closed role vocabulary; `policy/agent.rego` maps each role to its permitted tools. Existing tool restrictions remain in force, and high-risk requests still require approval.

## Routing Classification Trust

Routing policy consumes gateway/PEP-constructed OPA input, not the original caller request body. This input-origin isolation is a precondition: callers must not be able to invoke OPA directly or control `input.decision.classification`. The only classification field used for authorization is `input.decision.classification.value`, with closed values `public`, `internal`, `confidential`, and `restricted`.

The classification producer is `flue-pi-data-guard`. `input.decision.classification.trust_proof` records the following provenance metadata:

- `producer=flue-pi-data-guard`
- `verified_by=flue-pi-platform-gateway`
- `evidence_kind=presidio-sqlglot-redaction-v1`

`ProductionGatewayRequest` has no classification, proof, routing-policy-path, or approval field. The guard classifies the complete raw message array before redaction and the gateway privately uses the verified result for route selection. The internal scalar `data_classification` and `input.decision.classification.value` are derived from that same result; callers cannot supply either. The catalog's `classification` object uses the same `producer`, `verified_by`, and `evidence_kind` fields plus the closed `enum`. Missing catalog or decision classification, malformed or unknown values, and missing or mismatched evidence deny under `REQ-FAILCLOSED-002`.

These three constant strings are not a cryptographic signature and do not establish authenticity by themselves. The gateway/PEP integration must construct the OPA document after classification, prevent callers from supplying or overwriting authorization fields, and keep direct OPA access outside the caller trust boundary.

The gateway loads only the deployment-selected fixed flat catalog (`policy/routing.json` or `policy/routing.prod.json`). A caller cannot select a catalog or submit `approval_ref`; therefore confidential external routes remain denied with `confidential_requires_approval` until B2-01 integrates source-bound approval. Restricted external routes always deny. Automatic `public` and post-redaction downgrade are prohibited.

`route_id=default` has no authorization meaning. A route is authorized only when its `route_id`, `provider`, `model_id`, and trusted classification match an explicit route in the supplied routing catalog.
