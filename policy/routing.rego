package eap.routing

import rego.v1

default allow := false

provider_type := input.policy.providers[input.decision.provider].type

known_route if {
	input.decision.route_id == "default"
}

known_route if {
	route := input.policy.routes[_]
	route.id == input.decision.route_id
}

external_provider if {
	provider_type != "local_gateway"
}

allowed_tenant if {
	data.eap.tenants.allowed[_] == input.decision.tenant
}

deny_reason contains "tenant_mismatch" if not allowed_tenant
deny_reason contains "unknown_route" if not known_route
deny_reason contains "unknown_provider" if {
	not input.policy.providers[input.decision.provider]
}

deny_reason contains "restricted_external_provider" if {
	input.decision.data_classification == "restricted"
	external_provider
}

deny_reason contains "confidential_requires_approval" if {
	input.decision.data_classification == "confidential"
	external_provider
	not input.decision.approval_ref
}

allow if {
	allowed_tenant
	known_route
	input.policy.providers[input.decision.provider]
	not deny_reason.restricted_external_provider
	not deny_reason.confidential_requires_approval
}
