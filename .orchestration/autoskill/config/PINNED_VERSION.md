# AutoSkill Pinned Version

## Source

- Repository: `https://github.com/ECNU-ICALK/AutoSkill`
- Default branch reviewed: `main`
- Pinned commit: `94c47ca488d4ba4117d20272e66d49b9877e68cf`
- Review date: 2026-07-05
- Review clone: `/private/tmp/p2t07a-autoskill-review`

## License

- Task fixed decision: MIT license verified.
- Repository evidence: `README.md` and `README.zh-CN.md` display an MIT license badge.
- Review finding: no root `LICENSE` file was present in the reviewed checkout, so acceptance should preserve the pinned SHA and rely on the task's prior MIT verification unless upstream adds a root license file.

## Packaging And Dependencies

- `pyproject.toml` project name: `autoskill`
- Python requirement: `>=3.9`
- Build backend: `setuptools.build_meta`
- Build requirements: `setuptools>=68`, `wheel`
- Runtime dependencies declared by `pyproject.toml`: none.
- PyPI metadata lookup, 2026-07-05:
  - `setuptools`: latest `83.0.0`, installed host version `82.0.1`.
  - `wheel`: latest `0.47.0`.
- Console scripts:
  - `autoskill = autoskill.cli:main`
  - `autoskill4doc = AutoSkill4Doc.extract:main`

## Review Findings

- No PyPI release was used; the Dockerfile pins the Git commit SHA.
- The upstream Dockerfile uses `python:3.10-slim` and editable local source. This task uses `python:3.11-slim`, clones by SHA, installs normally, and runs as a non-root user.
- `AutoSkill4Doc` extraction requires a real LLM provider unless mock is explicitly allowed.
- OpenAI-compatible configuration is available through:
  - `--llm-provider openai` with `--llm-base-url` / `--llm-api-key`, or `OPENAI_BASE_URL` / `OPENAI_API_KEY`.
  - `--llm-provider generic` with `AUTOSKILL_GENERIC_LLM_URL` and optional `AUTOSKILL_GENERIC_API_KEY`.
  - Matching embedding options: `--embeddings-base-url`, `--embeddings-api-key`, `OPENAI_BASE_URL`, `AUTOSKILL_GENERIC_EMBED_URL`.
- Concerning permissions: LLM and embedding clients perform outbound network calls when extraction runs. The P2-T07a container CMD performs only `python -m autoskill --help` and bakes in no API keys.
- Concerning code paths for later T07b: optional offline conversation self-evolution modules can invoke `codex exec`; do not enable those paths in the AutoSkill dry-run container.
- Upstream deviation for P2-T07b: pinned commit `94c47ca488d4ba4117d20272e66d49b9877e68cf` imports `autoskill.offline.conversation.utils.ban_mock` but the reviewed checkout has no `autoskill/offline/conversation/utils/` package. `Dockerfile.autoskill` creates the missing package at build time with only the imported fail-closed guard functions. This should become an upstream issue if the pin remains.

## Reproduction

```bash
git clone https://github.com/ECNU-ICALK/AutoSkill /private/tmp/p2t07a-autoskill-review
cd /private/tmp/p2t07a-autoskill-review
git checkout 94c47ca488d4ba4117d20272e66d49b9877e68cf
```
