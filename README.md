# Flue + Pi Evidence Agent Platform

This package is a Flue + Pi OSS-integrated evidence-driven remediation and governed data-analysis agent platform.

## What is actually integrated

- Flue runtime and CLI (`@flue/runtime`, `@flue/cli`)
- Pi model harness through Flue's `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai` dependencies
- A local OpenAI-compatible gateway that exercises Pi's `openai-completions` provider path without an external LLM key
- OPA through a real bundled `opa` binary package
- SQLGlot, DuckDB, and Presidio through the Python data guard
- OpenTelemetry registration through Flue's OpenTelemetry observer adapter
- Biome, TypeScript strict mode, Vitest, pytest, and Flue workflow E2E validation

## Reproduce the release validation

```bash
python -m pip install -r requirements.txt
npm install --ignore-scripts --no-audit --no-fund
npm rebuild node
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
3. Localizes a divide-by-zero defect in `sample_repos/buggy_calc`.
4. Evaluates the patch operation through OPA/Rego.
5. Applies the safe divide patch.
6. Runs pytest verification.
7. Runs a governed data query through SQLGlot + DuckDB + Presidio.
8. Writes audit evidence under `artifacts/audit/`.

## Scope

This is not a Docker/Kubernetes deployment. It is a single-host Flue + Pi integrated release with real OSS components and executable release gates.
