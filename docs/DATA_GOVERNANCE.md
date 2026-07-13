# Data Governance

## Normative capability contract

REQ-DATA-001 requires aggregate-only governed results without raw PII, rejection of unsafe or unauthorized requests, and fail-closed outcomes when query safety, isolation, or anonymization cannot be verified. Conformance is established only by the source-bound `data_behavior`, `data_negative`, and `data_fail_closed` machine capability tests accepted by SPEC-20.

SPEC-20 capability-test artifacts are immutable, re-hashable machine-produced outputs. The production predicate verifies their path/digest catalog and signed source/run binding only against active non-caller OPA deployment trust data, evaluates validity with OPA runtime time, and binds the exact six-attestation bundle before authorization as described in `docs/PRODUCT_REQUIREMENTS.md`; test-vector trust, metadata strings, frozen timestamps, and booleans alone are not production proof.

The governed data implementation, its Python tests, `pyproject.toml`, `uv.lock`, `requirements.txt`, `scripts/setup-python.mjs`, and shared capability-source inputs are byte-bound by the canonical SPEC-20 source manifest. Any content change requires fresh artifacts and attestations. This binds the repository dependency declaration and environment-construction path, but is not hermetic dependency locking: several requirements are unpinned or ranged and the current `uv.lock` has no resolved dependency package entries. Exact Python resolution and environment provenance remain production-hardening work.

Integration-boundary routing and outbound model-send rules are defined in `docs/INTEGRATION_BOUNDARY.md`.

Canonical governed terms and the controlled-resource catalog are defined only in `docs/INTEGRATION_BOUNDARY.md` under “Canonical glossary (normative)” and “Canonical controlled-resource catalog (normative).”

## Tenant-bound persistence lifecycle

Every persisted ledger, audit, and evidence artifact must validate against the closed `schemas/persistent-artifact.schema.json`. One tenant identity is bound consistently across the artifact, owner, source, access metadata, and the `tenants/<tenant_id>/<artifact-type>/...` storage path. Authorization compares the gateway/PEP-owned request tenant to every tenant binding before read, write, list, delete, export, or DSAR processing. Shared, global, caller-selected, mismatched, or unscoped tenant paths deny.

The artifact records PII classification; a retention-policy reference and status; deletion and legal-hold state; DSAR correlation and status; authorized roles and isolation metadata; source task/run/revision/digest; and integrity/version metadata. Missing, malformed, unknown, contradictory, or unbound fields fail schema or authorization checks closed.

Retention target values are deliberately not defined here. F1-05 is the user-owned source of those values; until it supplies an accepted policy, `retention.status=pending_user_decision` records that no duration is authorized. Deletion requests preserve the artifact's tenant and DSAR correlation, stop when an active legal hold applies, and become inaccessible when deletion completes. DSAR handling preserves the same tenant binding from receipt through verification, processing, fulfillment, or rejection.

Controls:
- The query parser validates exactly one SELECT statement.
- DML, DDL, engine control statements, multi-statement SQL, and raw PII columns are rejected.
- The isolated analytical engine executes only the accepted aggregate query.
- The PII recognizer detects and anonymizes deterministic PII examples.
- The returned data result includes booleans proving unsafe classes were rejected.

SQL validation rules:
| Rule | Enforcement |
| --- | --- |
| Single SELECT only | Rejects multi-statement SQL and set operations such as UNION/INTERSECT/EXCEPT. |
| Aggregate-only projection | Allows COUNT/SUM/AVG/MIN/MAX and plain columns only when they appear in GROUP BY. |
| No broad projection | Rejects SELECT *. |
| Allowlisted tables | Allows only configured metric tables such as `customers`; CTE aliases are scoped to their query. |
| PII denied everywhere | Rejects PII columns in projection, filters, grouping, HAVING, ordering, CTEs, and subqueries. |

Offline PII coverage:
- `EMAIL_ADDRESS`, `PHONE_NUMBER`, `CREDIT_CARD`, `IP_ADDRESS`, and `URL` use offline pattern/checksum recognizers without NLP model downloads.
- `PERSON` remains a deterministic custom recognizer for the local evidence fixture.
- Credit card detection uses Luhn validation, so invalid 16-digit order numbers are not flagged.
- Raw projections of related columns such as `phone`, `credit_card`, `ip_address`, and `url` are rejected before query execution.

## Non-normative current design inventory

The current data path uses SQLGlot for parsing, DuckDB for isolated analytical execution, and Presidio for PII recognition. These tool names describe the present implementation and are not normative requirements or conformance evidence.
