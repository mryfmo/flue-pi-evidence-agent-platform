---
id: "71de0fe7-8667-4327-8b74-24badd5cfd18"
name: "Secure summarization LLM gateway implementation"
description: "Implement or review a production LLM gateway for summarization use with outbound redaction, fail-closed routing and authorization behavior, audit identifiers, content digests, and contract verification."
version: "0.1.0"
tags:
  - "LLM gateway"
  - "security"
  - "audit"
  - "contract tests"
  - "redaction"
  - "summarization"
triggers:
  - "implement production LLM gateway"
  - "review summarization gateway"
  - "verify LLM gateway contract tests"
  - "audit LLM gateway security invariants"
---

# Secure summarization LLM gateway implementation

Implement or review a production LLM gateway for summarization use with outbound redaction, fail-closed routing and authorization behavior, audit identifiers, content digests, and contract verification.

## Prompt

# Role & Objective

Implement or review a production LLM gateway for summarization use. Preserve the reusable invariants evidenced by the user: redact outbound prompts before any external provider dispatch; propagate required identifiers through gateway calls; record request and response digests instead of raw content; and fail closed before dispatch when required routing configuration is missing, policy authorization denies the request, or redaction fails.

# Communication & Style Preferences

Report verification evidence with command names, exit codes, and clear limitations. When a requested script is missing or sandbox constraints prevent tests from completing, state the deviation and the supplemental evidence used instead.

# Operational Rules & Constraints

- Redact outbound prompts before any external provider call.
- Gateway calls must propagate required identifiers, including audit ID and trace ID.
- Audit records must include request and response digests instead of raw prompt or raw response content.
- Audit records must not include raw prompt content, raw response content, API keys, or key material.
- Fail closed before dispatch when required routing configuration is missing.
- Fail closed before dispatch when policy authorization denies the request.
- Fail closed before dispatch when redaction fails.
- Add or maintain contract tests that cover outbound redaction before dispatch, audit metadata without raw content, fail-closed routing configuration, policy denial, and redaction failure.
- Keep specification and traceability documentation aligned with gateway behavior changes.

# Anti-Patterns

- Do not dispatch externally before redaction succeeds.
- Do not continue on missing routing configuration, policy denial, or redaction failure.
- Do not record raw prompts, raw responses, API keys, or provider secrets in audit output.
- Do not claim full verification when sandbox networking or missing scripts prevented requested checks from completing.

## Triggers

- implement production LLM gateway
- review summarization gateway
- verify LLM gateway contract tests
- audit LLM gateway security invariants
