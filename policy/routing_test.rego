package eap.routing_test

import data.eap.routing
import rego.v1

p8_policy_doc := {
	"providers": {
		"local": {"type": "local_gateway"},
		"external": {"type": "hosted"},
	},
	"routes": [{"id": "route-1"}],
}

p8_valid_decision := {
	"tenant": "acme",
	"route_id": "route-1",
	"provider": "local",
	"data_classification": "internal",
}

test_confidential_external_requires_approval if {
	routing.deny_reason.confidential_requires_approval with input as {
		"decision": object.union(p8_valid_decision, {"provider": "external", "data_classification": "confidential"}),
		"policy": p8_policy_doc,
	}
}

test_confidential_external_allows_with_approval if {
	routing.allow with input as {
		"decision": object.union(p8_valid_decision, {"provider": "external", "data_classification": "confidential", "approval_ref": "approval-123"}),
		"policy": p8_policy_doc,
	}
}
