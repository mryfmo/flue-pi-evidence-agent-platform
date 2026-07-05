# Deployment

## Target

This package is a single-host OSS-integrated release. It uses Flue runtime, OPA binary from npm, SQLGlot, DuckDB, Presidio, OpenTelemetry, Biome, TypeScript, Vitest, pytest, Bandit, and npm audit/SBOM gates. It does not require Docker or Kubernetes.

## Requirements

- `npm` capable of installing from `package-lock.json`.
- Python 3.13-compatible environment for the `.venv` created by `scripts/setup-python.mjs`.
- Network/package registry access during dependency installation only.

The project depends on the npm `node` package pinned in `package-lock.json`, so scripts use `./node_modules/node/bin/node` instead of assuming the host Node version.
OPA is installed through per-platform optional npm packages for linux arm64/x64 and darwin arm64/x64. `src/lib/opa.ts` picks the package matching `process.platform` and `process.arch`; set `EAP_OPA_BINARY` only when overriding that bundled binary.

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

## Container Validation

The validation container is an OCI image for running the same `npm run validate-release` gate set in Linux. It is a validation image, not a minimal production-serving image: it contains Node 22, Python 3, npm dependencies, the Python `.venv`, and the repository test fixtures needed by the release gates.

The Dockerfile builds for the container runtime's native Linux architecture. OPA resolves from optional npm packages for both `linux-x64` and `linux-arm64`, so Apple container can run natively on Apple Silicon without amd64 emulation.

Using Docker:

```bash
docker build -t flue-pi-eap:validate .
docker run --rm -v "$PWD/artifacts/container-validation:/app/artifacts" flue-pi-eap:validate
```

Using Apple container:

```bash
container build -t flue-pi-eap:validate .
container run --rm -v "$PWD/artifacts/container-validation:/app/artifacts" flue-pi-eap:validate
```

Or use the runtime-agnostic runner:

```bash
scripts/container-validate.sh
```

## Runtime notes

The deterministic local gateway is used for repeatable Flue/Pi validation. Production model routing can replace `src/lib/localGateway.ts` behind the same typed boundaries, but the release gate intentionally avoids external LLM nondeterminism.
