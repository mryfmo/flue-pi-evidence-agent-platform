# Runbook

## Validate a clean checkout

```bash
npm ci
./node_modules/node/bin/node scripts/setup-python.mjs
npm run validate-release
./node_modules/node/bin/node scripts/ops-check.mjs
```

OPA resolves from the platform-matching optional npm package by default. If the bundled binary is unavailable, set `EAP_OPA_BINARY=/path/to/opa` and rerun the failed gate.

## Run E2E only

```bash
npm run flue:e2e
```

## Run deploy smoke

```bash
scripts/deploy-smoke.sh
```

Use this after container validation or before release handoff. It rebuilds or reuses `flue-pi-eap:validate`, checks the deterministic `ack:hello` smoke path, and confirms the built server returns HTTP 200 from `/health`.

## Read the remediation outcome

```bash
cat artifacts/demo/hypothesis-ledger.json
cat artifacts/audit/remediation.jsonl
cat artifacts/telemetry/traces.jsonl
```

## Gate failure handling

1. Do not package a release.
2. Open `artifacts/validation/final_verification_report.json`.
3. Inspect the failing gate's stdout/stderr logs.
4. Fix implementation, tests, or documentation.
5. Rerun `npm run validate-release`.

## Backup

1. Push code, policy, docs, and orchestration evidence to the git remote.
2. Snapshot `artifacts/audit/`, `artifacts/demo/hypothesis-ledger.json`, `artifacts/telemetry/traces.jsonl`, `artifacts/validation/final_verification_report.*`, `artifacts/policy/bundle.tar.gz`, and `artifacts/sbom/`.
3. Skip `artifacts/demo/workspace/`, transient validation stdout/stderr logs, and `dist/`; regenerate them with `npm run validate-release`.
4. Record the commit SHA, release tag, OPA bundle revision, and snapshot location.

## Restore

1. Clone the target commit or release tag into a clean directory.
2. Run `npm ci` and `./node_modules/node/bin/node scripts/setup-python.mjs`.
3. Copy the evidence snapshot back under `artifacts/`.
4. Run `npm run validate-release` and `./node_modules/node/bin/node scripts/ops-check.mjs`.
5. Compare the restored final report, OPA bundle revision, and promoted skill provenance with the backup record.

## Rollback

1. Use `git revert` for the bad code, docs, policy, or orchestration commit; do not rewrite release tags.
2. Rebuild the policy bundle with `./node_modules/node/bin/node scripts/opa-bundle.mjs` after any policy rollback and verify the manifest `revision`.
3. For skill rollback, revert `.orchestration/skills/promoted/remediator/best_skill.md` and its linked provenance chain as described in `docs/SKILL_OPTIMIZATION.md`.
4. Run `npm run validate-release`, `scripts/deploy-smoke.sh`, and `./node_modules/node/bin/node scripts/ops-check.mjs`.
5. Create a new rollback tag after validation; keep the previous baseline tag, for example `baseline-v1.1.0`, immutable.

## Known intentional design choices

- The local gateway is deterministic to make E2E repeatable.
- The Flue/Pi path summarizes verified evidence; it does not own side-effect execution.
- `sample_repos/buggy_multi` is a deterministic fixture with two independent defects so that patch fan-out and closure behavior are tested.
- Generated workspaces live under `artifacts/demo/workspace/` and are not the source fixture.
