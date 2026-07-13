package eap.closure_test

import data.eap.closure
import rego.v1

defect_removal := {"issue_id": "ISSUE-1", "proof_id": "proof-1", "passed": true}
regression := {"id": "reg-1", "issue_id": "ISSUE-1", "passed": true}
rescan := {"issue_id": "ISSUE-1", "clean": true, "finding_issue_ids": []}
evidence := {"hypothesis_id": "hyp-1", "issue_id": "ISSUE-1", "passed": true}
hypothesis := {"id": "hyp-1", "issue_id": "ISSUE-1", "patchable": true, "verified": true, "evidence": evidence, "candidate_ids": ["cand-1", "cand-2"]}
impact := {"issue_id": "ISSUE-1", "required_evidence_ids": ["impact-1"], "evidence": [{"id": "impact-1", "issue_id": "ISSUE-1", "passed": true}]}

valid_input := {
	"contract_version": "remediation-closure-v1",
	"issue_id": "ISSUE-1",
	"defect_removal": defect_removal,
	"required_regression_check_ids": ["reg-1"],
	"regression_checks": [regression],
	"rescan": rescan,
	"hypotheses": [hypothesis],
	"impact": impact,
}

test_complete_record_closes if {
	closure.closed with input as valid_input
	closure.remediation_success with input as valid_input
}

test_clean_without_issue_proof_stays_open if {
	not closure.closed with input as object.remove(valid_input, {"defect_removal"})
}

test_other_issue_evidence_stays_open if {
	other_issue := object.union(defect_removal, {"issue_id": "ISSUE-2"})
	not closure.closed with input as object.union(valid_input, {"defect_removal": other_issue})
}

test_missing_regression_stays_open if {
	not closure.closed with input as object.union(valid_input, {"required_regression_check_ids": ["reg-1", "reg-2"]})
}

test_failed_regression_stays_open if {
	failed := object.union(regression, {"passed": false})
	not closure.closed with input as object.union(valid_input, {"regression_checks": [failed]})
}

test_contradictory_duplicate_regression_id_fails_closed if {
	failed := object.union(regression, {"passed": false})
	not closure.closed with input as object.union(valid_input, {"regression_checks": [regression, failed]})
}

test_extra_failed_regression_stays_open if {
	extra := {"id": "reg-extra", "issue_id": "ISSUE-1", "passed": false}
	not closure.closed with input as object.union(valid_input, {"regression_checks": [regression, extra]})
}

test_extra_passed_regression_stays_open if {
	extra := {"id": "reg-extra", "issue_id": "ISSUE-1", "passed": true}
	not closure.closed with input as object.union(valid_input, {"regression_checks": [regression, extra]})
}

test_remaining_rescan_finding_stays_open if {
	remaining := object.union(rescan, {"clean": false, "finding_issue_ids": ["ISSUE-1"]})
	not closure.closed with input as object.union(valid_input, {"rescan": remaining})
}

test_missing_impact_stays_open if {
	not closure.closed with input as object.remove(valid_input, {"impact"})
}

test_failed_impact_stays_open if {
	failed := object.union(impact, {"evidence": [{"id": "impact-1", "issue_id": "ISSUE-1", "passed": false}]})
	not closure.closed with input as object.union(valid_input, {"impact": failed})
}

test_contradictory_duplicate_impact_id_fails_closed if {
	failed := object.union(impact.evidence[0], {"passed": false})
	duplicate := object.union(impact, {"evidence": [impact.evidence[0], failed]})
	not closure.closed with input as object.union(valid_input, {"impact": duplicate})
}

test_extra_failed_impact_stays_open if {
	extra := {"id": "impact-extra", "issue_id": "ISSUE-1", "passed": false}
	with_extra := object.union(impact, {"evidence": array.concat(impact.evidence, [extra])})
	not closure.closed with input as object.union(valid_input, {"impact": with_extra})
}

test_extra_passed_impact_stays_open if {
	extra := {"id": "impact-extra", "issue_id": "ISSUE-1", "passed": true}
	with_extra := object.union(impact, {"evidence": array.concat(impact.evidence, [extra])})
	not closure.closed with input as object.union(valid_input, {"impact": with_extra})
}

test_one_candidate_stays_open if {
	one := object.union(hypothesis, {"candidate_ids": ["cand-1"]})
	not closure.closed with input as object.union(valid_input, {"hypotheses": [one]})
}

test_duplicate_candidates_stay_open if {
	duplicate := object.union(hypothesis, {"candidate_ids": ["cand-1", "cand-1"]})
	not closure.closed with input as object.union(valid_input, {"hypotheses": [duplicate]})
}

test_candidates_are_not_counted_across_hypotheses if {
	first := object.union(hypothesis, {"candidate_ids": ["cand-1"]})
	second_evidence := object.union(evidence, {"hypothesis_id": "hyp-2"})
	second := object.union(hypothesis, {"id": "hyp-2", "evidence": second_evidence, "candidate_ids": ["cand-2"]})
	not closure.closed with input as object.union(valid_input, {"hypotheses": [first, second]})
}

test_unverified_hypothesis_stays_open if {
	unverified := object.union(hypothesis, {"verified": false})
	not closure.closed with input as object.union(valid_input, {"hypotheses": [unverified]})
}

test_missing_hypothesis_evidence_stays_open if {
	missing := object.remove(hypothesis, {"evidence"})
	not closure.closed with input as object.union(valid_input, {"hypotheses": [missing]})
}

test_duplicate_hypothesis_id_fails_closed if {
	not closure.closed with input as object.union(valid_input, {"hypotheses": [hypothesis, hypothesis]})
}

test_missing_field_fails_closed if {
	not closure.closed with input as object.remove(valid_input, {"required_regression_check_ids"})
}

test_unknown_field_fails_closed if {
	not closure.closed with input as object.union(valid_input, {"unexpected": "caller-controlled"})
}

test_wrong_type_fails_closed if {
	not closure.closed with input as object.union(valid_input, {"issue_id": ["ISSUE-1"]})
}
