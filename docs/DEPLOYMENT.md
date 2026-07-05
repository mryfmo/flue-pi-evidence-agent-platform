# Deployment

## Target

This package is a single-host OSS-integrated release. It uses Flue runtime, OPA binary from npm, SQLGlot, DuckDB, Presidio, OpenTelemetry, Biome, TypeScript, Vitest, pytest, Bandit, and npm audit/SBOM gates. It does not require Docker or Kubernetes.

## Requirements

- `npm` capable of installing from `package-lock.json`.
- Python 3.13-compatible environment for the `.venv` created by `scripts/setup-python.mjs`.
- Network/package registry access during dependency installation only.

The project depends on the npm `node` package pinned in `package-lock.json`, so scripts use `./node_modules/node/bin/node` instead of assuming the host Node version.

## Fresh checkout procedure

```bash
npm ci
./node_modules/node/bin/node scripts/setup-python.mjs
npm run validate-release
```

## Build and run

```bash
npm run flue:build
npm run flue:e2e
```

## Release validity

The release artifact is valid only when `npm run validate-release` passes. If any gate fails, no final package should be created.

## Runtime notes

The deterministic local gateway is used for repeatable Flue/Pi validation. Production model routing can replace `src/lib/localGateway.ts` behind the same typed boundaries, but the release gate intentionally avoids external LLM nondeterminism.
