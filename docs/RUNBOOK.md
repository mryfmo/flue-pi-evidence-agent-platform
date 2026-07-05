# Runbook

## Validate a clean checkout

```bash
npm ci
./node_modules/node/bin/node scripts/setup-python.mjs
npm run validate-release
```

OPA resolves from the platform-matching optional npm package by default. If the bundled binary is unavailable, set `EAP_OPA_BINARY=/path/to/opa` and rerun the failed gate.

## Run E2E only

```bash
npm run flue:e2e
```

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

## Known intentional design choices

- The local gateway is deterministic to make E2E repeatable.
- The Flue/Pi path summarizes verified evidence; it does not own side-effect execution.
- `sample_repos/buggy_multi` is a deterministic fixture with two independent defects so that patch fan-out and closure behavior are tested.
- Generated workspaces live under `artifacts/demo/workspace/` and are not the source fixture.
