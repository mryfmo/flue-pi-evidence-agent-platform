# Skill Candidate Triage

AutoSkill output enters the registry as candidate material only. Triage prepares evidence for an orchestrator decision; it does not promote, reject, or merge by itself.

## States

| Recommendation | Meaning | Next owner action |
| --- | --- | --- |
| `validated` | Candidate is narrow, reusable, non-duplicative, secret-free, and has validation evidence. | Orchestrator may mark validated, then decide promotion separately. |
| `rejected` | Candidate is duplicate, unsafe, too broad, stale, or lacks reusable value. | Orchestrator records a rejected-buffer entry. |
| `merge_required` | Candidate has useful material but overlaps an existing doc/skill. | Orchestrator assigns a merge task instead of direct promotion. |
| `improve` | Candidate has reusable intent but needs scope, activation, or verification repair. | Orchestrator assigns a candidate improvement task. |

## Procedure

1. Read the candidate frontmatter and body.
2. Compare the activation trigger and operational rules against existing docs, skills, and accepted task artifacts.
3. Check for secrets, project-specific one-offs, overbroad scope, missing validation, and unsupported promotion claims.
4. Write a worksheet row with summary, overlap analysis, recommendation, and rationale.
5. Leave files in `candidates/`; do not move registry state during worker triage.

## Record Format

```yaml
candidate: path
summary: short description
overlap: existing docs or skills with similar scope
recommendation: validated | rejected | merge_required | improve
rationale: evidence-backed reason
decision_owner: orchestrator
```

## Anti-Resubmission Rule

Rejected candidates require an entry in the relevant rejected buffer with an `anti_resubmission_key`. A future candidate with the same key cannot be accepted unless it explicitly addresses the recorded rejection reason.

## Promotion Authority

Only orchestrator acceptance may promote a validated candidate. Workers may recommend, improve, or prepare merge plans, but must not copy candidates into `promoted/`.

## Native Lifecycle Automation

`scripts/skill-lifecycle.mjs` automates evidence collection and recommendation prep without promoting skills:

1. `observe --trigger task-completion|error-recovery|user-correction --task <id>` redacts task evidence from reports, validation, and acceptance files into `.orchestration/autoskill/inputs/<id>.manifest.json`.
2. `decide --task <id>` compares the task evidence with candidate and promoted registry skills, then writes `.orchestration/autoskill/runs/<id>.lifecycle.md` with `promotion_allowed=false`.
3. `apply --task <id> --decision create|patch|merge|discard` records the caller's decision, creates a candidate only for `create`, and appends a triage record. The orchestrator remains the decision owner.

Use `scripts/skill-activate.mjs --query "<task text>"` to list matching promoted skills, and `--full <name>` to load a full promoted skill body on demand.
