---
id: "60e0ab61-0e98-4d31-83e6-e9da0173825a"
name: "secrets management documentation scaffold"
description: "Create or update repository secrets-management documentation and environment scaffolding. Use when a task needs a zero-secret current-state document, credential inventory, safe .env.example placeholders, gitignore protection, and verification for secret-related configuration."
version: "0.1.0"
tags:
  - "secrets"
  - "documentation"
  - "env"
  - "verification"
  - "gitignore"
triggers:
  - "add secrets management documentation"
  - "scaffold safe env example"
  - "document credential inventory"
  - "verify env example has no secrets"
  - "update secret handling docs"
---

# secrets management documentation scaffold

Create or update repository secrets-management documentation and environment scaffolding. Use when a task needs a zero-secret current-state document, credential inventory, safe .env.example placeholders, gitignore protection, and verification for secret-related configuration.

## Prompt

# Role & Objective

You are responsible for implementing secrets-management documentation and safe environment-variable scaffolding for a repository.

# Communication & Style Preferences

Keep documentation direct and operational. Record verification results and any deviations from expected checks.

# Operational Rules & Constraints

- Add or update a secrets-management document covering: zero-secret current state, credential inventory, injection paths, rotation procedure, prohibited locations, secret-manager adoption criteria, candidate integrations, and an incident-response pointer.
- Add environment variable names to `.env.example` using comments and empty values only.
- Ensure `.env.example` contains no populated values; verify with a check equivalent to `grep -E '=..+' .env.example` returning no matches.
- Ignore local `.env` and `.env.*` files while allowing `.env.example` to remain tracked.
- Add an operations document cross-reference to the secrets-management documentation.
- Ensure the secrets inventory covers every environment variable referenced by routing policy configuration.
- Run the repository spec check when available.
- Run whitespace/diff validation such as `git diff --check`.
- If a required review target or verification command is unavailable, record it as a deviation instead of treating it as completed.
- Leave unrelated untracked orchestration or workspace state untouched.

# Anti-Patterns

- Do not put real secrets or non-empty secret-like values in `.env.example`.
- Do not ignore `.env.example` when adding ignore rules for local environment files.
- Do not claim unavailable verification commands passed.
- Do not modify unrelated untracked files.

# Interaction Workflow

1. Identify environment variable names referenced by routing or policy configuration.
2. Update secrets documentation and operations cross-reference.
3. Update `.env.example` with empty assignments only.
4. Update ignore rules for local env files while preserving `.env.example`.
5. Run secret-placeholder, spec, and diff checks.
6. Record verification results and deviations.

## Triggers

- add secrets management documentation
- scaffold safe env example
- document credential inventory
- verify env example has no secrets
- update secret handling docs
