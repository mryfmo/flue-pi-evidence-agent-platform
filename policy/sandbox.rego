package eap.sandbox

import rego.v1

default allow := false

default requires_approval := false

known_role contains "platform_engineer"

known_role contains "software_engineer"

known_role contains "data_analyst"

known_role contains "security_reviewer"

approval_action contains "apply_patch"

approval_action contains "release_acceptance"

approval_action contains "policy_edit"

approval_action contains "skill_promotion"

approval_action contains "credential_use"

approval_action contains "production_data_access"

valid_identity if {
	is_object(input.identity_context)
	is_string(input.identity_context.subject_id)
	input.identity_context.subject_id != ""
	input.identity_context.principal_type == "authenticated"
	is_array(input.identity_context.tenant_memberships)
	count(input.identity_context.tenant_memberships) > 0
	is_array(input.identity_context.roles)
	count(input.identity_context.roles) > 0
	input.identity_context.issuer == "flue-pi-identity-authority"
	input.identity_context.audience == "flue-pi-sandbox-policy"
	input.identity_context.verification.status == "verified"
	input.identity_context.verification.owner == "flue-pi-platform-gateway"
	is_string(input.identity_context.request_binding.id)
	input.identity_context.request_binding.id != ""
}

valid_request if {
	is_object(input.request_context)
	is_string(input.request_context.tenant)
	input.request_context.tenant != ""
	is_string(input.request_context.task_id)
	input.request_context.task_id != ""
	is_string(input.request_context.run_id)
	input.request_context.run_id != ""
	is_string(input.request_context.binding_id)
	input.request_context.binding_id != ""
	is_string(input.request_context.source.revision)
	input.request_context.source.revision != ""
	regex.match(`^sha256:[0-9a-f]{64}$`, input.request_context.source.digest)
	regex.match(`^sha256:[0-9a-f]{64}$`, input.request_context.evidence_digest)
	is_string(input.request_context.action)
	input.request_context.action != ""
}

unknown_role if {
	role := input.identity_context.roles[_]
	not known_role[role]
}

tenant_authorized if {
	input.identity_context.tenant_memberships[_] == input.request_context.tenant
	data.eap.tenants.allowed[_] == input.request_context.tenant
}

legacy_tenant_authorized if input.tenant == data.eap.tenants.allowed[_]

request_bound if {
	input.identity_context.request_binding.id == input.request_context.binding_id
	input.egress_request.binding_id == input.request_context.binding_id
}

caller_authorization_field if object.get(input, "provenance", null) != null

caller_authorization_field if {
	body := object.get(input, "body", {})
	is_object(body)
	key := {"user", "tenant", "role", "issuer", "audience", "verification", "identity_context", "request_context", "approval"}[_]
	object.get(body, key, null) != null
}

valid_catalog_row(row) if {
	is_object(row)
	object.keys(row) == {"tenant_id", "destination", "protocol", "port", "action", "enabled", "requires_approval", "allowed_roles"}
	is_string(row.tenant_id)
	row.tenant_id != ""
	is_string(row.destination)
	regex.match(`^[A-Za-z0-9.-]+$`, row.destination)
	row.protocol == "https"
	is_number(row.port)
	row.port >= 1
	row.port <= 65535
	is_string(row.action)
	row.action != ""
	is_boolean(row.enabled)
	is_boolean(row.requires_approval)
	is_array(row.allowed_roles)
	count(row.allowed_roles) > 0
	count(row.allowed_roles) == count({role | role := row.allowed_roles[_]})
	every role in row.allowed_roles {
		is_string(role)
		known_role[role]
	}
}

catalog_valid if {
	is_array(input.egress_catalog)
	count(input.egress_catalog) > 0
	every row in input.egress_catalog {
		valid_catalog_row(row)
	}
}

catalog_match contains row if {
	some index
	row := input.egress_catalog[index]
	valid_catalog_row(row)
	row.tenant_id == input.request_context.tenant
	row.destination == input.egress_request.destination
	row.protocol == input.egress_request.protocol
	row.port == input.egress_request.port
	row.action == input.request_context.action
	row.action == input.egress_request.action
	row.enabled == true
	row.allowed_roles[_] == input.identity_context.roles[_]
}

catalog_match_indices contains index if {
	row := input.egress_catalog[index]
	valid_catalog_row(row)
	row.tenant_id == input.request_context.tenant
	row.destination == input.egress_request.destination
	row.protocol == input.egress_request.protocol
	row.port == input.egress_request.port
	row.action == input.request_context.action
	row.action == input.egress_request.action
	row.enabled == true
	row.allowed_roles[_] == input.identity_context.roles[_]
}

single_catalog_match if {
	catalog_valid
	count(catalog_match_indices) == 1
}

requires_approval if {
	single_catalog_match
	row := catalog_match[_]
	row.requires_approval == true
}

valid_approval_identity(identity) if {
	is_object(identity)
	object.keys(identity) == {"subject_id", "principal_type", "tenant_memberships", "roles", "issuer", "audience", "verification", "request_binding"}
	is_string(identity.subject_id)
	identity.subject_id != ""
	identity.principal_type == "authenticated"
	is_array(identity.tenant_memberships)
	count(identity.tenant_memberships) > 0
	count(identity.tenant_memberships) == count({tenant | tenant := identity.tenant_memberships[_]})
	every tenant in identity.tenant_memberships {
		is_string(tenant)
		tenant != ""
	}
	is_array(identity.roles)
	count(identity.roles) > 0
	count(identity.roles) == count({role | role := identity.roles[_]})
	every role in identity.roles {
		is_string(role)
		known_role[role]
	}
	identity.issuer == "flue-pi-identity-authority"
	identity.audience == "flue-pi-agent-policy"
	object.keys(identity.verification) == {"status", "owner"}
	identity.verification.status == "verified"
	identity.verification.owner == "flue-pi-platform-gateway"
	object.keys(identity.request_binding) == {"id"}
	is_string(identity.request_binding.id)
	identity.request_binding.id != ""
}

canonical_approval_valid if {
	is_object(input.record_context)
	object.keys(input.record_context) == {"persisted", "immutable", "integrity_verified"}
	input.record_context.persisted == true
	input.record_context.immutable == true
	input.record_context.integrity_verified == true
	is_object(input.approval)
	object.keys(input.approval) == {"schema_version", "approval_id", "tenant_id", "task_id", "run_id", "source", "evidence_digest", "action", "requester_identity", "created_at", "expires_at", "state", "decision", "resume"}
	input.approval.schema_version == "1.0"
	is_string(input.approval.approval_id)
	input.approval.approval_id != ""
	is_string(input.approval.tenant_id)
	input.approval.tenant_id != ""
	is_string(input.approval.task_id)
	input.approval.task_id != ""
	is_string(input.approval.run_id)
	input.approval.run_id != ""
	object.keys(input.approval.source) == {"revision", "digest"}
	is_string(input.approval.source.revision)
	input.approval.source.revision != ""
	regex.match(`^sha256:[0-9a-f]{64}$`, input.approval.source.digest)
	regex.match(`^sha256:[0-9a-f]{64}$`, input.approval.evidence_digest)
	approval_action[input.approval.action]
	valid_approval_identity(input.approval.requester_identity)
	input.approval.state == "approved"
	is_object(input.approval.decision)
	object.keys(input.approval.decision) == {"outcome", "decided_at", "idempotency_key", "request_digest", "approver_identity"}
	input.approval.decision.outcome == "approved"
	is_string(input.approval.decision.idempotency_key)
	input.approval.decision.idempotency_key != ""
	regex.match(`^sha256:[0-9a-f]{64}$`, input.approval.decision.request_digest)
	valid_approval_identity(input.approval.decision.approver_identity)
	object.keys(input.approval.resume) == {"status"}
	input.approval.resume.status == "not_resumed"
	data.eap.approval.persisted_record
	data.eap.approval.record_integrity
	data.eap.approval.not_expired
}

valid_egress_authorization_context(row) if {
	context := input.egress_authorization_context
	is_object(context)
	object.keys(context) == {"approval_id", "approval_action", "tenant_id", "task_id", "run_id", "source", "evidence_digest", "request_binding_id", "destination", "protocol", "port", "action"}
	context.approval_id == input.approval.approval_id
	context.approval_action == input.approval.action
	context.tenant_id == input.approval.tenant_id
	context.task_id == input.approval.task_id
	context.run_id == input.approval.run_id
	object.keys(context.source) == {"revision", "digest"}
	context.source == input.approval.source
	context.evidence_digest == input.approval.evidence_digest
	context.request_binding_id == input.approval.requester_identity.request_binding.id
	context.destination == row.destination
	context.protocol == row.protocol
	context.port == row.port
	context.action == row.action
	context.action == input.approval.action
}

approval_bound(row) if {
	canonical_approval_valid
	input.approval.tenant_id == input.request_context.tenant
	input.approval.task_id == input.request_context.task_id
	input.approval.run_id == input.request_context.run_id
	input.approval.source == input.request_context.source
	input.approval.evidence_digest == input.request_context.evidence_digest
	input.approval.requester_identity.request_binding.id == input.request_context.binding_id
	valid_egress_authorization_context(row)
	input.egress_authorization_context.tenant_id == input.request_context.tenant
	input.egress_authorization_context.task_id == input.request_context.task_id
	input.egress_authorization_context.run_id == input.request_context.run_id
	input.egress_authorization_context.source == input.request_context.source
	input.egress_authorization_context.evidence_digest == input.request_context.evidence_digest
	input.egress_authorization_context.request_binding_id == input.request_context.binding_id
}

egress_authorized if {
	input.egress == "allow"
	valid_identity
	valid_request
	not unknown_role
	tenant_authorized
	request_bound
	not caller_authorization_field
	single_catalog_match
	not requires_approval
}

egress_authorized if {
	input.egress == "allow"
	valid_identity
	valid_request
	not unknown_role
	tenant_authorized
	request_bound
	not caller_authorization_field
	single_catalog_match
	requires_approval
	row := catalog_match[_]
	approval_bound(row)
}

env_keys_allowed if {
	keys := object.get(input, "env_keys", [])
	is_array(keys)
	count(keys) == 0
}

allow if {
	input.egress == "deny"
	legacy_tenant_authorized
	env_keys_allowed
}

allow if egress_authorized

deny_reason contains "identity_invalid" if {
	input.egress == "allow"
	not valid_identity
}

deny_reason contains "request_invalid" if {
	input.egress == "allow"
	not valid_request
}

deny_reason contains "unknown_role" if {
	input.egress == "allow"
	valid_identity
	unknown_role
}

deny_reason contains "tenant_mismatch" if {
	input.egress == "allow"
	valid_identity
	valid_request
	not tenant_authorized
}

deny_reason contains "request_binding_mismatch" if {
	input.egress == "allow"
	valid_identity
	valid_request
	not request_bound
}

deny_reason contains "caller_provenance_forbidden" if caller_authorization_field

deny_reason contains "destination_not_cataloged" if {
	input.egress == "allow"
	count(catalog_match) == 0
}

deny_reason contains "catalog_invalid" if {
	input.egress == "allow"
	not catalog_valid
}

deny_reason contains "catalog_ambiguous" if count(catalog_match_indices) > 1

deny_reason contains "approval_required" if {
	input.egress == "allow"
	requires_approval
	row := catalog_match[_]
	not approval_bound(row)
}

deny_reason contains "tenant_mismatch" if {
	input.egress == "deny"
	not legacy_tenant_authorized
}

deny_reason contains "env_key_not_allowed" if {
	input.egress == "deny"
	not env_keys_allowed
}
