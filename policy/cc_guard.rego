package eap.cc_guard

import rego.v1

default allow := false

controlled_path(p) if {
	startswith(p, "policy/")
}

controlled_path(p) if {
	startswith(p, "artifacts/audit/")
}

controlled_path(p) if {
	regex.match(`^\.env($|\.)`, p)
}

lease_matches(path, lease) if {
	path == lease
}

lease_matches(path, lease) if {
	startswith(path, sprintf("%s/", [lease]))
}

lease_matches(path, lease) if {
	startswith(lease, sprintf("%s/", [path]))
}

deny_reason contains sprintf("controlled_path:%s", [p]) if {
	p := input.paths[_]
	controlled_path(p)
}

deny_reason contains sprintf("active_lease:%s", [p]) if {
	p := input.paths[_]
	lease := input.active_leases[_]
	lease_matches(p, lease)
}

deny_reason contains "release_branch_operation" if {
	regex.match(`(?i)\bgit\s+(checkout|switch|push|merge|rebase)\b.*\brelease\b`, input.command)
}

allow if {
	count(deny_reason) == 0
}
