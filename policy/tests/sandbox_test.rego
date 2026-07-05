package eap.sandbox_test

import data.eap.sandbox
import rego.v1

valid_input := {
	"tenant": "acme",
	"egress": "deny",
	"policy_id": "",
	"env_keys": [],
}

test_allow_happy_path if {
	sandbox.allow with input as valid_input
}

test_tenant_mismatch_denied if {
	sandbox.deny_reason["tenant_mismatch"] with input as object.union(valid_input, {"tenant": "other"})
}

test_empty_tenant_allowlist_denied if {
	not sandbox.allow with input as valid_input with data.eap.tenants.allowed as []
	sandbox.deny_reason["tenant_mismatch"] with input as valid_input with data.eap.tenants.allowed as []
}

test_egress_denied if {
	sandbox.deny_reason["egress_not_denied"] with input as object.union(valid_input, {"egress": "allow", "policy_id": "missing"})
}

test_env_denied if {
	sandbox.deny_reason["env_key_not_allowed"] with input as object.union(valid_input, {"env_keys": ["SECRET_TOKEN"]})
}
