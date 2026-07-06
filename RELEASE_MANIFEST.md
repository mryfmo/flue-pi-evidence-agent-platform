# Release Manifest

Package: `flue-pi-evidence-agent-platform`
Version: `1.2.0`
Release status: validation passed

## Included runtime sources

- GitHub Actions release, container, deploy-smoke, and OpenSandbox validation under `.github/workflows/`.
- Flue application entrypoint and workflows under `src/`.
- Flue/Pi remediator agent profile under `src/agents/`.
- Production gateway, routing, and sandbox runtime sources under `src/lib/productionGateway*`, `src/lib/router*`, and `src/lib/sandbox*`.
- OPA/Rego policy under `policy/`, including `eap.routing` and `eap.sandbox`, plus routing, sandbox, and tenant data documents.
- Python SQLGlot/DuckDB/Presidio data guard under `scripts/data_guard.py`.
- Release, container, deploy-smoke, SBOM/audit, OPA bundle, and skill-registry validation scripts under `scripts/`.
- Unit, component, system, E2E, failure, security, regression tests under `tests/` and `tests_py/`.
- Documentation, requirements, and traceability under `docs/`.
- Validation logs and evidence artifacts under `artifacts/`.
- Skill registry, promotion, optimization-loop, and AutoSkill evidence under `.orchestration/skills/` and `.orchestration/autoskill/`.

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
- `artifacts/sbom/python-cyclonedx.json`
- `artifacts/policy/bundle.tar.gz`
- `artifacts/validation/final_verification_report.json`

## Validation command

```bash
npm run validate-release
```

The attached validation report shows every release gate passed in this environment using bundled Node `v22.19.0` from the npm `node` package.

`npm run validate-release` runs 23 local release gates: setup, specification traceability, formatting, linting, typechecking, OPA adapter checks, Python compile/lint/type/security/tests, Vitest suites, production gateway contract, Flue build, E2E artifact assertions, npm audit/SBOM, Python SBOM/audit, lockfile registry validation, native OPA tests, OPA bundle build, and skill-registry validation. CI additionally runs container validation, deploy smoke, and OpenSandbox integration.
