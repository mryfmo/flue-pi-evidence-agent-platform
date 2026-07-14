# Task A0-01-R3-POLICY: add the approved classification catalog

## 1. Role and selected model

You are a controlled-policy worker using `gpt-5.6-sol high`. You are not the orchestrator. The highest available tier is required because this edit sits on an authorization trust boundary even though the textual diff is small.

## 2. Objective

Add exactly one top-level `classification` member to `policy/routing.json`, with no other semantic or formatting change:

```json
"classification": {
  "producer": "flue-pi-data-guard",
  "verified_by": "flue-pi-platform-gateway",
  "evidence_kind": "presidio-sqlglot-redaction-v1",
  "enum": ["public", "internal", "confidential", "restricted"]
}
```

## 3. Preconditions

- Read `.orchestration/decisions/A0-01-R3.yaml` and `.orchestration/plan/revisions/A0-01-R3-runtime-classification-v1.md`.
- `git rev-parse HEAD` must equal `e5d077bb4bab411d3448c4b5742108247d5d94ab`.
- `policy/routing.json` must have no pre-existing worktree diff. Otherwise return blocked without editing.

## 4. Allowed files

- `policy/routing.json`
- `.orchestration/reports/A0-01-R3-POLICY.report.md`
- `.orchestration/validation/A0-01-R3-POLICY.validation.log`
- `.orchestration/sandboxes/A0-01-R3-POLICY.sandbox.md`
- `.orchestration/learning/A0-01-R3-POLICY.learning.md`
- `.orchestration/autoskill/runs/A0-01-R3-POLICY.autoskill.md`

## 5. Forbidden actions

- Any change to `version`, `defaults`, `routes`, `providers`, route/provider/model/fallback data, or JSON member order/format outside the minimum insertion.
- Any other `policy/**` edit; Rego/schema/prod-policy/test/source/doc/task/plan edit.
- Dependency install, commit, push, release acceptance, credential/data access, or cleanup of unrelated changes.

## 6. Verification

Run and preserve complete output and exit codes:

```bash
git diff -- policy/routing.json
./node_modules/node/bin/node -e "const p=require('./policy/routing.json'); const expected={producer:'flue-pi-data-guard',verified_by:'flue-pi-platform-gateway',evidence_kind:'presidio-sqlglot-redaction-v1',enum:['public','internal','confidential','restricted']}; if(JSON.stringify(p.classification)!==JSON.stringify(expected)) process.exit(1)"
./node_modules/node/bin/node scripts/opa-test.mjs
./node_modules/node/bin/node scripts/opa-check.mjs
git diff --check -- policy/routing.json
git diff --name-only -- policy
```

Expected: exact one-member diff; OPA 166/166; all commands exit 0; the final command prints only `policy/routing.json`.

Adversarial review: compare the parsed HEAD document and worktree document after deleting only the new `classification` key; their canonical JSON must be identical. If not, return blocked.

## 7. Evidence and result

Write the five exact evidence paths from section 4. Return exactly:

```text
AGMSG-RESULT v1 task_id=A0-01-R3-POLICY status=ready_for_review acceptance_tier=confirm report=.orchestration/reports/A0-01-R3-POLICY.report.md validation=.orchestration/validation/A0-01-R3-POLICY.validation.log sandbox=.orchestration/sandboxes/A0-01-R3-POLICY.sandbox.md learning=.orchestration/learning/A0-01-R3-POLICY.learning.md autoskill=.orchestration/autoskill/runs/A0-01-R3-POLICY.autoskill.md
```

Use `status=blocked acceptance_tier=review` on any precondition, scope, or verification failure.
