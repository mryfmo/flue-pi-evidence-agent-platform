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
| `opa_test` | run native Rego unit tests for agent, routing, and sandbox policy packages | `artifacts/validation/opa_test.*.log` |
| `opa_bundle` | build a versioned OPA bundle for policy artifact publication | `artifacts/validation/opa_bundle.*.log`, `artifacts/policy/bundle.tar.gz` |

## CI-only gates

`opensandbox-integration` runs outside `npm run validate-release` on GitHub Actions ubuntu runners with Docker. It generates the official Docker-mode OpenSandbox config, mounts the Docker socket, starts `opensandbox/server:v0.2.1@sha256:a41670fa956864f116b9db696bd8d0781b6c709be9cac1e66e2981740b1fbeb4`, exercises `OpenSandboxExecutor` with `opensandbox/code-interpreter:v1.1.0@sha256:133a3c1720dd52291a019740c2987e7164ea6de79e23d8198798e58950ae2e6e`, and uploads server/audit evidence. Local macOS validation explicitly skips this gate unless `EAP_OPENSANDBOX_URL` points at a running server.

`deploy-smoke` runs as a step in the `container-validate` CI job after the release validation image succeeds. It reuses `flue-pi-eap:validate`, asserts `npm run flue:smoke` emits `ack:hello`, starts `dist/server.mjs` inside the image, and polls `/health` for HTTP 200.

## Test taxonomy

- Unit: ledger closure rules.
- Component: code localization/patching, OPA adapter, data proxy.
- System: Flue build and Flue/Pi path smoke.
- E2E: issue -> localization -> policy -> patch -> verify -> data guard -> closure.
- Held-out E2E: `npm run flue:e2e:heldout` exercises the fresh `buggy_heldout` fixture manually and is intentionally excluded from `npm run validate-release`.
- Failure: high-risk action, shell tool, unsafe SQL, verifier failure.
- Security: guest/cross-tenant denial and raw SQL denial.
- Regression: closure gate cannot pass without complete evidence.

## Exit criteria

A run is releasable only when `final_verification_report.json` contains `"status": "passed"` and every listed result is `passed`.
