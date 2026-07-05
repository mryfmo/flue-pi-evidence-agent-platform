package eap.sandbox

import rego.v1

default allow := false
default requires_approval := false

allowlisted_egress_policy contains "__none__" if { false }
allowlisted_env_key contains "__none__" if { false }

allowed_tenant if {
	data.eap.tenants.allowed[_] == input.tenant
}

deny_reason contains "tenant_mismatch" if {
	not allowed_tenant
}

deny_reason contains "egress_not_denied" if {
	input.egress != "deny"
	not allowlisted_egress_policy[input.policy_id]
}

deny_reason contains "env_key_not_allowed" if {
	key := input.env_keys[_]
	not allowlisted_env_key[key]
}

allow if {
	allowed_tenant
	input.egress == "deny"
	not deny_reason["env_key_not_allowed"]
}
