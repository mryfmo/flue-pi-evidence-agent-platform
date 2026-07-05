package eap.routing

default allow = false
default requires_approval = false

provider_type := input.policy.providers[input.decision.provider].type

known_route {
  input.decision.route_id == "default"
}

known_route {
  route := input.policy.routes[_]
  route.id == input.decision.route_id
}

external_provider {
  provider_type != "local_gateway"
}

deny_reason["tenant_mismatch"] { input.decision.tenant != "acme" }
deny_reason["unknown_route"] { not known_route }
deny_reason["unknown_provider"] { not input.policy.providers[input.decision.provider] }
deny_reason["restricted_external_provider"] {
  input.decision.data_classification == "restricted"
  external_provider
}

allow {
  input.decision.tenant == "acme"
  known_route
  input.policy.providers[input.decision.provider]
  not deny_reason["restricted_external_provider"]
}
