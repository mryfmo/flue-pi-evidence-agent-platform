package eap.routing_test

import data.eap.routing
import rego.v1

policy_doc := {
	"providers": {
		"local": {"type": "local_gateway"},
		"external": {"type": "hosted"},
	},
	"routes": [{"id": "route-1"}],
}

valid_decision := {
	"tenant": "acme",
	"route_id": "route-1",
	"provider": "local",
	"data_classification": "internal",
}

valid_input := {"decision": valid_decision, "policy": policy_doc}

test_allow_happy_path if {
	routing.allow with input as valid_input
}

test_tenant_mismatch_denied if {
	routing.deny_reason["tenant_mismatch"] with input as {
		"decision": object.union(valid_decision, {"tenant": "other"}),
		"policy": policy_doc,
	}
}

test_empty_tenant_allowlist_denied if {
	not routing.allow with input as valid_input with data.eap.tenants.allowed as []
	routing.deny_reason["tenant_mismatch"] with input as valid_input with data.eap.tenants.allowed as []
}

test_restricted_external_denied if {
	routing.deny_reason["restricted_external_provider"] with input as {
		"decision": object.union(valid_decision, {"provider": "external", "data_classification": "restricted"}),
		"policy": policy_doc,
	}
}
