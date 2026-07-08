# LiteLLM Proxy

LiteLLM Proxy is the provider adapter behind the platform gateway. It is not a second policy or redaction boundary.

## Runtime

Run the proxy on the same host as the platform gateway in a separated process environment, for example:

```sh
uvx litellm --config config/litellm/config.yaml
```

This repository does not vendor or install LiteLLM. The committed config is inspected by `scripts/check-litellm-config.mjs` and the `litellm_config` release gate.

## Network Boundary

The proxy must bind `127.0.0.1`. The platform gateway is the only intended caller. Block any non-local or direct agent access with OS-level firewall or service-manager rules.

## Key Custody

`ANTHROPIC_API_KEY` belongs only in the LiteLLM Proxy environment. Agents, Flue workflows, and the platform gateway receive LiteLLM virtual keys, not the upstream Anthropic key.

`LITELLM_MASTER_KEY` is the proxy administration key and must not be shared with agents or written to repository files, logs, audit JSONL, telemetry, agmsg, or chat transcripts.

## Virtual Keys

Issue virtual keys per Agent Profile. Each key must carry allowed models, budget ceiling, and rate limits. Budget exhaustion fails closed. The gateway must not silently downgrade to an unapproved cheaper model.

## Logging

`turn_off_message_logging: true` is mandatory. Success and failure callbacks use `platform_audit_forwarder`, which is reserved for metadata-only forwarding to the platform ledger.

If the LiteLLM Proxy DB is enabled later, release validation must prove message bodies are not persisted before production use.
