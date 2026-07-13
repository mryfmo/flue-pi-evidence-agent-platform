package eap.routing

import rego.v1

default allow := false

classification_values := {"public", "internal", "confidential", "restricted"}

execution_environments := {"production", "local_validation"}

fallback_modes := {"none", "local", "deterministic_local"}

local_fallback_modes := {"local", "deterministic_local"}

required_trust_proof := {
	"producer": "flue-pi-data-guard",
	"verified_by": "flue-pi-platform-gateway",
	"evidence_kind": "presidio-sqlglot-redaction-v1",
}

provider_type := input.policy.providers[input.decision.provider].type

known_route if {
	route := input.policy.routes[_]
	route.id == input.decision.route_id
}

known_provider if {
	input.policy.providers[input.decision.provider].type
}

classification_value := input.decision.classification.value

trusted_classification if {
	classification := input.policy.classification
	proof := input.decision.classification.trust_proof
	proof == required_trust_proof
	classification.producer == required_trust_proof.producer
	classification.verified_by == required_trust_proof.verified_by
	classification.evidence_kind == required_trust_proof.evidence_kind
}

known_classification if {
	value := classification_value
	is_string(value)
	classification_values[value]
}

catalog_classification_match if input.policy.classification.enum[_] == classification_value

route_provider_match if {
	route := input.policy.routes[_]
	route.id == input.decision.route_id
	route.provider == input.decision.provider
}

route_model_match if {
	route := input.policy.routes[_]
	route.id == input.decision.route_id
	route.model_id == input.decision.model_id
}

route_classification_match if {
	route := input.policy.routes[_]
	route.id == input.decision.route_id
	route.match.data_classification == classification_value
}

route_tenant_match if {
	route := input.policy.routes[_]
	route.id == input.decision.route_id
	route.match.tenant == input.decision.tenant
}

selected_route_without_tenant contains route if {
	route := input.policy.routes[_]
	route.id == input.decision.route_id
	route.provider == input.decision.provider
	route.model_id == input.decision.model_id
	route.match.data_classification == classification_value
}

selected_route if {
	route := selected_route_without_tenant[_]
	route.match.tenant == input.decision.tenant
}

external_provider if {
	known_provider
	provider_type != "local_gateway"
}

execution_present if object.keys(input.decision)["execution"]

valid_execution_environment if {
	execution := input.decision.execution
	is_object(execution)
	environment := execution.environment
	is_string(environment)
	execution_environments[environment]
}

fallback_mode_present if object.keys(input.decision.execution)["fallback_mode"]

valid_fallback_mode if not fallback_mode_present

valid_fallback_mode if {
	mode := input.decision.execution.fallback_mode
	is_string(mode)
	fallback_modes[mode]
}

production_execution if {
	valid_execution_environment
	input.decision.execution.environment == "production"
}

production_outcome_state_present if object.keys(input.decision.execution)["provider_chain_exhausted"]

production_outcome_state_present if object.keys(input.decision.execution)["result"]

synthetic_output if input.decision.execution.synthetic_output

valid_production_exhaustion if {
	input.decision.execution.provider_chain_exhausted == true
	result := input.decision.execution.result
	result.ok == false
	result.reason == "llm_unavailable"
	result.workflow_outcome == "typed_failure_no_summary"
	object.keys(result) == {"ok", "reason", "workflow_outcome"}
}

valid_local_synthetic if {
	input.decision.execution.environment == "local_validation"
	input.decision.execution.synthetic_output.evidence_status == "explicitly_marked_non_evidence"
	input.decision.execution.synthetic_output.scope == "local_validation_only"
	object.keys(input.decision.execution.synthetic_output) == {"evidence_status", "scope"}
}

allowed_tenant if {
	data.eap.tenants.allowed[_] == input.decision.tenant
}

deny_reason contains "tenant_mismatch" if not allowed_tenant
deny_reason contains "unknown_route" if not known_route
deny_reason contains "unknown_provider" if not known_provider
deny_reason contains "missing_classification" if {
	not classification_value
}

deny_reason contains "malformed_classification" if {
	value := classification_value
	not is_string(value)
}

deny_reason contains "unknown_classification" if {
	value := classification_value
	is_string(value)
	not classification_values[value]
}

deny_reason contains "catalog_classification_mismatch" if {
	known_classification
	not catalog_classification_match
}

deny_reason contains "untrusted_classification" if {
	not trusted_classification
}

deny_reason contains "provider_mismatch" if {
	known_route
	not route_provider_match
}

deny_reason contains "model_mismatch" if {
	known_route
	not route_model_match
}

deny_reason contains "classification_mismatch" if {
	known_route
	known_classification
	not route_classification_match
}

deny_reason contains "route_tenant_missing" if {
	route := selected_route_without_tenant[_]
	not object.keys(route.match)["tenant"]
}

deny_reason contains "route_tenant_malformed" if {
	route := selected_route_without_tenant[_]
	tenant := route.match.tenant
	not is_string(tenant)
}

deny_reason contains "route_tenant_mismatch" if {
	route := selected_route_without_tenant[_]
	tenant := route.match.tenant
	is_string(tenant)
	tenant != input.decision.tenant
}

deny_reason contains "route_tuple_mismatch" if {
	known_route
	known_classification
	route_provider_match
	route_model_match
	route_classification_match
	route_tenant_match
	not selected_route
}

deny_reason contains "restricted_external_provider" if {
	classification_value == "restricted"
	external_provider
}

deny_reason contains "confidential_requires_approval" if {
	classification_value == "confidential"
	external_provider
	not input.decision.approval_ref
}

deny_reason contains "invalid_execution_environment" if {
	execution_present
	not valid_execution_environment
}

deny_reason contains "unknown_fallback_mode" if {
	execution_present
	not valid_fallback_mode
}

deny_reason contains "production_local_fallback_prohibited" if {
	production_execution
	local_fallback_modes[input.decision.execution.fallback_mode]
}

deny_reason contains "production_local_gateway_unreachable" if {
	production_execution
	provider_type == "local_gateway"
}

deny_reason contains "invalid_production_exhaustion" if {
	production_execution
	production_outcome_state_present
	not valid_production_exhaustion
}

deny_reason contains "synthetic_output_not_local_non_evidence" if {
	synthetic_output
	not valid_local_synthetic
}

allow if {
	allowed_tenant
	known_route
	known_provider
	trusted_classification
	known_classification
	catalog_classification_match
	selected_route
	count(deny_reason) == 0
}
