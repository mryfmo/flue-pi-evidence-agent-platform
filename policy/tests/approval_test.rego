package eap.approval_test

import data.eap.approval
import rego.v1

digest_a := "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"

digest_b := "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"

digest_c := "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

digest_d := "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"

digest_e := "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"

reviewer := {
	"subject_id": "reviewer-1",
	"principal_type": "authenticated",
	"tenant_memberships": ["acme"],
	"roles": ["security_reviewer"],
	"issuer": "flue-pi-identity-authority",
	"audience": "flue-pi-agent-policy",
	"verification": {"status": "verified", "owner": "flue-pi-platform-gateway"},
	"request_binding": {"id": "req-1"},
}

requester := object.union(reviewer, {"subject_id": "requester-1", "roles": ["software_engineer"]})

approved_record := {
	"schema_version": "1.0",
	"approval_id": "approval-1",
	"tenant_id": "acme",
	"task_id": "task-1",
	"run_id": "run-1",
	"source": {"revision": "rev-1", "digest": digest_a},
	"evidence_digest": digest_b,
	"action": "apply_patch",
	"requester_identity": requester,
	"created_at": "2026-07-13T10:00:00Z",
	"expires_at": "2026-07-14T10:00:00Z",
	"state": "approved",
	"decision": {
		"outcome": "approved",
		"decided_at": "2026-07-13T11:00:00Z",
		"idempotency_key": "approve-key",
		"request_digest": digest_c,
		"approver_identity": reviewer,
	},
	"resume": {"status": "not_resumed"},
}

pending_record := object.union(approved_record, {"state": "pending", "decision": null})

valid_input := {
	"operation": "resume",
	"now": "2026-07-13T12:00:00Z",
	"identity_context": reviewer,
	"request_context": {"tenant": "acme", "binding_id": "req-1"},
	"record_context": {"persisted": true, "immutable": true, "integrity_verified": true},
	"approval": approved_record,
	"current": {
		"tenant_id": "acme",
		"task_id": "task-1",
		"run_id": "run-1",
		"source": {"revision": "rev-1", "digest": digest_a},
		"evidence_digest": digest_b,
		"action": "apply_patch",
	},
	"idempotency": {"key": "resume-key", "request_digest": digest_d},
}

test_pending_to_approved if approval.allow_approve with input as object.union(valid_input, {"operation": "approve", "approval": pending_record, "idempotency": {"key": "approve-key", "request_digest": digest_c}})

test_pending_to_rejected if approval.allow_reject with input as object.union(valid_input, {"operation": "reject", "approval": pending_record, "idempotency": {"key": "reject-key", "request_digest": digest_c}})

test_pending_to_expired if approval.allow_expire with input as object.union(valid_input, {"operation": "expire", "now": "2026-07-15T12:00:00Z", "approval": pending_record})

test_approved_to_resumed if approval.allow_resume with input as valid_input

test_anonymous_denied if {
	identity := object.union(reviewer, {"principal_type": "anonymous"})
	candidate := object.union(valid_input, {"identity_context": identity})
	not approval.allow_resume with input as candidate
	approval.deny_reason.anonymous_or_unverified_actor with input as candidate
}

test_wrong_issuer_denied if {
	identity := object.union(reviewer, {"issuer": "caller"})
	candidate := object.union(valid_input, {"identity_context": identity})
	not approval.allow_resume with input as candidate
	approval.deny_reason.anonymous_or_unverified_actor with input as candidate
}

test_wrong_audience_denied if {
	identity := object.union(reviewer, {"audience": "caller"})
	candidate := object.union(valid_input, {"identity_context": identity})
	not approval.allow_resume with input as candidate
	approval.deny_reason.anonymous_or_unverified_actor with input as candidate
}

test_unknown_role_denied if {
	identity := object.union(reviewer, {"roles": ["admin"]})
	candidate := object.union(valid_input, {"identity_context": identity})
	not approval.allow_resume with input as candidate
	approval.deny_reason.unknown_role with input as candidate
}

test_insufficient_role_denied if {
	identity := object.union(reviewer, {"roles": ["software_engineer"]})
	candidate := object.union(valid_input, {"identity_context": identity})
	not approval.allow_resume with input as candidate
	approval.deny_reason.insufficient_role with input as candidate
}

test_foreign_tenant_denied if {
	identity := object.union(reviewer, {"tenant_memberships": ["other"]})
	candidate := object.union(valid_input, {"identity_context": identity})
	not approval.allow_resume with input as candidate
	approval.deny_reason.foreign_tenant with input as candidate
}

test_unpersisted_denied if {
	candidate := object.union(valid_input, {"record_context": {"persisted": false, "immutable": true, "integrity_verified": true}})
	not approval.allow_resume with input as candidate
	approval.deny_reason.approval_not_persisted with input as candidate
}

test_expired_denied if {
	candidate := object.union(valid_input, {"now": "2026-07-15T12:00:00Z"})
	not approval.allow_resume with input as candidate
	approval.deny_reason.expired with input as candidate
}

test_stale_source_revision_denied if {
	current := object.union(valid_input.current, {"source": {"revision": "rev-2", "digest": digest_a}})
	candidate := object.union(valid_input, {"current": current})
	not approval.allow_resume with input as candidate
	approval.deny_reason.source_revision_mismatch with input as candidate
}

test_stale_source_digest_denied if {
	current := object.union(valid_input.current, {"source": {"revision": "rev-1", "digest": digest_e}})
	candidate := object.union(valid_input, {"current": current})
	not approval.allow_resume with input as candidate
	approval.deny_reason.source_digest_mismatch with input as candidate
}

test_changed_evidence_denied if {
	current := object.union(valid_input.current, {"evidence_digest": digest_e})
	candidate := object.union(valid_input, {"current": current})
	not approval.allow_resume with input as candidate
	approval.deny_reason.evidence_digest_mismatch with input as candidate
}

test_action_mismatch_denied if {
	current := object.union(valid_input.current, {"action": "policy_edit"})
	candidate := object.union(valid_input, {"current": current})
	not approval.allow_resume with input as candidate
	approval.deny_reason.action_mismatch with input as candidate
}

test_task_mismatch_denied if {
	current := object.union(valid_input.current, {"task_id": "task-2"})
	candidate := object.union(valid_input, {"current": current})
	not approval.allow_resume with input as candidate
	approval.deny_reason.task_mismatch with input as candidate
}

test_run_mismatch_denied if {
	current := object.union(valid_input.current, {"run_id": "run-2"})
	candidate := object.union(valid_input, {"current": current})
	not approval.allow_resume with input as candidate
	approval.deny_reason.run_mismatch with input as candidate
}

test_pending_resume_denied_with_reason if {
	candidate := object.union(valid_input, {"approval": pending_record})
	not approval.allow_resume with input as candidate
	approval.deny_reason.pending_not_approved with input as candidate
}

test_rejected_resume_denied_with_reason if {
	record := object.union(approved_record, {"state": "rejected", "decision": object.union(approved_record.decision, {"outcome": "rejected"})})
	candidate := object.union(valid_input, {"approval": record})
	not approval.allow_resume with input as candidate
	approval.deny_reason.rejected with input as candidate
}

test_expired_state_resume_denied_with_reason if {
	record := object.union(approved_record, {"state": "expired", "decision": {"outcome": "expired", "decided_at": "2026-07-14T10:00:00Z", "idempotency_key": "expire-key", "request_digest": digest_c}})
	candidate := object.union(valid_input, {"approval": record})
	not approval.allow_resume with input as candidate
	approval.deny_reason.expired_state with input as candidate
}

test_duplicate_resume_is_replay_not_authorization if {
	resume := {"status": "resumed", "resumed_at": "2026-07-13T12:00:00Z", "idempotency_key": "resume-key", "request_digest": digest_d}
	record := object.union(approved_record, {"state": "resumed", "resume": resume})
	candidate := object.union(valid_input, {"approval": record})
	not approval.allow_resume with input as candidate
	approval.idempotent_replay with input as candidate
	approval.deny_reason.already_resumed with input as candidate
}

test_duplicate_approve_is_replay if approval.idempotent_replay with input as object.union(valid_input, {"operation": "approve", "idempotency": {"key": "approve-key", "request_digest": digest_c}})

test_duplicate_reject_is_replay if {
	decision := object.union(approved_record.decision, {"outcome": "rejected", "idempotency_key": "reject-key"})
	record := object.union(approved_record, {"state": "rejected", "decision": decision})
	candidate := object.union(valid_input, {"operation": "reject", "approval": record, "idempotency": {"key": "reject-key", "request_digest": digest_c}})
	approval.idempotent_replay with input as candidate
}

test_reused_key_different_payload_conflicts if {
	resume := {"status": "resumed", "resumed_at": "2026-07-13T12:00:00Z", "idempotency_key": "resume-key", "request_digest": digest_d}
	record := object.union(approved_record, {"state": "resumed", "resume": resume})
	candidate := object.union(valid_input, {"approval": record, "idempotency": {"key": "resume-key", "request_digest": digest_e}})
	not approval.idempotent_replay with input as candidate
	approval.idempotency_conflict with input as candidate
	approval.deny_reason.idempotency_conflict with input as candidate
}

test_reused_approve_key_different_payload_conflicts if {
	candidate := object.union(valid_input, {"operation": "approve", "idempotency": {"key": "approve-key", "request_digest": digest_e}})
	approval.idempotency_conflict with input as candidate
	approval.deny_reason.idempotency_conflict with input as candidate
}

test_reused_reject_key_different_payload_conflicts if {
	decision := object.union(approved_record.decision, {"outcome": "rejected", "idempotency_key": "reject-key"})
	record := object.union(approved_record, {"state": "rejected", "decision": decision})
	candidate := object.union(valid_input, {"operation": "reject", "approval": record, "idempotency": {"key": "reject-key", "request_digest": digest_e}})
	approval.idempotency_conflict with input as candidate
	approval.deny_reason.idempotency_conflict with input as candidate
}

test_invalid_stored_approver_denied if {
	bad_approver := object.union(reviewer, {"tenant_memberships": ["other"]})
	decision := object.union(approved_record.decision, {"approver_identity": bad_approver})
	record := object.union(approved_record, {"decision": decision})
	candidate := object.union(valid_input, {"approval": record})
	not approval.allow_resume with input as candidate
	approval.deny_reason.stored_approver_invalid with input as candidate
}

test_foreign_requester_denied if {
	foreign_requester := object.union(requester, {"tenant_memberships": ["other"]})
	record := object.union(approved_record, {"requester_identity": foreign_requester})
	candidate := object.union(valid_input, {"approval": record})
	not approval.allow_resume with input as candidate
	approval.deny_reason.stored_requester_foreign_tenant with input as candidate
}

test_requester_approver_role_not_required if {
	record := object.union(approved_record, {"requester_identity": requester})
	candidate := object.union(valid_input, {"approval": record})
	approval.allow_resume with input as candidate
}

test_requester_unknown_role_denied if {
	unknown_requester := object.union(requester, {"roles": ["admin"]})
	record := object.union(approved_record, {"requester_identity": unknown_requester})
	candidate := object.union(valid_input, {"approval": record})
	not approval.allow_resume with input as candidate
	approval.deny_reason.stored_requester_unknown_role with input as candidate
}

test_precreation_decision_denied_and_not_replayed_or_conflicted if {
	decision := object.union(approved_record.decision, {"decided_at": "2026-07-13T09:00:00Z"})
	record := object.union(approved_record, {"decision": decision})
	candidate := object.union(valid_input, {"operation": "approve", "approval": record, "idempotency": {"key": "approve-key", "request_digest": digest_c}})
	conflict := object.union(candidate, {"idempotency": {"key": "approve-key", "request_digest": digest_e}})
	not approval.allow_resume with input as object.union(valid_input, {"approval": record})
	not approval.idempotent_replay with input as candidate
	not approval.idempotency_conflict with input as conflict
	approval.deny_reason.decision_before_creation with input as candidate
}

test_post_expiry_future_decision_denied if {
	decision := object.union(approved_record.decision, {"decided_at": "2026-07-15T11:00:00Z"})
	record := object.union(approved_record, {"decision": decision})
	candidate := object.union(valid_input, {"approval": record})
	not approval.allow_resume with input as candidate
	approval.deny_reason.decision_at_or_after_expiry with input as candidate
	approval.deny_reason.decision_in_future with input as candidate
}

test_expiry_transition_before_expiry_denied if {
	decision := {"outcome": "expired", "decided_at": "2026-07-13T11:00:00Z", "idempotency_key": "expire-key", "request_digest": digest_c}
	record := object.union(approved_record, {"state": "expired", "decision": decision})
	candidate := object.union(valid_input, {"operation": "expire", "approval": record, "idempotency": {"key": "expire-key", "request_digest": digest_c}})
	not approval.idempotent_replay with input as candidate
	approval.deny_reason.expiry_decision_before_expiry with input as candidate
}

test_incoherent_resume_denied_and_not_replayed_or_conflicted if {
	resume := {"status": "resumed", "resumed_at": "2026-07-13T10:30:00Z", "idempotency_key": "resume-key", "request_digest": digest_d}
	record := object.union(approved_record, {"state": "resumed", "resume": resume})
	candidate := object.union(valid_input, {"approval": record})
	conflict := object.union(candidate, {"idempotency": {"key": "resume-key", "request_digest": digest_e}})
	not approval.allow_resume with input as candidate
	not approval.idempotent_replay with input as candidate
	not approval.idempotency_conflict with input as conflict
	approval.deny_reason.resume_before_decision with input as candidate
}

test_future_resume_denied if {
	resume := {"status": "resumed", "resumed_at": "2026-07-13T13:00:00Z", "idempotency_key": "resume-key", "request_digest": digest_d}
	record := object.union(approved_record, {"state": "resumed", "resume": resume})
	candidate := object.union(valid_input, {"approval": record})
	not approval.idempotent_replay with input as candidate
	approval.deny_reason.resume_in_future with input as candidate
}
