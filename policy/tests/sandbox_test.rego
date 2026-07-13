package eap.sandbox_test

import data.eap.sandbox
import rego.v1

digest_a := "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

digest_b := "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

identity := {
	"subject_id": "sub-1",
	"principal_type": "authenticated",
	"tenant_memberships": ["acme"],
	"roles": ["software_engineer"],
	"issuer": "flue-pi-identity-authority",
	"audience": "flue-pi-sandbox-policy",
	"verification": {"status": "verified", "owner": "flue-pi-platform-gateway"},
	"request_binding": {"id": "binding-1"},
}

catalog := [
	{"tenant_id": "acme", "destination": "packages.example", "protocol": "https", "port": 443, "action": "fetch_dependency", "enabled": true, "requires_approval": false, "allowed_roles": ["software_engineer"]},
	{"tenant_id": "acme", "destination": "security.example", "protocol": "https", "port": 443, "action": "production_data_access", "enabled": true, "requires_approval": true, "allowed_roles": ["security_reviewer"]},
]

valid_input := {
	"now": "2026-07-13T12:00:00Z",
	"egress": "allow",
	"identity_context": identity,
	"request_context": {"tenant": "acme", "task_id": "task-1", "run_id": "run-1", "binding_id": "binding-1", "source": {"revision": "rev-1", "digest": digest_a}, "evidence_digest": digest_b, "action": "fetch_dependency"},
	"egress_request": {"destination": "packages.example", "protocol": "https", "port": 443, "action": "fetch_dependency", "binding_id": "binding-1"},
	"egress_catalog": catalog,
	"env_keys": [],
}

approval_input := object.union(valid_input, {
	"identity_context": object.union(identity, {"roles": ["security_reviewer"]}),
	"request_context": object.union(valid_input.request_context, {"action": "production_data_access"}),
	"egress_request": object.union(valid_input.egress_request, {"destination": "security.example", "action": "production_data_access"}),
	"record_context": {"persisted": true, "immutable": true, "integrity_verified": true},
	"approval": {
		"schema_version": "1.0",
		"approval_id": "approval-1",
		"tenant_id": "acme",
		"task_id": "task-1",
		"run_id": "run-1",
		"source": {"revision": "rev-1", "digest": digest_a},
		"evidence_digest": digest_b,
		"action": "production_data_access",
		"requester_identity": {
			"subject_id": "requester-1", "principal_type": "authenticated", "tenant_memberships": ["acme"], "roles": ["software_engineer"],
			"issuer": "flue-pi-identity-authority", "audience": "flue-pi-agent-policy",
			"verification": {"status": "verified", "owner": "flue-pi-platform-gateway"}, "request_binding": {"id": "binding-1"},
		},
		"created_at": "2026-07-13T10:00:00Z",
		"expires_at": "2026-07-14T12:00:00Z",
		"state": "approved",
		"decision": {
			"outcome": "approved", "decided_at": "2026-07-13T11:00:00Z", "idempotency_key": "approve-key",
			"request_digest": digest_a,
			"approver_identity": {
				"subject_id": "approver-1", "principal_type": "authenticated", "tenant_memberships": ["acme"], "roles": ["security_reviewer"],
				"issuer": "flue-pi-identity-authority", "audience": "flue-pi-agent-policy",
				"verification": {"status": "verified", "owner": "flue-pi-platform-gateway"}, "request_binding": {"id": "approver-binding"},
			},
		},
		"resume": {"status": "not_resumed"},
	},
	"egress_authorization_context": {
		"approval_id": "approval-1", "approval_action": "production_data_access", "tenant_id": "acme", "task_id": "task-1", "run_id": "run-1",
		"source": {"revision": "rev-1", "digest": digest_a}, "evidence_digest": digest_b, "request_binding_id": "binding-1",
		"destination": "security.example", "protocol": "https", "port": 443, "action": "production_data_access",
	},
})

test_no_egress_legacy_allow if sandbox.allow with input as {"tenant": "acme", "egress": "deny", "env_keys": []}

test_valid_nonapproval_egress_allows if sandbox.allow with input as valid_input

test_valid_approval_egress_allows if {
	sandbox.allow with input as approval_input
	sandbox.requires_approval with input as approval_input
}

test_identity_failures_deny if {
	variants := [
		object.union(identity, {"principal_type": "anonymous"}),
		object.union(identity, {"verification": {"status": "unverified", "owner": "flue-pi-platform-gateway"}}),
		object.union(identity, {"issuer": "wrong"}),
		object.union(identity, {"audience": "wrong"}),
		object.union(identity, {"roles": ["unknown"]}),
		object.union(identity, {"tenant_memberships": ["other"]}),
	]
	some candidate in variants
	not sandbox.allow with input as object.union(valid_input, {"identity_context": candidate})
}

test_missing_identity_denies if {
	candidate := object.remove(valid_input, {"identity_context"})
	not sandbox.allow with input as candidate
}

test_body_forged_identity_denies if not sandbox.allow with input as object.union(valid_input, {"body": {"tenant": "acme"}})

test_destination_tuple_failures_deny if {
	variants := [
		object.remove(valid_input.egress_request, {"destination"}),
		object.union(valid_input.egress_request, {"destination": "unknown.example"}),
		object.union(valid_input.egress_request, {"protocol": "http"}),
		object.union(valid_input.egress_request, {"port": 80}),
	]
	some candidate in variants
	not sandbox.allow with input as object.union(valid_input, {"egress_request": candidate})
}

test_split_witness_catalog_denies if {
	rows := [
		object.union(catalog[0], {"protocol": "http"}),
		object.union(catalog[0], {"port": 80}),
	]
	not sandbox.allow with input as object.union(valid_input, {"egress_catalog": rows})
}

test_catalog_rows_are_closed_and_typed if {
	row := valid_input.egress_catalog[0]
	variants := [
		object.remove(row, {"requires_approval"}),
		object.union(row, {"requires_approval": "yes"}),
		object.union(row, {"unknown": true}),
		object.union(row, {"allowed_roles": "software_engineer"}),
		object.union(row, {"allowed_roles": ["software_engineer", "software_engineer"]}),
	]
	some candidate in variants
	decision := sandbox with input as object.union(valid_input, {"egress_catalog": [candidate]})
	not decision.allow
	count(decision.deny_reason) > 0
}

test_duplicate_matching_catalog_rows_deny if {
	result := sandbox with input as object.union(valid_input, {"egress_catalog": [valid_input.egress_catalog[0], valid_input.egress_catalog[0]]})
	not result.allow
	"catalog_ambiguous" in result.deny_reason
}

test_request_binding_denies if not sandbox.allow with input as object.union(valid_input, {"egress_request": object.union(valid_input.egress_request, {"binding_id": "other"})})

test_approval_failures_deny if {
	a := approval_input.approval
	variants := [
		object.remove(a, {"approval_id", "requester_identity", "decision"}),
		object.union(a, {"state": "pending"}),
		object.union(a, {"state": "rejected"}),
		object.union(a, {"expires_at": "2026-07-12T12:00:00Z"}),
		object.union(a, {"tenant_id": "other"}),
		object.union(a, {"task_id": "other"}),
		object.union(a, {"run_id": "other"}),
		object.union(a, {"source": {"revision": "other", "digest": digest_a}}),
		object.union(a, {"evidence_digest": digest_a}),
		object.union(a, {"action": "other"}),
		object.union(a, {"decision": object.union(a.decision, {"decided_at": "2026-07-13T09:00:00Z"})}),
		object.union(a, {"decision": object.union(a.decision, {"decided_at": "2026-07-13T13:00:00Z"})}),
		object.union(a, {"decision": object.union(a.decision, {"decided_at": "2026-07-14T12:00:00Z"})}),
		object.union(a, {"resume": {"status": "resumed", "resumed_at": "2026-07-13T11:30:00Z", "idempotency_key": "resume-key", "request_digest": digest_a}}),
	]
	some candidate in variants
	decision := sandbox with input as object.union(approval_input, {"approval": candidate})
	not decision.allow
	count(decision.deny_reason) > 0
}

test_approval_identities_fail_closed if {
	decision := approval_input.approval.decision
	approver := decision.approver_identity
	variants := [
		object.union(approver, {"tenant_memberships": ["other"]}),
		object.union(approver, {"roles": ["unknown"]}),
		object.union(approver, {"verification": {"status": "unverified", "owner": "flue-pi-platform-gateway"}}),
	]
	some candidate in variants
	mutated := object.union(approval_input.approval, {"decision": object.union(decision, {"approver_identity": candidate})})
	result := sandbox with input as object.union(approval_input, {"approval": mutated})
	not result.allow
	count(result.deny_reason) > 0
}

test_egress_authorization_context_is_closed_and_bound if {
	context := approval_input.egress_authorization_context
	variants := [
		object.union(context, {"destination": "other.example"}),
		object.union(context, {"protocol": "http"}),
		object.union(context, {"port": 80}),
		object.union(context, {"action": "other"}),
		object.union(context, {"unknown": true}),
	]
	some candidate in variants
	result := sandbox with input as object.union(approval_input, {"egress_authorization_context": candidate})
	not result.allow
	count(result.deny_reason) > 0
}

test_malformed_request_context_denies if {
	base := object.remove(valid_input, {"request_context"})
	candidate := object.union(base, {"request_context": object.remove(valid_input.request_context, {"source"})})
	not sandbox.allow with input as candidate
}

test_missing_approval_denies if {
	candidate := object.remove(approval_input, {"approval"})
	not sandbox.allow with input as candidate
	sandbox.requires_approval with input as candidate
}
