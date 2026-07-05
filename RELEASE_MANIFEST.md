# Release Manifest

Package: `flue-pi-evidence-agent-platform`
Version: `1.1.0`
Release status: validation passed

## Included runtime sources

- Flue application entrypoint and workflows under `src/`.
- Flue/Pi remediator agent profile under `src/agents/`.
- OPA/Rego policy under `policy/`.
- Python SQLGlot/DuckDB/Presidio data guard under `scripts/data_guard.py`.
- Unit, component, system, E2E, failure, security, regression tests under `tests/` and `tests_py/`.
- Documentation, requirements, and traceability under `docs/`.
- Validation logs and evidence artifacts under `artifacts/`.

## Excluded generated dependencies

`node_modules/` and `.venv/` are intentionally excluded from the release ZIP. They are restored by:

```bash
npm ci
./node_modules/node/bin/node scripts/setup-python.mjs
```

Dependency lock/evidence files are included:

- `package-lock.json`
- `requirements.txt`
- `artifacts/sbom/npm-cyclonedx.json`
- `artifacts/validation/final_verification_report.json`

## Validation command

```bash
npm run validate-release
```

The attached validation report shows every release gate passed in this environment using bundled Node `v22.19.0` from the npm `node` package.
