package eap.cc_guard

import rego.v1

test_deny_controlled_policy_path if {
	reasons := deny_reason with input as {"paths": ["policy/routing.json"], "active_leases": [], "command": ""}
	reasons["controlled_path:policy/routing.json"]
}

test_deny_active_lease_path if {
	reasons := deny_reason with input as {"paths": ["docs/owned.md"], "active_leases": ["docs/owned.md"], "command": ""}
	reasons["active_lease:docs/owned.md"]
}

test_allow_normal_path if {
	allow with input as {"paths": ["README.md"], "active_leases": [], "command": ""}
}

test_deny_release_branch_operation if {
	reasons := deny_reason with input as {"paths": [], "active_leases": [], "command": "git switch release/v1"}
	reasons["release_branch_operation"]
}
