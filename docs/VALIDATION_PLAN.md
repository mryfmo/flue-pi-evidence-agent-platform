# Validation Plan

## Release rule

`npm run validate-release` is the only command that may produce a releasable state. A package is invalid if any gate fails. The command writes command stdout/stderr, final JSON, final Markdown, and SBOM artifacts under `artifacts/validation/` and `artifacts/sbom/`.

## Gates

| Gate | Purpose | Evidence |
| --- | --- | --- |
| `setup_python` | create/update `.venv` and install Python OSS dependencies | `artifacts/validation/setup_python.*.log` |
| `spec_traceability` | verify documentation and requirement-to-implementation/test links | `artifacts/validation/spec_traceability.*.log` |
| `format` | enforce Biome formatting | `artifacts/validation/format.*.log` |
| `lint` | enforce Biome lint rules | `artifacts/validation/lint.*.log` |
| `typecheck` | enforce TypeScript strict contracts | `artifacts/validation/typecheck.*.log` |
| `opa` | exercise real OPA/Rego allow, deny, tenant, and shell policies | `artifacts/validation/opa.*.log` |
| `python_compile` | compile the Python data guard | `artifacts/validation/python_compile.*.log` |
| `python_ruff` | lint Python support code | `artifacts/validation/python_ruff.*.log` |
| `python_mypy` | type-check Python data guard | `artifacts/validation/python_mypy.*.log` |
| `python_bandit` | run Python static security scan | `artifacts/validation/python_bandit.*.log` |
| `python_tests` | run SQLGlot/DuckDB/Presidio tests with coverage | `artifacts/validation/python_tests.*.log` |
| `vitest_all` | run unit, component, system, E2E, failure, security, and regression tests | `artifacts/validation/vitest_all.*.log` |
| `flue_build` | build the Flue Node target | `artifacts/validation/flue_build.*.log` |
| `e2e_artifacts` | assert ledger, evidence, audit, and OpenTelemetry artifacts from E2E | `artifacts/validation/e2e_artifacts.*.log` |
| `npm_audit_prod` | check production Node dependencies for high-severity advisories | `artifacts/validation/npm_audit_prod.*.log` |
| `npm_sbom_prod` | emit CycloneDX SBOM for production Node dependencies | `artifacts/sbom/npm-cyclonedx.json` |
| `python_sbom` | emit CycloneDX SBOM for Python virtualenv dependencies | `artifacts/sbom/python-cyclonedx.json` |
| `python_audit` | check Python virtualenv dependencies for known advisories | `artifacts/validation/python_audit.*.log` |
| `lockfile_registry` | assert npm lockfile resolved URLs use the public registry origin | `artifacts/validation/lockfile_registry.*.log` |

## Test taxonomy

- Unit: ledger closure rules.
- Component: code localization/patching, OPA adapter, data proxy.
- System: Flue build and Flue/Pi path smoke.
- E2E: issue -> localization -> policy -> patch -> verify -> data guard -> closure.
- Failure: high-risk action, shell tool, unsafe SQL, verifier failure.
- Security: guest/cross-tenant denial and raw SQL denial.
- Regression: closure gate cannot pass without complete evidence.

## Exit criteria

A run is releasable only when `final_verification_report.json` contains `"status": "passed"` and every listed result is `passed`.
