# Validation Plan

## Release rule

`npm run validate-release` is the only command that may produce a locally releasable state. A package is invalid if the release source tree is dirty, its file manifest is stale, any binding changes during the run, or any gate fails. `scripts/validation-manifest.mjs` is the sole ordered gate-command source; each entry binds the exact executable and argument vector used by `scripts/validate-release.mjs` and verified by `scripts/ops-check.mjs`.

Before running validation, generate `RELEASE_FILE_MANIFEST.json` with `./node_modules/node/bin/node scripts/validation-manifest.mjs --write-release-files`, review the release input set, commit it, and run validation from a clean tree. The deterministic manifest enumerates the filesystem independently of Git ignore rules and covers every relevant tracked or untracked repository file except explicit non-release worklogs/plans, dependency/build directories, mutable `artifacts/`, and the manifest itself; `.orchestration/skills/` is deliberately included. It rejects missing and extra paths, duplicates, traversal/noncanonical paths, non-files, symlinks, file-mode/byte-count/SHA-256 mismatches, and Git assume-unchanged or skip-worktree flags. Generated validation output is excluded from the self-referential source digest and bound separately where applicable.

The final JSON records the Git revision, canonical source-tree digest, scoped dirty-state digest, validation-script digest, ordered gate-manifest digest, release-file-manifest digest, run ID, and an evidence digest over the exact report fields. Every gate also has a canonical execution record bound to the same run/source/manifest, exact command, result, stdout/stderr digests, and generated SBOM digest where applicable. Canonical JSON sorts object keys by code point and preserves array order; the source digest hashes UTF-8 NFC path, executable mode, byte count, and byte SHA-256 records sorted by path. Unknown fields, missing/replayed execution records, and reports older than 24 hours fail closed. The timestamp limit is additional to exact source and command bindings, never the source-freshness proof.

These local hashes and execution records provide integrity, completeness, and replay/source binding only inside a trusted clean workspace. They do not authenticate execution against a hostile local process that can rewrite the report, records, and logs together; no local signing authority is configured, and the project must not claim one. `ops-check --evidence-only` is a local integrity diagnostic, never release or CI authentication. Production release authenticity additionally requires `ci-evidence-check.mjs` to obtain live authenticated GitHub run/job/log/artifact data and bind the immutable uploaded bytes to the selected successful job and current source. A caller-supplied local report, even if internally consistent and accepted by `ops-check --evidence-only`, cannot substitute for that CI proof.

## Gates

| Gate | Purpose | Evidence |
| --- | --- | --- |
| `setup_python` | create/update `.venv` and install Python OSS dependencies | `artifacts/validation/setup_python.*.log` |
| `spec_traceability` | verify documentation and requirement-to-implementation/test links | `artifacts/validation/spec_traceability.*.log` |
| `format` | enforce Biome formatting | `artifacts/validation/format.*.log` |
| `lint` | enforce Biome lint rules | `artifacts/validation/lint.*.log` |
| `typecheck` | enforce TypeScript strict contracts | `artifacts/validation/typecheck.*.log` |
| `opa` | exercise real OPA/Rego allow, deny, tenant, and shell policies | `artifacts/validation/opa.*.log` |
| `litellm_config` | verify the governed LiteLLM configuration contract | `artifacts/validation/litellm_config.*.log` |
| `python_compile` | compile the Python data guard | `artifacts/validation/python_compile.*.log` |
| `python_ruff` | lint Python support code | `artifacts/validation/python_ruff.*.log` |
| `python_mypy` | type-check Python data guard | `artifacts/validation/python_mypy.*.log` |
| `python_bandit` | run Python static security scan | `artifacts/validation/python_bandit.*.log` |
| `python_tests` | run SQLGlot/DuckDB/Presidio tests with coverage | `artifacts/validation/python_tests.*.log` |
| `vitest_all` | run unit, component, system, E2E, failure, security, and regression tests | `artifacts/validation/vitest_all.*.log` |
| `skill_lifecycle_node` | run the Node skill-lifecycle contract tests | `artifacts/validation/skill_lifecycle_node.*.log` |
| `llm_contract` | validate production gateway routing, redaction, audit digests, fail-closed, and fallback behavior with mock providers | `artifacts/validation/llm_contract.*.log` |
| `flue_build` | build the Flue Node target | `artifacts/validation/flue_build.*.log` |
| `e2e_artifacts` | assert ledger, evidence, audit, and OpenTelemetry artifacts from E2E | `artifacts/validation/e2e_artifacts.*.log` |
| `npm_audit_prod` | check production Node dependencies for high-severity advisories | `artifacts/validation/npm_audit_prod.*.log` |
| `npm_sbom_prod` | emit CycloneDX SBOM for production Node dependencies | `artifacts/sbom/npm-cyclonedx.json` |
| `python_sbom` | emit CycloneDX SBOM for Python virtualenv dependencies | `artifacts/sbom/python-cyclonedx.json` |
| `python_audit` | check Python virtualenv dependencies for known advisories | `artifacts/validation/python_audit.*.log` |
| `lockfile_registry` | assert npm lockfile resolved URLs use the public registry origin | `artifacts/validation/lockfile_registry.*.log` |
| `opa_test` | run native Rego unit tests for agent, routing, and sandbox policy packages | `artifacts/validation/opa_test.*.log` |
| `opa_bundle` | build a versioned OPA bundle for policy artifact publication | `artifacts/validation/opa_bundle.*.log`, `artifacts/policy/bundle.tar.gz` |
| `skill_registry` | validate Skill registry frontmatter and Hermes-subset boundary markers | `artifacts/validation/skill_registry.*.log` |

## CI-only gates

CI verification uses exactly `scripts/ci-evidence-check.mjs --run-id-file FILE --workflow NAME --job JOB_KEY --require-current-source`. The checker itself invokes authenticated `gh api` calls for the run, jobs, job logs, artifact metadata, and artifact ZIP; caller-authored run metadata is rejected. It resolves the job key, display name, and upload-artifact name from the committed workflow, requires the selected successful job log to identify the exact Artifact ID/name, verifies the API SHA-256 over the downloaded ZIP, and binds the run SHA to the current clean revision/tree.

For `validate-release` (and container evidence containing the same layout), the ZIP must contain the canonical passing final report, all ordered gate records and stdout/stderr logs, and both bound SBOMs; missing, extra, stale, or recomputed partial sets fail. Other job-specific artifacts must contain a canonical root `ci-source-binding.json` with exact fields `schemaVersion`, `repository`, `workflow`, `job`, `runId`, `runAttempt`, `commitSha`, `sourceTreeDigest`, and `files`; `files` is the complete byte-sorted list of all other archive files as exact `{path,bytes,sha256}` entries. Immediately before upload, each job or matrix leg generates it with `EAP_CI_WORKFLOW=validate-release ./node_modules/node/bin/node scripts/validation-manifest.mjs --write-ci-source-binding artifacts/<job-evidence>`; the command reads `GITHUB_REPOSITORY`, `GITHUB_JOB`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, and `GITHUB_SHA`, rejects dirty/mismatched source, and writes the binding inside that directory. Current `opensandbox-integration` artifacts predate this record, so this document does not claim they already satisfy the new checker. For a static matrix, the checker derives the Cartesian leg count from the committed workflow, requires every matching REST job to succeed, and ties a unique dynamically named artifact to each leg through that leg's authenticated log; missing legs fail. Dynamic, `include`, or `exclude` matrices fail closed until their owning WU defines an explicit static contract.

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

A local run is internally valid only when `scripts/ops-check.mjs` verifies the complete schema-closed report against the current clean repository, exact ordered commands, every passed result, and every source/manifest digest. A copied, partial, reordered, duplicated, dirty, stale, or modified report is invalid even if it still contains the word `passed`. This local result remains inside the trusted-workspace boundary and is not production release authentication without the live CI binding above.
