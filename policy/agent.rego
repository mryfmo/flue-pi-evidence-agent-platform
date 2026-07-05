package eap.agent

import rego.v1

default allow := false
default requires_approval := false

allowed_tool contains "apply_patch"
allowed_tool contains "verify_workspace"
allowed_tool contains "metric_query"
allowed_tool contains "rescan_workspace"

allowed_tenant if {
	data.eap.tenants.allowed[_] == input.tenant
}

deny_reason contains "unauthorized_user" if { input.user == "guest" }
deny_reason contains "dangerous_shell" if { input.tool == "shell" }
deny_reason contains "tenant_mismatch" if { not allowed_tenant }
deny_reason contains "raw_data_tool_blocked" if { input.tool == "raw_sql" }
deny_reason contains "unknown_tool" if { not allowed_tool[input.tool] }

requires_approval if { input.risk == "high" }

allow if {
	input.user != "guest"
	allowed_tenant
	allowed_tool[input.tool]
  not requires_approval
}
