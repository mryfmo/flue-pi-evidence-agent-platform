# Flue + Pi Evidence Agent Platform

This package is a Flue + Pi OSS-integrated evidence-driven remediation and governed data-analysis agent platform.

## What is actually integrated

- Flue runtime and CLI (`@flue/runtime`, `@flue/cli`)
- Pi model harness through Flue's `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai` dependencies
- A local OpenAI-compatible gateway that exercises Pi's `openai-completions` provider path without an external LLM key
- A production gateway boundary with deterministic routing policy, redaction, audit, OTLP metrics, and mock-provider contract tests
- OPA through a real bundled `opa` binary package plus routing, sandbox, and tenant data documents
- A SandboxExecutor contract with local and OpenSandbox runtimes; OpenSandbox validation runs in CI with Docker
- SQLGlot, DuckDB, and Presidio through the Python data guard
- OpenTelemetry registration through Flue's OpenTelemetry observer adapter, with optional OTLP export
- Skill registry and optimization-loop evidence for promoted remediation skills
- Biome, TypeScript strict mode, Vitest, pytest, Flue workflow E2E validation, SBOM/audit/policy bundle gates, and 23 release gates

## Reproduce the release validation

```bash
python -m pip install -r requirements.txt
npm ci
./node_modules/node/bin/node scripts/setup-python.mjs
npm run validate-release
```

The validation artifacts are under `artifacts/validation/`.

## Key workflows

```bash
npm run flue:smoke
npm run flue:e2e
```

`flue:e2e` runs the `remediate` workflow, which:

1. Starts a local OpenAI-compatible gateway.
2. Runs Flue with Pi's provider path through `local-gateway/fixbot`.
3. Localizes three independent defects in `sample_repos/buggy_multi`.
4. Evaluates the patch operation through OPA/Rego.
5. Applies the patches.
6. Runs pytest verification.
7. Runs a governed data query through SQLGlot + DuckDB + Presidio.
8. Writes audit evidence under `artifacts/audit/`.

## Scope

This is a single-host Flue + Pi integrated release by default, with real OSS components and executable release gates. Containerized validation now exists through the Dockerfile, `scripts/container-validate.sh`, and the CI deploy smoke; GitHub Actions also runs release, container, and OpenSandbox validation. Kubernetes deployment remains out of scope.
