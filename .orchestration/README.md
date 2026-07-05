# Orchestration Workspace

This directory is the repository-local coordination workspace for the Flue + Pi Evidence Agent Platform productionization effort. It stores file-based artifacts referenced by short `agmsg` messages between team `flue-pi-productionization`, orchestrator `orchestrator-fable5`, and workers named `codex-gpt55-high-<phase>-<task>`.

## Message Flow

- `AGMSG-TASK`: the orchestrator assigns a task and points to a task file under `tasks/`.
- `AGMSG-RESULT`: a worker reports completion or blockage and points to report, validation, sandbox, learning, and AutoSkill run files.
- `AGMSG-ACCEPTANCE`: the orchestrator records review and acceptance decisions under `acceptance/`.

## Directories

- `tasks/`: task specifications assigned by the orchestrator.
- `reports/`: worker completion reports and blocked-task reports.
- `validation/`: command outputs and validation evidence for each task.
- `acceptance/`: orchestrator acceptance, rejection, or follow-up decisions.
- `sandboxes/`: OpenSandbox records, or documented fallback records when OpenSandbox is unavailable.
- `autoskill/config/`: AutoSkill configuration artifacts.
- `autoskill/inputs/`: redacted AutoSkill inputs.
- `autoskill/runs/`: AutoSkill run logs and not-used records.
- `autoskill/outputs/`: AutoSkill generated outputs.
- `learning/`: task learning triage records.
- `learning/rule_candidates/`: candidate reusable rules only; no direct promotion.
- `skills/candidates/`: AutoSkill-generated skill candidates.
- `skills/promoted/`: skills promoted after validation.
- `skills/rejected/`: rejected skill candidates with rationale.
- `skills/merged/`: skill candidates merged into existing skills.
- `skills/hermes_subset_policy.md`: policy for using only the Hermes Skill Subset ideas, not Hermes Agents runtime.
- `agmsg/`: exported or summarized agmsg history when needed for review.

Sandbox records must state whether OpenSandbox or a fallback was used. AutoSkill artifacts must keep inputs redacted and separate config, runs, and outputs. Skill registry artifacts must preserve candidate, promoted, rejected, and merged states separately.
