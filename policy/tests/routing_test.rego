package eap.routing_test

import data.eap.routing
import rego.v1

classification_catalog := {
	"producer": "flue-pi-data-guard",
	"verified_by": "flue-pi-platform-gateway",
	"evidence_kind": "presidio-sqlglot-redaction-v1",
	"enum": ["public", "internal", "confidential", "restricted"],
}

trust_proof := {
	"producer": "flue-pi-data-guard",
	"verified_by": "flue-pi-platform-gateway",
	"evidence_kind": "presidio-sqlglot-redaction-v1",
}

policy_doc := {
	"classification": classification_catalog,
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

verified_internal := {
	"value": "internal",
	"trust_proof": trust_proof,
}

valid_decision := {
	"tenant": "acme",
	"route_id": "route-1",
	"provider": "local",
	"model_id": "worker-main",
	"data_classification": "restricted",
	"classification": verified_internal,
}

valid_input := {"decision": valid_decision, "policy": policy_doc}

test_allow_happy_path_uses_verified_classification if {
	routing.allow with input as valid_input
}

test_body_classification_is_not_trusted if {
	routing.allow with input as valid_input
	not routing.deny_reason["restricted_external_provider"] with input as valid_input
}

test_missing_classification_denied if {
	not routing.allow with input as {
		"decision": object.remove(valid_decision, {"classification"}),
		"policy": policy_doc,
	}
	routing.deny_reason["missing_classification"] with input as {
		"decision": object.remove(valid_decision, {"classification"}),
		"policy": policy_doc,
	}
}

test_forged_trust_denied if {
	decision := object.union(valid_decision, {
		"classification": object.union(verified_internal, {
			"trust_proof": object.union(trust_proof, {"producer": "caller-body"}),
		}),
	})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["untrusted_classification"] with input as {"decision": decision, "policy": policy_doc}
}

test_forged_verifier_denied if {
	proof := object.union(trust_proof, {"verified_by": "caller-body"})
	decision := object.union(valid_decision, {"classification": object.union(verified_internal, {"trust_proof": proof})})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["untrusted_classification"] with input as {"decision": decision, "policy": policy_doc}
}

test_forged_evidence_kind_denied if {
	proof := object.union(trust_proof, {"evidence_kind": "caller-assertion"})
	decision := object.union(valid_decision, {"classification": object.union(verified_internal, {"trust_proof": proof})})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["untrusted_classification"] with input as {"decision": decision, "policy": policy_doc}
}

test_missing_proof_denied if {
	classification := object.remove(verified_internal, {"trust_proof"})
	decision := object.union(object.remove(valid_decision, {"classification"}), {"classification": classification})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["untrusted_classification"] with input as {"decision": decision, "policy": policy_doc}
}

test_missing_catalog_classification_denied if {
	policy := object.remove(policy_doc, {"classification"})
	not routing.allow with input as {"decision": valid_decision, "policy": policy}
	routing.deny_reason["untrusted_classification"] with input as {"decision": valid_decision, "policy": policy}
	routing.deny_reason["catalog_classification_mismatch"] with input as {"decision": valid_decision, "policy": policy}
}

test_catalog_enum_mismatch_denied_with_reason if {
	classification := object.union(classification_catalog, {"enum": ["public", "confidential", "restricted"]})
	policy := object.union(policy_doc, {"classification": classification})
	not routing.allow with input as {"decision": valid_decision, "policy": policy}
	routing.deny_reason["catalog_classification_mismatch"] with input as {"decision": valid_decision, "policy": policy}
}

test_catalog_enum_missing_denied_with_reason if {
	classification := object.remove(classification_catalog, {"enum"})
	policy := object.union(object.remove(policy_doc, {"classification"}), {"classification": classification})
	not routing.allow with input as {"decision": valid_decision, "policy": policy}
	routing.deny_reason["catalog_classification_mismatch"] with input as {"decision": valid_decision, "policy": policy}
}

test_legacy_body_classification_denied if {
	decision := object.remove(valid_decision, {"classification"})
	policy := object.remove(policy_doc, {"classification"})
	not routing.allow with input as {"decision": decision, "policy": policy}
}

test_unknown_classification_denied if {
	decision := object.union(valid_decision, {"classification": object.union(verified_internal, {"value": "secret"})})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["unknown_classification"] with input as {"decision": decision, "policy": policy_doc}
}

test_malformed_classification_denied if {
	decision := object.union(valid_decision, {"classification": object.union(verified_internal, {"value": ["internal"]})})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["malformed_classification"] with input as {"decision": decision, "policy": policy_doc}
}

test_unknown_route_denied if {
	decision := object.union(valid_decision, {"route_id": "default"})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["unknown_route"] with input as {"decision": decision, "policy": policy_doc}
}

test_missing_route_denied if {
	decision := object.remove(valid_decision, {"route_id"})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["unknown_route"] with input as {"decision": decision, "policy": policy_doc}
}

test_malformed_route_denied if {
	decision := object.union(valid_decision, {"route_id": ["route-1"]})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["unknown_route"] with input as {"decision": decision, "policy": policy_doc}
}

test_missing_provider_denied if {
	decision := object.remove(valid_decision, {"provider"})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["unknown_provider"] with input as {"decision": decision, "policy": policy_doc}
}

test_unknown_provider_denied if {
	decision := object.union(valid_decision, {"provider": "missing"})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["unknown_provider"] with input as {"decision": decision, "policy": policy_doc}
}

test_malformed_provider_denied if {
	decision := object.union(valid_decision, {"provider": ["local"]})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["unknown_provider"] with input as {"decision": decision, "policy": policy_doc}
}

test_provider_mismatch_denied if {
	decision := object.union(valid_decision, {"provider": "external"})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["provider_mismatch"] with input as {"decision": decision, "policy": policy_doc}
}

test_model_mismatch_denied if {
	decision := object.union(valid_decision, {"model_id": "worker-fast"})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["model_mismatch"] with input as {"decision": decision, "policy": policy_doc}
}

test_missing_model_denied if {
	decision := object.remove(valid_decision, {"model_id"})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["model_mismatch"] with input as {"decision": decision, "policy": policy_doc}
}

test_malformed_model_denied if {
	decision := object.union(valid_decision, {"model_id": ["worker-main"]})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["model_mismatch"] with input as {"decision": decision, "policy": policy_doc}
}

test_old_wrapped_policy_denied if {
	wrapped := {"routing_prod": policy_doc}
	not routing.allow with input as {"decision": valid_decision, "policy": wrapped}
}

test_classification_mismatch_denied if {
	decision := object.union(valid_decision, {
		"classification": object.union(verified_internal, {"value": "public"}),
	})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["classification_mismatch"] with input as {"decision": decision, "policy": policy_doc}
}

test_selected_route_missing_tenant_denied if {
	route := object.union(object.remove(policy_doc.routes[0], {"match"}), {"match": {"data_classification": "internal"}})
	policy := object.union(policy_doc, {"routes": [route]})
	not routing.allow with input as {"decision": valid_decision, "policy": policy}
	routing.deny_reason["route_tenant_missing"] with input as {"decision": valid_decision, "policy": policy}
}

test_selected_route_malformed_tenant_denied if {
	route := object.union(policy_doc.routes[0], {"match": {"tenant": ["acme"], "data_classification": "internal"}})
	policy := object.union(policy_doc, {"routes": [route]})
	not routing.allow with input as {"decision": valid_decision, "policy": policy}
	routing.deny_reason["route_tenant_malformed"] with input as {"decision": valid_decision, "policy": policy}
}

test_selected_route_cross_tenant_denied if {
	route := object.union(policy_doc.routes[0], {"match": {"tenant": "other", "data_classification": "internal"}})
	policy := object.union(policy_doc, {"routes": [route]})
	not routing.allow with input as {"decision": valid_decision, "policy": policy}
	routing.deny_reason["route_tenant_mismatch"] with input as {"decision": valid_decision, "policy": policy}
}

test_split_route_witnesses_denied if {
	routes := [
		{
			"id": "route-1",
			"provider": "local",
			"model_id": "other-model",
			"match": {"tenant": "other", "data_classification": "public"},
		},
		{
			"id": "route-1",
			"provider": "external",
			"model_id": "worker-main",
			"match": {"tenant": "other", "data_classification": "public"},
		},
		{
			"id": "route-1",
			"provider": "external",
			"model_id": "other-model",
			"match": {"tenant": "other", "data_classification": "internal"},
		},
		{
			"id": "route-1",
			"provider": "external",
			"model_id": "other-model",
			"match": {"tenant": "acme", "data_classification": "public"},
		},
	]
	policy := object.union(policy_doc, {"routes": routes})
	not routing.allow with input as {"decision": valid_decision, "policy": policy}
	routing.deny_reason["route_tuple_mismatch"] with input as {"decision": valid_decision, "policy": policy}
}

test_confidential_external_requires_approval if {
	decision := object.union(valid_decision, {
		"route_id": "route-confidential",
		"provider": "external",
		"model_id": "worker-heavy",
		"classification": {
			"value": "confidential",
			"trust_proof": trust_proof,
		},
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
		"classification": {
			"value": "confidential",
			"trust_proof": trust_proof,
		},
	})
	routing.allow with input as {"decision": decision, "policy": policy_doc}
}

test_production_local_fallback_denied if {
	decision := object.union(valid_decision, {"execution": {"environment": "production", "fallback_mode": "local"}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["production_local_fallback_prohibited"] with input as {"decision": decision, "policy": policy_doc}
}

test_unknown_execution_environment_denied if {
	decision := object.union(valid_decision, {"execution": {"environment": "prod", "fallback_mode": "local"}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_execution_environment"] with input as {"decision": decision, "policy": policy_doc}
}

test_missing_execution_environment_denied if {
	decision := object.union(valid_decision, {"execution": {"fallback_mode": "local"}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_execution_environment"] with input as {"decision": decision, "policy": policy_doc}
}

test_malformed_execution_denied if {
	decision := object.union(valid_decision, {"execution": ["production"]})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_execution_environment"] with input as {"decision": decision, "policy": policy_doc}
}

test_malformed_execution_environment_denied if {
	decision := object.union(valid_decision, {"execution": {"environment": ["production"]}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_execution_environment"] with input as {"decision": decision, "policy": policy_doc}
}

test_unknown_fallback_mode_denied if {
	decision := object.union(valid_decision, {"execution": {"environment": "local_validation", "fallback_mode": "remote_magic"}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["unknown_fallback_mode"] with input as {"decision": decision, "policy": policy_doc}
}

test_malformed_fallback_mode_denied if {
	decision := object.union(valid_decision, {"execution": {"environment": "local_validation", "fallback_mode": ["local"]}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["unknown_fallback_mode"] with input as {"decision": decision, "policy": policy_doc}
}

test_production_deterministic_local_fallback_denied if {
	decision := object.union(valid_decision, {"execution": {"environment": "production", "fallback_mode": "deterministic_local"}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["production_local_fallback_prohibited"] with input as {"decision": decision, "policy": policy_doc}
}

test_production_local_gateway_denied if {
	decision := object.union(valid_decision, {"execution": {"environment": "production", "fallback_mode": "none"}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["production_local_gateway_unreachable"] with input as {"decision": decision, "policy": policy_doc}
}

test_exact_production_exhaustion_allowed_for_external_route if {
	decision := object.union(valid_decision, {
		"route_id": "route-confidential",
		"provider": "external",
		"model_id": "worker-heavy",
		"approval_ref": "approval-123",
		"classification": {"value": "confidential", "trust_proof": trust_proof},
		"execution": {
			"environment": "production",
			"provider_chain_exhausted": true,
			"result": {"ok": false, "reason": "llm_unavailable", "workflow_outcome": "typed_failure_no_summary"},
		},
	})
	routing.allow with input as {"decision": decision, "policy": policy_doc}
}

test_production_exhaustion_success_denied if {
	decision := object.union(valid_decision, {"execution": {
		"environment": "production",
		"provider_chain_exhausted": true,
		"result": {"ok": true, "reason": "llm_unavailable", "workflow_outcome": "typed_failure_no_summary"},
	}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_production_exhaustion"] with input as {"decision": decision, "policy": policy_doc}
}

test_production_result_with_false_exhaustion_denied if {
	decision := object.union(valid_decision, {"execution": {
		"environment": "production",
		"provider_chain_exhausted": false,
		"result": {"ok": true, "reason": "llm_unavailable", "workflow_outcome": "typed_failure_no_summary"},
	}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_production_exhaustion"] with input as {"decision": decision, "policy": policy_doc}
}

test_production_result_with_missing_exhaustion_denied if {
	decision := object.union(valid_decision, {"execution": {
		"environment": "production",
		"result": {"ok": false, "reason": "llm_unavailable", "workflow_outcome": "typed_failure_no_summary"},
	}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_production_exhaustion"] with input as {"decision": decision, "policy": policy_doc}
}

test_production_result_with_malformed_exhaustion_denied if {
	decision := object.union(valid_decision, {"execution": {
		"environment": "production",
		"provider_chain_exhausted": "true",
		"result": {"ok": false, "reason": "llm_unavailable", "workflow_outcome": "typed_failure_no_summary"},
	}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_production_exhaustion"] with input as {"decision": decision, "policy": policy_doc}
}

test_production_exhaustion_without_result_denied if {
	decision := object.union(valid_decision, {"execution": {
		"environment": "production",
		"provider_chain_exhausted": true,
	}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_production_exhaustion"] with input as {"decision": decision, "policy": policy_doc}
}

test_production_exhaustion_summary_denied if {
	decision := object.union(valid_decision, {"execution": {
		"environment": "production",
		"provider_chain_exhausted": true,
		"result": {"ok": false, "reason": "llm_unavailable", "workflow_outcome": "typed_failure_no_summary", "content": "synthetic summary"},
	}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["invalid_production_exhaustion"] with input as {"decision": decision, "policy": policy_doc}
}

test_unmarked_synthetic_denied if {
	decision := object.union(valid_decision, {"execution": {
		"environment": "local_validation",
		"synthetic_output": {},
	}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["synthetic_output_not_local_non_evidence"] with input as {"decision": decision, "policy": policy_doc}
}

test_synthetic_evidence_denied if {
	decision := object.union(valid_decision, {"execution": {
		"environment": "local_validation",
		"synthetic_output": {"evidence_status": "evidence", "scope": "local_validation_only"},
	}})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["synthetic_output_not_local_non_evidence"] with input as {"decision": decision, "policy": policy_doc}
}

test_explicit_local_validation_synthetic_non_evidence_allowed if {
	decision := object.union(valid_decision, {"execution": {
		"environment": "local_validation",
		"fallback_mode": "local",
		"synthetic_output": {"evidence_status": "explicitly_marked_non_evidence", "scope": "local_validation_only"},
	}})
	routing.allow with input as {"decision": decision, "policy": policy_doc}
}

test_local_validation_synthetic_still_requires_normal_route_tuple if {
	decision := object.union(valid_decision, {
		"model_id": "wrong-model",
		"execution": {
			"environment": "local_validation",
			"synthetic_output": {"evidence_status": "explicitly_marked_non_evidence", "scope": "local_validation_only"},
		},
	})
	not routing.allow with input as {"decision": decision, "policy": policy_doc}
	routing.deny_reason["model_mismatch"] with input as {"decision": decision, "policy": policy_doc}
}
