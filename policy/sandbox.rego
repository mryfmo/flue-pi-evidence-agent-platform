package eap.sandbox

default allow = false
default requires_approval = false

allowlisted_egress_policy["__none__"] { false }
allowlisted_env_key["__none__"] { false }

deny_reason["tenant_mismatch"] {
  input.tenant != "acme"
}

deny_reason["egress_not_denied"] {
  input.egress != "deny"
  not allowlisted_egress_policy[input.policy_id]
}

deny_reason["env_key_not_allowed"] {
  key := input.env_keys[_]
  not allowlisted_env_key[key]
}

allow {
  input.tenant == "acme"
  input.egress == "deny"
  not deny_reason["env_key_not_allowed"]
}
