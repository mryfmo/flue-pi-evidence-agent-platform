package eap.approval

import rego.v1

default allow_approve := false

default allow_reject := false

default allow_expire := false

default allow_resume := false

known_role contains "platform_engineer"

known_role contains "software_engineer"

known_role contains "data_analyst"

known_role contains "security_reviewer"

approval_role contains "platform_engineer"

approval_role contains "security_reviewer"

valid_identity(identity) if {
	is_object(identity)
	is_string(identity.subject_id)
	identity.subject_id != ""
	identity.principal_type == "authenticated"
	is_array(identity.tenant_memberships)
	count(identity.tenant_memberships) > 0
	is_array(identity.roles)
	count(identity.roles) > 0
	identity.issuer == "flue-pi-identity-authority"
	identity.audience == "flue-pi-agent-policy"
	identity.verification.status == "verified"
	identity.verification.owner == "flue-pi-platform-gateway"
	is_string(identity.request_binding.id)
	identity.request_binding.id != ""
}

has_unknown_role(identity) if {
	role := identity.roles[_]
	not known_role[role]
}

has_approval_role(identity) if approval_role[identity.roles[_]]

identity_tenant_member(identity, tenant) if identity.tenant_memberships[_] == tenant

identity_authorized(identity, tenant) if {
	valid_identity(identity)
	not has_unknown_role(identity)
	has_approval_role(identity)
	identity_tenant_member(identity, tenant)
}

valid_requester(identity, tenant) if {
	valid_identity(identity)
	not has_unknown_role(identity)
	identity_tenant_member(identity, tenant)
}

actor_tenant_member if input.identity_context.tenant_memberships[_] == input.approval.tenant_id

valid_actor if {
	is_object(input.request_context)
	is_string(input.request_context.tenant)
	input.request_context.tenant != ""
	is_string(input.request_context.binding_id)
	input.request_context.binding_id != ""
	identity_authorized(input.identity_context, input.request_context.tenant)
	input.identity_context.request_binding.id == input.request_context.binding_id
	input.request_context.tenant == input.approval.tenant_id
}

persisted_record if {
	is_object(input.approval)
	is_object(input.record_context)
	input.record_context.persisted == true
	input.record_context.immutable == true
	input.record_context.integrity_verified == true
}

binding_matches if {
	input.current.tenant_id == input.approval.tenant_id
	input.current.task_id == input.approval.task_id
	input.current.run_id == input.approval.run_id
	input.current.source.revision == input.approval.source.revision
	input.current.source.digest == input.approval.source.digest
	input.current.evidence_digest == input.approval.evidence_digest
	input.current.action == input.approval.action
}

valid_idempotency if {
	is_string(input.idempotency.key)
	input.idempotency.key != ""
	regex.match(`^sha256:[0-9a-f]{64}$`, input.idempotency.request_digest)
}

not_expired if time.parse_rfc3339_ns(input.now) < time.parse_rfc3339_ns(input.approval.expires_at)

expired if time.parse_rfc3339_ns(input.now) >= time.parse_rfc3339_ns(input.approval.expires_at)

record_time_valid if {
	created := time.parse_rfc3339_ns(input.approval.created_at)
	now := time.parse_rfc3339_ns(input.now)
	expires := time.parse_rfc3339_ns(input.approval.expires_at)
	created <= now
	created < expires
}

decision_time_valid if {
	input.approval.decision.outcome in {"approved", "rejected"}
	created := time.parse_rfc3339_ns(input.approval.created_at)
	decided := time.parse_rfc3339_ns(input.approval.decision.decided_at)
	now := time.parse_rfc3339_ns(input.now)
	expires := time.parse_rfc3339_ns(input.approval.expires_at)
	created <= decided
	decided <= now
	decided < expires
}

expiry_time_valid if {
	input.approval.decision.outcome == "expired"
	decided := time.parse_rfc3339_ns(input.approval.decision.decided_at)
	now := time.parse_rfc3339_ns(input.now)
	expires := time.parse_rfc3339_ns(input.approval.expires_at)
	expires <= decided
	decided <= now
}

resume_time_valid if {
	decided := time.parse_rfc3339_ns(input.approval.decision.decided_at)
	resumed := time.parse_rfc3339_ns(input.approval.resume.resumed_at)
	now := time.parse_rfc3339_ns(input.now)
	expires := time.parse_rfc3339_ns(input.approval.expires_at)
	decided <= resumed
	resumed <= now
	resumed < expires
}

fresh_pending if {
	input.approval.state == "pending"
	input.approval.decision == null
	input.approval.resume.status == "not_resumed"
}

stored_approver_authorized if {
	input.approval.decision.outcome in {"approved", "rejected"}
	identity_authorized(input.approval.decision.approver_identity, input.approval.tenant_id)
}

record_integrity if {
	record_time_valid
	valid_requester(input.approval.requester_identity, input.approval.tenant_id)
	fresh_pending
}

record_integrity if {
	record_time_valid
	valid_requester(input.approval.requester_identity, input.approval.tenant_id)
	input.approval.state in {"approved", "rejected"}
	input.approval.resume.status == "not_resumed"
	input.approval.decision.outcome == input.approval.state
	stored_approver_authorized
	decision_time_valid
}

record_integrity if {
	record_time_valid
	valid_requester(input.approval.requester_identity, input.approval.tenant_id)
	input.approval.state == "expired"
	input.approval.resume.status == "not_resumed"
	expiry_time_valid
}

record_integrity if {
	record_time_valid
	valid_requester(input.approval.requester_identity, input.approval.tenant_id)
	input.approval.state == "resumed"
	input.approval.decision.outcome == "approved"
	input.approval.resume.status == "resumed"
	stored_approver_authorized
	decision_time_valid
	resume_time_valid
}

allow_approve if {
	input.operation == "approve"
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	fresh_pending
	record_integrity
	not_expired
}

allow_reject if {
	input.operation == "reject"
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	fresh_pending
	record_integrity
	not_expired
}

allow_expire if {
	input.operation == "expire"
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	fresh_pending
	record_integrity
	expired
}

allow_resume if {
	input.operation == "resume"
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	input.approval.state == "approved"
	stored_approver_authorized
	input.approval.resume.status == "not_resumed"
	record_integrity
	not_expired
}

idempotent_replay if {
	input.operation == "approve"
	input.approval.state == "approved"
	input.approval.decision.outcome == "approved"
	input.approval.decision.idempotency_key == input.idempotency.key
	input.approval.decision.request_digest == input.idempotency.request_digest
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	record_integrity
}

idempotent_replay if {
	input.operation == "reject"
	input.approval.state == "rejected"
	input.approval.decision.outcome == "rejected"
	input.approval.decision.idempotency_key == input.idempotency.key
	input.approval.decision.request_digest == input.idempotency.request_digest
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	record_integrity
}

idempotent_replay if {
	input.operation == "resume"
	input.approval.state == "resumed"
	input.approval.resume.status == "resumed"
	input.approval.resume.idempotency_key == input.idempotency.key
	input.approval.resume.request_digest == input.idempotency.request_digest
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	record_integrity
}

idempotency_conflict if {
	input.operation == "approve"
	input.approval.decision.idempotency_key == input.idempotency.key
	input.approval.decision.request_digest != input.idempotency.request_digest
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	record_integrity
}

idempotency_conflict if {
	input.operation == "reject"
	input.approval.decision.idempotency_key == input.idempotency.key
	input.approval.decision.request_digest != input.idempotency.request_digest
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	record_integrity
}

idempotency_conflict if {
	input.operation == "resume"
	input.approval.resume.idempotency_key == input.idempotency.key
	input.approval.resume.request_digest != input.idempotency.request_digest
	persisted_record
	valid_actor
	binding_matches
	valid_idempotency
	record_integrity
}

deny_reason contains "approval_not_persisted" if not persisted_record

deny_reason contains "anonymous_or_unverified_actor" if not valid_identity(input.identity_context)

deny_reason contains "unknown_role" if {
	valid_identity(input.identity_context)
	has_unknown_role(input.identity_context)
}

deny_reason contains "insufficient_role" if {
	valid_identity(input.identity_context)
	not has_unknown_role(input.identity_context)
	not has_approval_role(input.identity_context)
}

deny_reason contains "foreign_tenant" if {
	valid_identity(input.identity_context)
	not actor_tenant_member
}

deny_reason contains "request_binding_mismatch" if {
	valid_identity(input.identity_context)
	input.identity_context.request_binding.id != input.request_context.binding_id
}

deny_reason contains "tenant_mismatch" if input.request_context.tenant != input.approval.tenant_id

deny_reason contains "task_mismatch" if input.current.task_id != input.approval.task_id

deny_reason contains "run_mismatch" if input.current.run_id != input.approval.run_id

deny_reason contains "source_revision_mismatch" if input.current.source.revision != input.approval.source.revision

deny_reason contains "source_digest_mismatch" if input.current.source.digest != input.approval.source.digest

deny_reason contains "evidence_digest_mismatch" if input.current.evidence_digest != input.approval.evidence_digest

deny_reason contains "action_mismatch" if input.current.action != input.approval.action

deny_reason contains "expired" if {
	input.operation != "expire"
	expired
}

deny_reason contains "pending_not_approved" if {
	input.operation == "resume"
	input.approval.state == "pending"
}

deny_reason contains "rejected" if {
	input.operation == "resume"
	input.approval.state == "rejected"
}

deny_reason contains "expired_state" if {
	input.operation == "resume"
	input.approval.state == "expired"
}

deny_reason contains "already_resumed" if {
	input.operation == "resume"
	input.approval.state == "resumed"
}

deny_reason contains "stored_approver_invalid" if {
	input.operation == "resume"
	not stored_approver_authorized
}

deny_reason contains "stored_requester_invalid" if {
	not valid_identity(input.approval.requester_identity)
}

deny_reason contains "stored_requester_unknown_role" if {
	valid_identity(input.approval.requester_identity)
	has_unknown_role(input.approval.requester_identity)
}

deny_reason contains "stored_requester_foreign_tenant" if {
	valid_identity(input.approval.requester_identity)
	not has_unknown_role(input.approval.requester_identity)
	not identity_tenant_member(input.approval.requester_identity, input.approval.tenant_id)
}

deny_reason contains "idempotency_conflict" if idempotency_conflict

deny_reason contains "invalid_idempotency" if not valid_idempotency

deny_reason contains "invalid_record_time" if not record_time_valid

deny_reason contains "decision_before_creation" if {
	input.approval.decision.outcome in {"approved", "rejected"}
	time.parse_rfc3339_ns(input.approval.decision.decided_at) < time.parse_rfc3339_ns(input.approval.created_at)
}

deny_reason contains "decision_at_or_after_expiry" if {
	input.approval.decision.outcome in {"approved", "rejected"}
	time.parse_rfc3339_ns(input.approval.decision.decided_at) >= time.parse_rfc3339_ns(input.approval.expires_at)
}

deny_reason contains "decision_in_future" if {
	input.approval.decision.outcome in {"approved", "rejected", "expired"}
	time.parse_rfc3339_ns(input.approval.decision.decided_at) > time.parse_rfc3339_ns(input.now)
}

deny_reason contains "expiry_decision_before_expiry" if {
	input.approval.decision.outcome == "expired"
	time.parse_rfc3339_ns(input.approval.decision.decided_at) < time.parse_rfc3339_ns(input.approval.expires_at)
}

deny_reason contains "resume_before_decision" if {
	input.approval.resume.status == "resumed"
	time.parse_rfc3339_ns(input.approval.resume.resumed_at) < time.parse_rfc3339_ns(input.approval.decision.decided_at)
}

deny_reason contains "resume_at_or_after_expiry" if {
	input.approval.resume.status == "resumed"
	time.parse_rfc3339_ns(input.approval.resume.resumed_at) >= time.parse_rfc3339_ns(input.approval.expires_at)
}

deny_reason contains "resume_in_future" if {
	input.approval.resume.status == "resumed"
	time.parse_rfc3339_ns(input.approval.resume.resumed_at) > time.parse_rfc3339_ns(input.now)
}

deny_reason contains "invalid_record_integrity" if not record_integrity
