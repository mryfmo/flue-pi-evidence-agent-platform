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

## Evidence inspection

- Ledger: `artifacts/demo/hypothesis-ledger.json`
- Audit: `artifacts/audit/remediation.jsonl`
- Trace: `artifacts/telemetry/traces.jsonl`
- Validation report: `artifacts/validation/final_verification_report.json`
- Node SBOM: `artifacts/sbom/npm-cyclonedx.json`

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
