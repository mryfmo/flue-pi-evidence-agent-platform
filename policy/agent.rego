package eap.agent

default allow = false
default requires_approval = false

allowed_tool["apply_patch"]
allowed_tool["verify_workspace"]
allowed_tool["metric_query"]
allowed_tool["rescan_workspace"]

allowed_tenant {
  data.eap.tenants.allowed[_] == input.tenant
}

deny_reason["unauthorized_user"] { input.user == "guest" }
deny_reason["dangerous_shell"] { input.tool == "shell" }
deny_reason["tenant_mismatch"] { not allowed_tenant }
deny_reason["raw_data_tool_blocked"] { input.tool == "raw_sql" }
deny_reason["unknown_tool"] { not allowed_tool[input.tool] }

requires_approval { input.risk == "high" }

allow {
  input.user != "guest"
  allowed_tenant
  allowed_tool[input.tool]
  not requires_approval
}
