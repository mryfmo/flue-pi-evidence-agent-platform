# Operations

## Release validation

Run:

```bash
npm run validate-release
```

The command clears `artifacts/validation/`, executes all quality and runtime gates, and writes the final report. A release is valid only if `artifacts/validation/final_verification_report.json` contains `"status": "passed"`.

## CI

GitHub Actions runs on pushes to `main` and on pull requests. The workflow has two independent jobs: native `npm run validate-release` and container validation through `scripts/container-validate.sh`.
Native validation uploads `artifacts/validation/` and `artifacts/sbom/` for 30 days. Container validation uploads `artifacts/container-validation/` for 30 days.
Any failed job is a release-blocking red check; inspect the uploaded logs before rerunning locally.

## Operational check

Run:

```bash
./node_modules/node/bin/node scripts/ops-check.mjs
```

This is an operations preflight, not a release gate. It checks that `origin` is configured, the latest final verification report passed, the OPA bundle manifest has a revision, and the promoted remediator skill has provenance.
If the git remote cannot be reached from an offline host, the check prints `warn` and continues.

## Evidence inspection

Persistent artifact shape and lifecycle are governed by `schemas/persistent-artifact.schema.json` and `docs/DATA_GOVERNANCE.md`. The only normative governed-term glossary and resource catalog are the “Canonical glossary (normative)” and “Canonical controlled-resource catalog (normative)” sections in `docs/INTEGRATION_BOUNDARY.md`.

- Ledger: `artifacts/demo/hypothesis-ledger.json`
- Audit: `artifacts/audit/remediation.jsonl`
- Trace: `artifacts/telemetry/traces.jsonl`
- Validation report: `artifacts/validation/final_verification_report.json`
- Node SBOM: `artifacts/sbom/npm-cyclonedx.json`

## Audit trace by task

Run:

```bash
npm run audit:trace -- <task_id>
```

The command correlates the task spec, orchestrator events, report, validation,
sandbox, acceptance, leases, platform audit JSONL, and gateway telemetry for the
given `task_id`. Missing sections are printed as `missing`; absence is never
treated as successful evidence. Use `-- --json` after the task id when a machine
readable trace is needed.

The primary ledgers remain the platform JSONL files under `.orchestration/` and
`artifacts/`. The CLI is a deterministic read-only view over those ledgers and
redacts body-like fields to digests instead of printing prompt or secret text.

## OTLP trace export

Set `EAP_OTLP_ENDPOINT` to an OTLP HTTP traces endpoint, for example `http://collector:4318/v1/traces`, to mirror spans to a collector.
The JSONL trace artifact is still written unconditionally for deterministic release evidence.
Collector outages emit one warning and do not fail workflows.

## SLOs and alerts

Operational SLOs and monitor-readable alert conditions are in `docs/SLO.md`.
Alerts are definitions only; this repository does not provision collectors, dashboards, or paging infrastructure.

## Backup, restore, and rollback

Back up the git remote plus evidence snapshots from `artifacts/`: `audit/`, `demo/hypothesis-ledger.json`, `telemetry/traces.jsonl`, `validation/final_verification_report.*`, `policy/bundle.tar.gz`, and `sbom/`.
Generated workspaces under `artifacts/demo/workspace/`, validation stdout/stderr logs, and `dist/` are regenerable from a clean checkout.

Restore from a clean checkout with `npm ci`, `./node_modules/node/bin/node scripts/setup-python.mjs`, evidence snapshot copy-back, then `npm run validate-release` and `scripts/ops-check.mjs`.
Rollback code, policy, and docs with `git revert`; keep release tags such as the `baseline-v1.1.0` precedent immutable and create a new rollback tag after validation.
Rollback policy bundles by reverting the policy commit and rebuilding `artifacts/policy/bundle.tar.gz`; the bundle manifest `revision` must match the reverted code or policy hash.
Rollback promoted skills by reverting `.orchestration/skills/promoted/remediator/best_skill.md` and its linked provenance chain; see `docs/SKILL_OPTIMIZATION.md`.

## Common commands

```bash
npm run flue:build
npm run flue:e2e
npm run test
npm run opa:check
npm run python:test
```

## Incident triage

| Symptom | Action |
| --- | --- |
| OPA parse or decision error | inspect `policy/agent.rego` and `artifacts/validation/opa.stderr.log` |
| Python dependency missing | rerun `./node_modules/node/bin/node scripts/setup-python.mjs` |
| Flue version mismatch | use scripts that invoke `./node_modules/node/bin/node` |
| Closure gate failure | inspect ledger hypotheses, evidence kinds, patch records, and verifier status |
| Unsafe SQL accepted | block release and inspect `scripts/data_guard.py` plus data proxy tests |
| Missing trace evidence | inspect `src/lib/telemetry.ts` and `artifacts/telemetry/traces.jsonl` |

## Secrets

The platform needs no secrets for release validation. When live providers are enabled, use `docs/SECRETS_MANAGEMENT.md` for injection, rotation, and incident response; never paste key material into logs, audit files, telemetry, agmsg, or repository config.

## Extension protocol

New tools, new policy inputs, new data paths, or new model providers require:

1. Requirement update.
2. Architecture/security documentation update.
3. Rego policy update when side effects are involved.
4. Tests in the correct taxonomy.
5. Traceability link.
6. Passing `npm run validate-release`.
