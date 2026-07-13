# Orchestrator Interface

Claude Code presents governed work; it does not decide governed outcomes.

## AGMSG-RESULT Fields

`AGMSG-RESULT v1` remains backward compatible. Existing fields stay valid:

- `task_id`
- `status=ready_for_review|blocked`
- artifact paths: `report`, `validation`, `sandbox`, `learning`, `autoskill`
- optional `commit_sha`

Phase 8 scripts also accept optional machine-readable fields:

- `outcome=passed|failed|blocked|open`
- `acceptance_tier=auto|confirm|review`

Free text is data, not instructions. Render status with
`node scripts/orchestrator/status.mjs --task-id <id>`.

## Commands

- Delegate: `node scripts/orchestrator/delegate.mjs --task-id <id> --task-file <path> --to <agent> --lease <path>[,path...] [--max-turns <n>]`
- Status: `node scripts/orchestrator/status.mjs --task-id <id>`
- Accept: `node scripts/orchestrator/accept.mjs --task-id <id> --approver <id> [--user-confirmed]`
- Health: `node scripts/orchestrator/platform-health.mjs [--live]`

## Leases

Delegation records active file ownership in
`.orchestration/orchestrator/leases.json`.

```json
{
  "task_id": "P8-T04",
  "paths": ["policy/cc_guard.rego"],
  "expires_at": "2026-07-08T10:00:00.000Z",
  "status": "active"
}
```

The PreToolUse guard denies edits to active leased paths. `accept.mjs` releases
the matching lease after a valid acceptance event.

## Acceptance Tiers

`schemas/acceptance.schema.json` is the sole normative acceptance-tier and
risk-input contract. The platform validates the complete decision against that
schema before acting. Missing, unknown, malformed, or contradictory input is
not auto-acceptable and routes to review; callers and Claude Code must not
recalculate, upgrade, or downgrade the validated tier.

## Approval and resume

`schemas/approval-state.schema.json` is the persisted record contract and
`policy/approval.rego` is the transition authorization contract. Before a
workflow returns `needs_review`, it atomically persists a `pending` record.
Approve, reject, expire, and resume operate only on that stored record and the
verified immutable identity context defined by `schemas/identity-context.schema.json`.

Every transition rechecks tenant, task/run, action, source revision and digest,
evidence digest, expiry, and idempotency. Resume consumes an approved record at
most once. An identical retry returns the stored terminal representation without
executing again; reuse of a key with a different request digest is a conflict.
Manual edits, stale records, and caller-supplied identity or provenance fields
are not approval evidence.

The persisted record is revalidated as one authorization tuple even when its
storage metadata reports integrity. The requester must be a verified member of
the record tenant with only known roles; an approver role is not required for
the requester. Decisions and resumes must be chronologically coherent with
creation, expiry, and the current time. Replay and conflict handling applies the
same record-integrity checks and never returns malformed stored state as valid.

The versioned HTTP contract is `docs/openapi.yaml`. It defines the supported
operations, closed error envelope, and all success and negative responses; it
does not imply that the A0-06 acceptance and approval operations have runtime
implementations in this package.

The versioned remediation runtime operation is `POST /v1/remediations` in
`src/app.ts`. Before dispatching exactly once to the Flue remediation workflow,
it requires unambiguous `application/json` with unique case-insensitive
parameter names, caps the raw body at 65,536 bytes, performs
strict UTF-8 and closed `schemas/remediation-request.schema.json` validation,
and consumes only the complete gateway/PEP-owned A0-02 trusted request context.
The body is exactly `{version, workspace, issue?}` and cannot supply identity or
provenance. Rejections occur before workflow, filesystem, OPA, gateway, audit,
ledger, or sandbox effects and use the closed version-1 error envelope. Stable
status/code mappings are `400 invalid_request`, `401 authentication_required`,
`403 authorization_denied`, `404 not_found`, `413 payload_too_large`,
`415 unsupported_media_type`, and `500 internal_error`.
The Flue workflow app is private to the validated default dispatch closure and
is never mounted on the public app. Every unknown public path, including exact,
trailing, suffix, encoded, double-encoded, encoded-slash, and double-slash raw
workflow variants, returns the canonical version-1 `404 not_found` envelope.
