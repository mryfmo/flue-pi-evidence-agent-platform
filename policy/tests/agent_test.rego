package eap.agent_test

import data.eap.agent
import rego.v1

valid_input := {
	"user": "engineer",
	"tenant": "acme",
	"tool": "apply_patch",
	"risk": "medium",
	"resource": "repo",
}

test_allow_happy_path if {
	agent.allow with input as valid_input
}

test_guest_denied if {
	agent.deny_reason["unauthorized_user"] with input as object.union(valid_input, {"user": "guest"})
}

test_tenant_mismatch_denied if {
	agent.deny_reason["tenant_mismatch"] with input as object.union(valid_input, {"tenant": "other"})
}

test_empty_tenant_allowlist_denied if {
	not agent.allow with input as valid_input with data.eap.tenants.allowed as []
	agent.deny_reason["tenant_mismatch"] with input as valid_input with data.eap.tenants.allowed as []
}

test_shell_denied if {
	agent.deny_reason["dangerous_shell"] with input as object.union(valid_input, {"tool": "shell"})
}

test_raw_sql_denied if {
	agent.deny_reason["raw_data_tool_blocked"] with input as object.union(valid_input, {"tool": "raw_sql"})
}

test_unknown_tool_denied if {
	agent.deny_reason["unknown_tool"] with input as object.union(valid_input, {"tool": "missing"})
}

test_high_risk_requires_approval if {
	agent.requires_approval with input as object.union(valid_input, {"risk": "high"})
	not agent.allow with input as object.union(valid_input, {"risk": "high"})
}
