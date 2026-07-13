package eap.agent

import rego.v1

default allow := false

default requires_approval := false

allowed_tool contains "apply_patch"

allowed_tool contains "verify_workspace"

allowed_tool contains "metric_query"

allowed_tool contains "rescan_workspace"

known_role contains "platform_engineer"

known_role contains "software_engineer"

known_role contains "data_analyst"

known_role contains "security_reviewer"

role_allows("platform_engineer", tool) if allowed_tool[tool]

role_allows("software_engineer", "apply_patch")

role_allows("software_engineer", "verify_workspace")

role_allows("software_engineer", "rescan_workspace")

role_allows("data_analyst", "metric_query")

role_allows("security_reviewer", "verify_workspace")

identity_context_present if is_object(object.get(input, "identity_context", null))

valid_identity_context if {
	identity_context_present
	is_string(input.identity_context.subject_id)
	input.identity_context.subject_id != ""
	is_string(input.identity_context.principal_type)
	is_array(input.identity_context.tenant_memberships)
	is_array(input.identity_context.roles)
	is_string(input.identity_context.issuer)
	is_string(input.identity_context.audience)
	is_object(input.identity_context.verification)
	is_string(input.identity_context.verification.status)
	is_string(input.identity_context.verification.owner)
	is_object(input.identity_context.request_binding)
	is_string(input.identity_context.request_binding.id)
	input.identity_context.request_binding.id != ""
}

request_context_present if is_object(object.get(input, "request_context", null))

valid_request_context if {
	request_context_present
	is_string(input.request_context.tenant)
	input.request_context.tenant != ""
	is_string(input.request_context.binding_id)
	input.request_context.binding_id != ""
}

tenant_member if {
	valid_identity_context
	valid_request_context
	input.identity_context.tenant_memberships[_] == input.request_context.tenant
}

allowed_tenant if {
	valid_request_context
	data.eap.tenants.allowed[_] == input.request_context.tenant
}

has_unknown_role if {
	valid_identity_context
	role := input.identity_context.roles[_]
	not known_role[role]
}

has_permitted_role if {
	valid_identity_context
	role_allows(input.identity_context.roles[_], input.tool)
}

body_identity_present if object.get(input, "user", null) != null

body_identity_present if object.get(input, "tenant", null) != null

body_identity_present if object.get(input, "role", null) != null

body_identity_present if {
	body := object.get(input, "body", {})
	is_object(body)
	object.get(body, "user", null) != null
}

body_identity_present if {
	body := object.get(input, "body", {})
	is_object(body)
	object.get(body, "tenant", null) != null
}

body_identity_present if {
	body := object.get(input, "body", {})
	is_object(body)
	object.get(body, "role", null) != null
}

body_identity_present if {
	body := object.get(input, "body", {})
	is_object(body)
	object.get(body, "issuer", null) != null
}

body_identity_present if {
	body := object.get(input, "body", {})
	is_object(body)
	object.get(body, "audience", null) != null
}

body_identity_present if {
	body := object.get(input, "body", {})
	is_object(body)
	object.get(body, "verification", null) != null
}

deny_reason contains "missing_identity_context" if not identity_context_present

deny_reason contains "malformed_identity_context" if {
	identity_context_present
	not valid_identity_context
}

deny_reason contains "missing_request_context" if not request_context_present

deny_reason contains "malformed_request_context" if {
	request_context_present
	not valid_request_context
}

deny_reason contains "anonymous_principal" if {
	valid_identity_context
	input.identity_context.principal_type != "authenticated"
}

deny_reason contains "issuer_mismatch" if {
	valid_identity_context
	input.identity_context.issuer != "flue-pi-identity-authority"
}

deny_reason contains "audience_mismatch" if {
	valid_identity_context
	input.identity_context.audience != "flue-pi-agent-policy"
}

deny_reason contains "identity_unverified" if {
	valid_identity_context
	input.identity_context.verification.status != "verified"
}

deny_reason contains "verifier_mismatch" if {
	valid_identity_context
	input.identity_context.verification.owner != "flue-pi-platform-gateway"
}

deny_reason contains "request_binding_mismatch" if {
	valid_identity_context
	valid_request_context
	input.identity_context.request_binding.id != input.request_context.binding_id
}

deny_reason contains "tenant_mismatch" if {
	valid_identity_context
	valid_request_context
	not tenant_member
}

deny_reason contains "tenant_mismatch" if {
	valid_request_context
	not allowed_tenant
}

deny_reason contains "missing_role" if {
	identity_context_present
	not is_array(object.get(input.identity_context, "roles", null))
}

deny_reason contains "missing_role" if {
	valid_identity_context
	count(input.identity_context.roles) == 0
}

deny_reason contains "unknown_role" if {
	valid_identity_context
	count(input.identity_context.roles) > 0
	has_unknown_role
}

deny_reason contains "insufficient_role" if {
	valid_identity_context
	count(input.identity_context.roles) > 0
	not has_permitted_role
}

deny_reason contains "body_identity_forbidden" if body_identity_present

deny_reason contains "dangerous_shell" if input.tool == "shell"

deny_reason contains "raw_data_tool_blocked" if input.tool == "raw_sql"

deny_reason contains "unknown_tool" if not allowed_tool[input.tool]

requires_approval if input.risk == "high"

allow if {
	valid_identity_context
	valid_request_context
	input.identity_context.principal_type == "authenticated"
	input.identity_context.issuer == "flue-pi-identity-authority"
	input.identity_context.audience == "flue-pi-agent-policy"
	input.identity_context.verification.status == "verified"
	input.identity_context.verification.owner == "flue-pi-platform-gateway"
	input.identity_context.request_binding.id == input.request_context.binding_id
	tenant_member
	allowed_tenant
	has_permitted_role
	not has_unknown_role
	allowed_tool[input.tool]
	not body_identity_present
	not requires_approval
}
