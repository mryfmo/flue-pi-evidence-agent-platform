# Secrets Management

## Scope And Current State

The validated platform currently requires zero secrets. Release validation uses deterministic local and mock providers, so no live provider key is needed for `npm run validate-release`, CI, or contract tests.

Production provider credentials become required only when external or self-hosted routes are enabled in `policy/routing.json`. Until that point, configured provider entries store environment variable names only.

LiteLLM Proxy custody and virtual-key rules are defined in `docs/LITELLM_PROXY.md`.

This design uses environment-variable injection now. Managed secret store integration is a later step and is not implemented here.

## Inventory

| Env var name | Consumer | When required | Rotation owner |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | Production gateway `anthropic` provider | Anthropic production routes are enabled. | Operations owner for Anthropic provider access. |
| `OPENAI_API_KEY` | Production gateway `openai` provider | OpenAI production routes or fallback are enabled. | Operations owner for OpenAI provider access. |
| `VLLM_BASE_URL` | Production gateway `vllm` provider | Self-hosted OpenAI-compatible routes are enabled. | Platform operator for the self-hosted endpoint. |
| `VLLM_API_KEY` | Production gateway `vllm` provider | Self-hosted OpenAI-compatible routes require authentication. | Platform operator for the self-hosted endpoint. |
| `EAP_OPA_BINARY` | OPA adapter | Optional local or incident override for the bundled OPA binary. | Platform operator. |

## Injection Paths

### Local Development

Operators may create a local `.env` file from `.env.example` and load it in their shell before running a live-provider smoke. The application does not require `.env` for deterministic release validation.

`.env` and `.env.*` are gitignored. `.env.example` is committed with variable names and empty values only.

### Single-Host Service

For a single-host service, inject secrets through the service manager environment or an environment file owned by the service account. The file must be readable only by that account, for example mode `0600`.

Restart the service after changing a secret, then run the live-provider smoke described by operations.

### CI

No normal CI gate requires secrets. `llm_contract` is mock-only, and release validation must stay deterministic.

If an operator performs a manual live-provider smoke through GitHub Actions later, use GitHub Actions secrets for that manual workflow only. Do not add secrets to scheduled, push, or pull-request validation jobs.

## Rotation Procedure

1. Create the replacement key or endpoint credential with the provider.
2. Update the local/service/CI secret value outside the repository.
3. Restart or rerun the process that consumes the environment.
4. Run the operations live-provider smoke for the affected route.
5. Revoke the old credential after the smoke passes.
6. Review audit JSONL and telemetry for provider, route, and fallback evidence; do not expect raw key material to appear there.

## Prohibited Locations

Secrets must never be stored or pasted in:

- repository files, including routing config values;
- logs or validation artifacts;
- audit JSONL;
- agmsg messages;
- OpenTelemetry attributes or traces;
- pull request comments, issues, or chat transcripts.

The production gateway invariants in `docs/PRODUCTION_GATEWAY_DESIGN.md` remain authoritative: keys are environment-injected, never logged, never written to audit, never sent in agmsg, and missing keys fail closed before dispatch.

## Secret-Manager Adoption Criteria

Adopt a managed secret store when any of these becomes true:

- the platform runs on more than one host;
- more than one operator needs credential administration;
- compliance requires access audit, centralized rotation, or envelope encryption;
- manual rotation becomes operationally unreliable.

Candidate integrations to evaluate later:

- HashiCorp Vault;
- cloud KMS or cloud secret managers;
- 1Password CLI;
- platform-native service manager secret injection.

This task documents candidates only. It does not implement a secret store integration.

## Incident Response

For suspected exposure: revoke the credential, rotate the value, verify with an operations smoke, then review audit and telemetry evidence for unexpected provider calls or fallbacks.
