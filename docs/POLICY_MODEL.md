# Policy Model

OPA is the authority for side-effect permission.

Inputs:
- user
- tenant
- tool
- risk
- resource

Data:
- `policy/tenants.json` is loaded into OPA as `data.eap.tenants.allowed`.
- Agent, routing, and sandbox policies allow only tenants present in that list.
- Missing or empty tenant data does not satisfy the allow rules, so tenant authorization fails closed.

Bundle:
- `scripts/opa-bundle.mjs` builds `artifacts/policy/bundle.tar.gz` from `policy/` with the git short SHA as the OPA bundle revision.
- Bundle serving and distribution are deployment concerns outside the local policy model.

Outputs:
- allow
- requires_approval
- deny_reason

Fail-closed behavior is implemented in `src/lib/opa.ts`. If the OPA binary is missing or policy evaluation fails, the decision is `allow=false` and `requires_approval=true`.
