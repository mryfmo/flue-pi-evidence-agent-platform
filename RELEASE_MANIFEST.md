# Release Manifest

Package: `flue-pi-evidence-agent-platform`
Version: `1.2.0`
Release status: determined only by current bound validation evidence

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
- Promoted skill material and registry policy under `.orchestration/skills/`.
- Generated validation, policy-bundle, SBOM, and runtime evidence artifacts are published separately and are not self-referential release-source inputs.

## Excluded generated dependencies

`node_modules/` and `.venv/` are intentionally excluded from the release ZIP. They are restored by:

```bash
npm ci
./node_modules/node/bin/node scripts/setup-python.mjs
```

Dependency lock files are release-source inputs:

- `package-lock.json`
- `requirements.txt`
- `uv.lock`

`uv.lock` is bound as release-source metadata; its inclusion does not by itself prove hermetic dependency resolution.

Generated SBOMs, the OPA bundle, logs, and final validation report are outputs of the bound validation run. Their publication must preserve the artifact digests recorded by local or trusted CI evidence; they are not entries in `RELEASE_FILE_MANIFEST.json`.

## Validation command

```bash
npm run validate-release
```

`scripts/validation-manifest.mjs` defines the canonical ordered gate commands. `RELEASE_FILE_MANIFEST.json` deterministically binds the intended current source inputs, including relevant untracked bytes, while excluding itself and mutable generated output. Regenerate and commit it before validation; `--check` rejects missing, extra, duplicate, noncanonical, symlinked, or digest-mismatched entries.

`npm run validate-release` runs every canonical local gate, records the exact executable and argument vector for every result, and binds the report to the clean Git revision and source bytes. `scripts/ops-check.mjs` must accept that report against the same repository state. Those local records prove integrity and replay/source binding only in a trusted workspace; they are not cryptographic execution authenticity against a hostile local writer. CI additionally runs container validation, deploy smoke, and OpenSandbox integration, and production release authenticity requires live authenticated GitHub job/log/artifact binding. No current CI success is claimed by this manifest alone.
