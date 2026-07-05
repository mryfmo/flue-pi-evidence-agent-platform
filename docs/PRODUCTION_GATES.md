# Production Gate Catalog

This catalog is an input to the final release judgment. It records gates that already exist; it does not add gates.

## Local Release Gates

`npm run validate-release` runs these 23 gates and writes `artifacts/validation/final_verification_report.json`.

| Gate | What it proves | Evidence location | Runs | §14-3 mapping |
| --- | --- | --- | --- | --- |
| `setup_python` | Python validation environment can be recreated. | `artifacts/validation/setup_python.*.log` | local, CI validate-release | supply-chain baseline |
| `spec_traceability` | Required docs and JSON traceability links are present. | `artifacts/validation/spec_traceability.*.log` | local, CI validate-release | release governance |
| `format` | TypeScript/source formatting is stable. | `artifacts/validation/format.*.log` | local, CI validate-release | release governance |
| `lint` | Biome lint rules pass. | `artifacts/validation/lint.*.log` | local, CI validate-release | release governance |
| `typecheck` | Strict TypeScript contracts compile. | `artifacts/validation/typecheck.*.log` | local, CI validate-release | release governance |
| `opa` | Agent policy allows/denies expected operations through the runtime adapter. | `artifacts/validation/opa.*.log` | local, CI validate-release | release governance |
| `python_compile` | Python data guard syntax compiles. | `artifacts/validation/python_compile.*.log` | local, CI validate-release | additional supply-chain/data governance |
| `python_ruff` | Python lint rules pass. | `artifacts/validation/python_ruff.*.log` | local, CI validate-release | additional supply-chain/data governance |
| `python_mypy` | Python data guard types pass. | `artifacts/validation/python_mypy.*.log` | local, CI validate-release | additional supply-chain/data governance |
| `python_bandit` | Python static security scan has no blocking findings. | `artifacts/validation/python_bandit.*.log` | local, CI validate-release | additional supply-chain validation |
| `python_tests` | SQLGlot, DuckDB, Presidio, and data guard behavior pass with coverage. | `artifacts/validation/python_tests.*.log` | local, CI validate-release | additional supply-chain/data governance |
| `vitest_all` | Unit, component, system, E2E, failure, security, and regression tests pass. | `artifacts/validation/vitest_all.*.log` | local, CI validate-release | release governance |
| `llm_contract` | Production gateway contract, redaction, audit digests, fail-closed, and fallback behavior pass. | `artifacts/validation/llm_contract.*.log` | local, CI validate-release | real LLM / mock contract test |
| `flue_build` | Flue Node target builds. | `artifacts/validation/flue_build.*.log` | local, CI validate-release | release governance |
| `e2e_artifacts` | Ledger, audit, telemetry, and validation artifacts exist after E2E. | `artifacts/validation/e2e_artifacts.*.log` | local, CI validate-release | release governance |
| `npm_audit_prod` | Production Node dependencies have no high-severity audit findings. | `artifacts/validation/npm_audit_prod.*.log` | local, CI validate-release | additional supply-chain validation |
| `npm_sbom_prod` | Production Node dependency SBOM is emitted. | `artifacts/sbom/npm-cyclonedx.json` | local, CI validate-release | additional supply-chain validation |
| `python_sbom` | Python virtualenv dependency SBOM is emitted. | `artifacts/sbom/python-cyclonedx.json` | local, CI validate-release | additional supply-chain validation |
| `python_audit` | Python dependencies have no blocking known advisories. | `artifacts/validation/python_audit.*.log` | local, CI validate-release | additional supply-chain validation |
| `lockfile_registry` | npm lockfile resolved URLs use the public registry origin. | `artifacts/validation/lockfile_registry.*.log` | local, CI validate-release | additional supply-chain validation |
| `opa_test` | Native Rego tests pass for agent, routing, and sandbox policy packages. | `artifacts/validation/opa_test.*.log` | local, CI validate-release | release governance |
| `opa_bundle` | Versioned OPA policy bundle is built for publication. | `artifacts/validation/opa_bundle.*.log`, `artifacts/policy/bundle.tar.gz` | local, CI validate-release | release governance |
| `skill_registry` | Skill registry frontmatter and Hermes-subset boundaries are valid. | `artifacts/validation/skill_registry.*.log` | local, CI validate-release | Hermes subset violation gate |

## CI-Only Gates

| Gate | What it proves | Evidence location | Runs | §14-3 mapping |
| --- | --- | --- | --- | --- |
| `validate-release` job | Linux CI can run all 23 local release gates and retain evidence. | `.github/workflows/validate-release.yml`, uploaded `validate-release-evidence` artifact | CI | CI automation / release governance |
| `container-validate` job | Release validation image builds and runs validation in a container. | `.github/workflows/validate-release.yml`, `artifacts/container-validation/validation/final_verification_report.json` | CI | container build validation |
| `deploy-smoke` step | Built container runs deterministic smoke and `/health` returns HTTP 200. | `.github/workflows/validate-release.yml`, `scripts/deploy-smoke.sh`, `.orchestration/acceptance/P2-T08.acceptance.md` | CI | deploy smoke |
| `opensandbox-integration` job | Pinned OpenSandbox server and sandbox image pass create, file transfer, exec, artifact cap, env isolation, egress deny, and audit tests. | `.github/workflows/validate-release.yml`, `tests/integration/opensandbox.test.ts`, `.orchestration/acceptance/P2-T06c.acceptance.md` | CI | sandbox execution isolation log |

## Process Gates

| Gate | What it proves | Evidence location | Runs | §14-3 mapping |
| --- | --- | --- | --- | --- |
| agmsg delegation log | Worker delegation and results are recorded through agmsg. | `.orchestration/agmsg/history.jsonl`, `.orchestration/acceptance/` | process | agmsg delegation log validation |
| acceptance records | Orchestrator accepted each task with validation reasons. | `.orchestration/acceptance/*.acceptance.md` | process | release governance |
| AutoSkill dry-run and triage | Redacted task reports generated candidates; triage left promotion decisions to the orchestrator. | `.orchestration/autoskill/runs/p2t07b-acceptance4.autoskill.md`, `.orchestration/skills/TRIAGE.md`, `.orchestration/acceptance/P4-T03.acceptance.md` | process | AutoSkill redaction / candidate generation |
| SkillOpt held-out cycle | Remediator skill candidate passed held-out validation before promotion. | `.orchestration/skills/candidates/remediator/cycle-1.verdict.json`, `.orchestration/acceptance/P4-T01.acceptance.md` | process | SkillOpt continuous improvement |
| Skill promotion gate | Promoted skill has version, provenance, rollback metadata, and validation evidence. | `.orchestration/skills/promoted/remediator/best_skill.md`, `skill_registry` | local, CI, process | skill promotion gate |
| Hermes subset policy | Skill material excludes Hermes runtime markers and stays in the allowed SKILL.md subset. | `.orchestration/skills/hermes_subset_policy.md`, `scripts/check-skill-registry.mjs`, `skill_registry` | local, CI, process | Hermes subset violation gate |

## §14-3 Checklist Mapping

| §14-3 production-gate requirement | Implemented gate(s) | Status |
| --- | --- | --- |
| Container build validation | `container-validate` CI job, `scripts/container-validate.sh` | implemented and accepted in P2-T02/P2-T03 |
| Deploy smoke | `deploy-smoke` CI step, `scripts/deploy-smoke.sh` | implemented and accepted in P2-T08 |
| Real LLM connectivity or contract test | `llm_contract` local gate with mock provider contract | implemented and accepted in P1-T03b |
| Additional supply-chain validation | `npm_audit_prod`, `npm_sbom_prod`, `python_sbom`, `python_audit`, `lockfile_registry`, `python_bandit` | implemented and accepted in P2-T04 |
| agmsg delegation log validation | agmsg history plus acceptance records | implemented as process evidence |
| Sandbox execution isolation log | `opensandbox-integration` CI job plus sandbox audit events | implemented and accepted in P2-T06c |
| AutoSkill redaction and candidate-generation gate | AutoSkill redacted-input dry-run plus triage records | implemented and accepted in P2-T07b/P4-T03 |
| Hermes Skill Subset scope violation gate | `skill_registry` gate and Hermes subset policy | implemented and accepted in P4-T04 |
| SkillOpt continuous improvement gate | held-out cycle verdict plus promoted skill provenance | implemented and accepted in P4-T01 |

## Release Judgment Inputs

- Local releasability: `artifacts/validation/final_verification_report.json` must contain `"status": "passed"` with all 23 local gates passed.
- CI releasability: GitHub Actions `validate-release`, `container-validate`, and `opensandbox-integration` jobs must be green.
- Process releasability: agmsg history and acceptance records must cover delegated productionization tasks; promoted skills must cite validation evidence and rollback metadata.
