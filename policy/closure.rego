package eap.closure

import rego.v1

# schema: schemas/remediation-closure.schema.json
# contract-digest: sha256:b54388e5bf8f17ef14ca4a5facf4103c48502ae52be35f70142a9d2cf9391b00

default remediation_success := false
default closed := false

nonempty_string(value) if {
	is_string(value)
	value != ""
}

exact_keys(value, keys) if {
	is_object(value)
	object.keys(value) == keys
}

valid_result(result, issue_id) if {
	exact_keys(result, {"id", "issue_id", "passed"})
	nonempty_string(result.id)
	result.issue_id == issue_id
	is_boolean(result.passed)
}

valid_shape if {
	exact_keys(input, {"contract_version", "issue_id", "defect_removal", "required_regression_check_ids", "regression_checks", "rescan", "hypotheses", "impact"})
	input.contract_version == "remediation-closure-v1"
	nonempty_string(input.issue_id)

	exact_keys(input.defect_removal, {"issue_id", "proof_id", "passed"})
	nonempty_string(input.defect_removal.proof_id)
	is_boolean(input.defect_removal.passed)

	is_array(input.required_regression_check_ids)
	count(input.required_regression_check_ids) > 0
	count({id | some id in input.required_regression_check_ids}) == count(input.required_regression_check_ids)
	every id in input.required_regression_check_ids { nonempty_string(id) }
	is_array(input.regression_checks)
	count(input.regression_checks) > 0
	count({result.id | some result in input.regression_checks}) == count(input.regression_checks)
	every result in input.regression_checks { valid_result(result, input.issue_id) }

	exact_keys(input.rescan, {"issue_id", "clean", "finding_issue_ids"})
	is_boolean(input.rescan.clean)
	is_array(input.rescan.finding_issue_ids)
	every finding_issue_id in input.rescan.finding_issue_ids { nonempty_string(finding_issue_id) }

	is_array(input.hypotheses)
	count(input.hypotheses) > 0
	count({hypothesis.id | some hypothesis in input.hypotheses}) == count(input.hypotheses)
	every hypothesis in input.hypotheses {
		exact_keys(hypothesis, {"id", "issue_id", "patchable", "verified", "evidence", "candidate_ids"})
		nonempty_string(hypothesis.id)
		hypothesis.issue_id == input.issue_id
		is_boolean(hypothesis.patchable)
		is_boolean(hypothesis.verified)
		exact_keys(hypothesis.evidence, {"hypothesis_id", "issue_id", "passed"})
		hypothesis.evidence.hypothesis_id == hypothesis.id
		hypothesis.evidence.issue_id == input.issue_id
		is_boolean(hypothesis.evidence.passed)
		is_array(hypothesis.candidate_ids)
		every candidate_id in hypothesis.candidate_ids { nonempty_string(candidate_id) }
	}

	exact_keys(input.impact, {"issue_id", "required_evidence_ids", "evidence"})
	is_array(input.impact.required_evidence_ids)
	count(input.impact.required_evidence_ids) > 0
	count({id | some id in input.impact.required_evidence_ids}) == count(input.impact.required_evidence_ids)
	every id in input.impact.required_evidence_ids { nonempty_string(id) }
	is_array(input.impact.evidence)
	count(input.impact.evidence) > 0
	count({result.id | some result in input.impact.evidence}) == count(input.impact.evidence)
	every result in input.impact.evidence { valid_result(result, input.issue_id) }
}

defect_removed if {
	input.defect_removal.issue_id == input.issue_id
	input.defect_removal.passed == true
}

regressions_passed if {
	{id | some id in input.required_regression_check_ids} == {result.id | some result in input.regression_checks}
	every result in input.regression_checks { result.passed == true }
}

rescan_clean if {
	input.rescan.issue_id == input.issue_id
	input.rescan.clean == true
	not input.issue_id in input.rescan.finding_issue_ids
}

hypotheses_verified if {
	every hypothesis in input.hypotheses {
		hypothesis.verified == true
		hypothesis.evidence.passed == true
	}
}

candidate_sufficient(hypothesis) if not hypothesis.patchable

candidate_sufficient(hypothesis) if {
	hypothesis.patchable
	candidate_ids := {candidate_id | some candidate_id in hypothesis.candidate_ids}
	count(candidate_ids) >= 2
}

patchable_hypotheses_have_candidates if {
	every hypothesis in input.hypotheses { candidate_sufficient(hypothesis) }
}

impact_passed if {
	input.impact.issue_id == input.issue_id
	{id | some id in input.impact.required_evidence_ids} == {result.id | some result in input.impact.evidence}
	every result in input.impact.evidence { result.passed == true }
}

remediation_success if {
	valid_shape
	defect_removed
	regressions_passed
	rescan_clean
	hypotheses_verified
	patchable_hypotheses_have_candidates
	impact_passed
}

closed if remediation_success
