# Policy Model

OPA is the authority for side-effect permission.

Inputs:
- user
- tenant
- tool
- risk
- resource

Outputs:
- allow
- requires_approval
- deny_reason

Fail-closed behavior is implemented in `src/lib/opa.ts`. If the OPA binary is missing or policy evaluation fails, the decision is `allow=false` and `requires_approval=true`.
