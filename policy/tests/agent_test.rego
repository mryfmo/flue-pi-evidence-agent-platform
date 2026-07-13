package eap.agent_test

import data.eap.agent
import rego.v1

valid_identity := {
	"subject_id": "sub-123",
	"principal_type": "authenticated",
	"tenant_memberships": ["acme"],
	"roles": ["software_engineer"],
	"issuer": "flue-pi-identity-authority",
	"audience": "flue-pi-agent-policy",
	"verification": {"status": "verified", "owner": "flue-pi-platform-gateway"},
	"request_binding": {"id": "req-123"},
}

valid_input := {
	"identity_context": valid_identity,
	"request_context": {"tenant": "acme", "binding_id": "req-123"},
	"tool": "apply_patch",
	"risk": "medium",
	"resource": "repo",
}

test_allow_happy_path if agent.allow with input as valid_input

test_missing_identity_denied if {
	candidate := {"request_context": valid_input.request_context, "tool": "apply_patch", "risk": "medium"}
	not agent.allow with input as candidate
	agent.deny_reason.missing_identity_context with input as candidate
}

test_malformed_identity_denied if {
	candidate := object.union(object.remove(valid_input, {"identity_context"}), {"identity_context": {"subject_id": "sub-123"}})
	not agent.allow with input as candidate
	agent.deny_reason.malformed_identity_context with input as candidate
}

test_anonymous_denied if {
	identity := object.union(valid_identity, {"principal_type": "anonymous"})
	candidate := object.union(valid_input, {"identity_context": identity})
	not agent.allow with input as candidate
	agent.deny_reason.anonymous_principal with input as candidate
}

test_issuer_audience_verifier_denied if {
	identity := object.union(valid_identity, {
		"issuer": "caller",
		"audience": "caller",
		"verification": {"status": "verified", "owner": "caller"},
	})
	candidate := object.union(valid_input, {"identity_context": identity})
	not agent.allow with input as candidate
	agent.deny_reason.issuer_mismatch with input as candidate
	agent.deny_reason.audience_mismatch with input as candidate
	agent.deny_reason.verifier_mismatch with input as candidate
}

test_unverified_denied if {
	identity := object.union(valid_identity, {"verification": {"status": "unverified", "owner": "flue-pi-platform-gateway"}})
	candidate := object.union(valid_input, {"identity_context": identity})
	not agent.allow with input as candidate
	agent.deny_reason.identity_unverified with input as candidate
}

test_tenant_mismatch_denied if {
	candidate := object.union(valid_input, {"request_context": {"tenant": "other", "binding_id": "req-123"}})
	not agent.allow with input as candidate
	agent.deny_reason.tenant_mismatch with input as candidate
}

test_empty_tenant_allowlist_denied if {
	not agent.allow with input as valid_input with data.eap.tenants.allowed as []
	agent.deny_reason.tenant_mismatch with input as valid_input with data.eap.tenants.allowed as []
}

test_missing_role_denied if {
	identity := object.union(valid_identity, {"roles": []})
	candidate := object.union(valid_input, {"identity_context": identity})
	not agent.allow with input as candidate
	agent.deny_reason.missing_role with input as candidate
}

test_absent_role_denied if {
	identity := object.remove(valid_identity, {"roles"})
	candidate := object.union(object.remove(valid_input, {"identity_context"}), {"identity_context": identity})
	not agent.allow with input as candidate
	agent.deny_reason.missing_role with input as candidate
}

test_unknown_role_denied if {
	identity := object.union(valid_identity, {"roles": ["admin"]})
	candidate := object.union(valid_input, {"identity_context": identity})
	not agent.allow with input as candidate
	agent.deny_reason.unknown_role with input as candidate
}

test_mixed_unknown_role_denied if {
	identity := object.union(valid_identity, {"roles": ["software_engineer", "admin"]})
	candidate := object.union(valid_input, {"identity_context": identity})
	not agent.allow with input as candidate
	agent.deny_reason.unknown_role with input as candidate
}

test_insufficient_role_denied if {
	identity := object.union(valid_identity, {"roles": ["data_analyst"]})
	candidate := object.union(valid_input, {"identity_context": identity})
	not agent.allow with input as candidate
	agent.deny_reason.insufficient_role with input as candidate
}

test_request_binding_mismatch_denied if {
	candidate := object.union(valid_input, {"request_context": {"tenant": "acme", "binding_id": "other"}})
	not agent.allow with input as candidate
	agent.deny_reason.request_binding_mismatch with input as candidate
}

test_body_identity_denied if {
	candidate := object.union(valid_input, {"body": {"user": "engineer", "tenant": "acme", "role": "software_engineer"}})
	not agent.allow with input as candidate
	agent.deny_reason.body_identity_forbidden with input as candidate
}

test_shell_denied if agent.deny_reason.dangerous_shell with input as object.union(valid_input, {"tool": "shell"})

test_raw_sql_denied if agent.deny_reason.raw_data_tool_blocked with input as object.union(valid_input, {"tool": "raw_sql"})

test_unknown_tool_denied if agent.deny_reason.unknown_tool with input as object.union(valid_input, {"tool": "missing"})

test_high_risk_requires_approval if {
	candidate := object.union(valid_input, {"risk": "high"})
	agent.requires_approval with input as candidate
	not agent.allow with input as candidate
}
