package eap.conformance

import rego.v1

default satisfied := false

expected_tests := {
	"REQ-PI-001": {"pi_behavior", "pi_negative", "pi_fail_closed"},
	"REQ-DATA-001": {"data_behavior", "data_negative", "data_fail_closed"},
}

expected_pairs := {
	"REQ-PI-001:pi_behavior",
	"REQ-PI-001:pi_negative",
	"REQ-PI-001:pi_fail_closed",
	"REQ-DATA-001:data_behavior",
	"REQ-DATA-001:data_negative",
	"REQ-DATA-001:data_fail_closed",
}

expected_superseded := {
	{"requirement_id": "REQ-PI-001", "path": "docs/SPECIFICATION.md", "locator": "deterministic local gateway as normative mechanism", "disposition": "superseded_non_normative"},
	{"requirement_id": "REQ-DATA-001", "path": "docs/SPECIFICATION.md", "locator": "SQLGlot, DuckDB, and Presidio as normative tool identities", "disposition": "superseded_non_normative"},
}

trust := data.eap.conformance_trust

exact_keys(value, keys) if {
	is_object(value)
	object.keys(value) == keys
}

valid_digest(value) if {
	is_string(value)
	regex.match("^sha256:[0-9a-f]{64}$", value)
}

valid_source if {
	exact_keys(input.source, {"revision", "digest"})
	is_string(input.source.revision)
	regex.match("^[0-9a-f]{40,64}$", input.source.revision)
	valid_digest(input.source.digest)
}

valid_requirement(requirement) if {
	exact_keys(requirement, {"id", "abstraction", "capability_test_ids"})
	requirement.id in {"REQ-PI-001", "REQ-DATA-001"}
	requirement.abstraction == "capability_level"
	is_array(requirement.capability_test_ids)
	count(requirement.capability_test_ids) == 3
	{test_id | some test_id in requirement.capability_test_ids} == expected_tests[requirement.id]
}

valid_catalog_entry(entry) if {
	exact_keys(entry, {"requirement_id", "test_id", "path", "digest"})
	entry.requirement_id in {"REQ-PI-001", "REQ-DATA-001"}
	entry.test_id in expected_tests[entry.requirement_id]
	is_string(entry.path)
	entry.path != ""
	valid_digest(entry.digest)
}

valid_catalog if {
	is_array(trust.expected.artifacts)
	count(trust.expected.artifacts) == 6
	every entry in trust.expected.artifacts { valid_catalog_entry(entry) }
	{sprintf("%s:%s", [entry.requirement_id, entry.test_id]) | some entry in trust.expected.artifacts} == expected_pairs
	count({entry.path | some entry in trust.expected.artifacts}) == 6
	count({entry.digest | some entry in trust.expected.artifacts}) == 6
}

valid_trust(environment, usage) if {
	exact_keys(trust, {"contract_version", "status", "environment", "producer", "verifier", "audience", "active_key", "expected"})
	trust.contract_version == "spec20-conformance-trust-v1"
	trust.status == "active"
	trust.environment == environment
	is_string(trust.producer)
	is_string(trust.verifier)
	is_string(trust.audience)
	exact_keys(trust.active_key, {"id", "algorithm", "public_key_pem", "status", "usage", "not_before", "expires_at"})
	trust.active_key.status == "active"
	trust.active_key.usage == usage
	trust.active_key.algorithm == "RS256"
	is_string(trust.active_key.public_key_pem)
	startswith(trust.active_key.public_key_pem, "-----BEGIN PUBLIC KEY-----")
	exact_keys(trust.expected, {"source_revision", "source_digest", "run_id", "not_before", "not_after", "artifacts"})
	valid_digest(trust.expected.source_digest)
	is_string(trust.expected.run_id)
	valid_catalog
	now := time.now_ns()
	now >= time.parse_rfc3339_ns(trust.active_key.not_before)
	now < time.parse_rfc3339_ns(trust.active_key.expires_at)
	now >= time.parse_rfc3339_ns(trust.expected.not_before)
	now < time.parse_rfc3339_ns(trust.expected.not_after)
}

valid_verification_context if {
	exact_keys(input.verification_context, {"owner", "origin", "caller_supplied", "environment", "verifier", "status", "run_id", "source_revision", "source_digest", "attestation_digests", "attestation_bundle_digest"})
	input.verification_context.owner == "gateway:policy-enforcement-point"
	input.verification_context.origin == "trusted_verifier"
	input.verification_context.caller_supplied == false
	input.verification_context.environment == trust.environment
	input.verification_context.verifier == trust.verifier
	input.verification_context.status == "verified"
	is_string(input.verification_context.run_id)
	regex.match("^run-[a-z0-9][a-z0-9._-]{7,127}$", input.verification_context.run_id)
	input.verification_context.source_revision == input.source.revision
	input.verification_context.source_digest == input.source.digest
	input.verification_context.run_id == trust.expected.run_id
	input.verification_context.source_revision == trust.expected.source_revision
	input.verification_context.source_digest == trust.expected.source_digest
	is_array(input.verification_context.attestation_digests)
	valid_digest(input.verification_context.attestation_bundle_digest)
}

valid_artifact(result, artifact) if {
	exact_keys(artifact, {"path", "uri", "digest", "media_type"})
	matches := [entry | some entry in trust.expected.artifacts
		entry.requirement_id == result.requirement_id
		entry.test_id == result.test_id]
	count(matches) == 1
	artifact.path == matches[0].path
	artifact.digest == matches[0].digest
	valid_digest(artifact.digest)
	artifact.uri == sprintf("cas://sha256/%s", [trim_prefix(artifact.digest, "sha256:")])
	artifact.media_type == "application/vnd.eap.capability-test-result+json"
}

valid_attestation(result, execution) if {
	attestation := execution.attestation
	exact_keys(attestation, {"digest", "signed_jwt", "key_id", "algorithm", "issuer", "audience", "status", "subject_digest", "producer", "verifier", "run_id", "requirement_id", "test_id", "outcome", "source_revision", "source_digest", "synthetic", "self_attested"})
	valid_digest(attestation.digest)
	is_string(attestation.signed_jwt)
	attestation.digest == sprintf("sha256:%s", [crypto.sha256(attestation.signed_jwt)])
	attestation.key_id == trust.active_key.id
	attestation.algorithm == trust.active_key.algorithm
	attestation.issuer == trust.producer
	attestation.audience == trust.audience
	attestation.status == "verified"
	attestation.subject_digest == execution.artifact.digest
	attestation.producer == execution.producer
	attestation.verifier == execution.verifier
	attestation.run_id == execution.run_id
	attestation.requirement_id == result.requirement_id
	attestation.test_id == result.test_id
	attestation.outcome == result.outcome
	attestation.source_revision == result.source_revision
	attestation.source_digest == result.source_digest
	attestation.synthetic == false
	attestation.self_attested == false
	result.evidence_digest == attestation.digest

	decoded := io.jwt.decode_verify(attestation.signed_jwt, {
		"cert": trust.active_key.public_key_pem,
		"alg": trust.active_key.algorithm,
		"iss": trust.producer,
		"aud": trust.audience,
	})
	decoded[0] == true
	header := decoded[1]
	payload := decoded[2]
	header == {"alg": trust.active_key.algorithm, "kid": trust.active_key.id, "typ": "JWT"}
	payload == {
		"iss": attestation.issuer,
		"aud": attestation.audience,
		"status": attestation.status,
		"subject_digest": attestation.subject_digest,
		"artifact_digest": execution.artifact.digest,
		"artifact_path": execution.artifact.path,
		"producer": attestation.producer,
		"verifier": attestation.verifier,
		"run_id": attestation.run_id,
		"requirement_id": attestation.requirement_id,
		"test_id": attestation.test_id,
		"outcome": attestation.outcome,
		"source_revision": attestation.source_revision,
		"source_digest": attestation.source_digest,
		"synthetic": attestation.synthetic,
		"self_attested": attestation.self_attested,
	}
}

valid_bundle if {
	digests := sort([result.execution.attestation.digest | some result in input.results])
	input.verification_context.attestation_digests == digests
	input.verification_context.attestation_bundle_digest == sprintf("sha256:%s", [crypto.sha256(sprintf("%s|%s|%s|%s", [
		input.verification_context.run_id,
		input.verification_context.source_revision,
		input.verification_context.source_digest,
		concat("|", digests),
	]))])
}

valid_execution(result) if {
	execution := result.execution
	exact_keys(execution, {"kind", "producer", "verifier", "run_id", "artifact", "attestation"})
	execution.kind == "machine_capability_test"
	execution.producer == trust.producer
	execution.verifier == trust.verifier
	execution.run_id == input.verification_context.run_id
	valid_artifact(result, execution.artifact)
	valid_attestation(result, execution)
}

valid_result(result) if {
	exact_keys(result, {"requirement_id", "test_id", "outcome", "source_revision", "source_digest", "evidence_digest", "execution"})
	result.requirement_id in {"REQ-PI-001", "REQ-DATA-001"}
	result.test_id in expected_tests[result.requirement_id]
	result.outcome == "passed"
	result.source_revision == input.source.revision
	result.source_digest == input.source.digest
	valid_execution(result)
}

valid_shape(environment, usage) if {
	exact_keys(input, {"contract_version", "spec_id", "decision", "source", "verification_context", "requirements", "results", "superseded_clauses"})
	input.contract_version == "spec20-conformance-v1"
	input.spec_id == "SPEC-20"
	input.decision == {
		"requirement_abstraction": "capability_level",
		"conformance_evidence": "machine_verifiable_capability_tests",
		"tool_inventory_disposition": "non_normative_design_record",
	}
	valid_source
	valid_trust(environment, usage)
	valid_verification_context

	is_array(input.requirements)
	count(input.requirements) == 2
	{requirement.id | some requirement in input.requirements} == {"REQ-PI-001", "REQ-DATA-001"}
	every requirement in input.requirements { valid_requirement(requirement) }

	is_array(input.results)
	count(input.results) == 6
	{sprintf("%s:%s", [result.requirement_id, result.test_id]) | some result in input.results} == expected_pairs
	every result in input.results { valid_result(result) }
	count({result.execution.artifact.digest | some result in input.results}) == 6
	count({result.execution.attestation.digest | some result in input.results}) == 6
	valid_bundle

	is_array(input.superseded_clauses)
	count(input.superseded_clauses) == 2
	{clause | some clause in input.superseded_clauses} == expected_superseded
}

satisfied if valid_shape("production", "production")

satisfied_test_vector if valid_shape("test", "test_only")
