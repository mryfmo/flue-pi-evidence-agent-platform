package eap.routing_root_test

import data.eap.routing
import rego.v1

trust_proof := {
	"producer": "flue-pi-data-guard",
	"verified_by": "flue-pi-platform-gateway",
	"evidence_kind": "presidio-sqlglot-redaction-v1",
}

policy_doc := {
	"classification": object.union(trust_proof, {
		"enum": ["public", "internal", "confidential", "restricted"],
	}),
	"providers": {
		"local": {"type": "local_gateway"},
		"external": {"type": "hosted"},
	},
	"routes": [
		{
			"id": "route-1",
			"provider": "local",
			"model_id": "worker-main",
			"match": {"tenant": "acme", "data_classification": "internal"},
		},
		{
			"id": "route-confidential",
			"provider": "external",
			"model_id": "worker-heavy",
			"match": {"tenant": "acme", "data_classification": "confidential"},
		},
	],
}

valid_decision := {
	"tenant": "acme",
	"route_id": "route-1",
	"provider": "local",
	"model_id": "worker-main",
	"data_classification": "restricted",
	"classification": {
		"value": "internal",
		"trust_proof": trust_proof,
	},
}

test_valid_trusted_tuple_allows if {
	routing.allow with input as {"decision": valid_decision, "policy": policy_doc}
}

test_legacy_caller_classification_denied if {
	decision := object.remove(valid_decision, {"classification"})
	policy := object.remove(policy_doc, {"classification"})
	not routing.allow with input as {"decision": decision, "policy": policy}
}

test_confidential_external_requires_approval if {
	decision := object.union(valid_decision, {
		"route_id": "route-confidential",
		"provider": "external",
		"model_id": "worker-heavy",
		"classification": {"value": "confidential", "trust_proof": trust_proof},
	})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["confidential_requires_approval"] with input as {"decision": decision, "policy": policy_doc}
}

test_confidential_external_allows_with_approval if {
	decision := object.union(valid_decision, {
		"route_id": "route-confidential",
		"provider": "external",
		"model_id": "worker-heavy",
		"approval_ref": "approval-123",
		"classification": {"value": "confidential", "trust_proof": trust_proof},
	})
	routing.allow with input as {"decision": decision, "policy": policy_doc}
}
