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

Outputs:
- allow
- requires_approval
- deny_reason

Fail-closed behavior is implemented in `src/lib/opa.ts`. If the OPA binary is missing or policy evaluation fails, the decision is `allow=false` and `requires_approval=true`.
