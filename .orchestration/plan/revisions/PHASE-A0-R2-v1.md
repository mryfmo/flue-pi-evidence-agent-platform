# Plan Revision PHASE-A0-R2-v1

## Decision

Approved by the orchestrator as a command-only clarification under the plan deviation procedure. It changes no product scope, production topology, credential handling, data access, policy rule, trust boundary, dependency, WU count, GAP mapping, or canonical runtime policy path.

## Source evidence

- Deviation request: `.orchestration/reports/PHASE-A0-R2.deviation-request.md`
- Blocked command: `opa eval --data policy ...`, exit `2`, `policy/routing.prod.json: merge error`
- Root cause: OPA recursively merges both independent flat runtime inputs `policy/routing.json` and `policy/routing.prod.json` into one base-data root.
- False-green risk: `--fail` does not fail for a defined `false`, and `not data.eap.*.allow` succeeds if the intended module is absent.

## Exact plan diff

1. Increment plan revision from `P9-T02-v4` to `P9-T02-v5`.
2. In A0-01, A0-03, and A0-05 direct routing checks, replace `--data policy` with `--data policy/routing.rego --data policy/tenants.json`, require the fixture-specific deny reason, and execute `production_contract_routing_valid.json` with `data.eap.routing.allow = true` as a positive control.
3. In A0-02 direct agent checks, replace `--data policy` with `--data policy/agent.rego --data policy/tenants.json`, require `body_identity_forbidden`, and execute `identity_valid.json` with `data.eap.agent.allow = true` as a positive control.
4. Apply the same explicit dependencies, three deny reasons, and two positive controls to Phase A0 Exit and the final Production Ready gate.
5. Preserve every runtime JSON path and policy byte unchanged.

## Affected work

- WUs: A0-01, A0-02, A0-03, A0-05 (verification command clarification only)
- Gates: Phase A0 Exit and Production Ready direct OPA counterexamples
- SPEC/GAP/dependencies: unchanged

## Replacement verification

- Each negative query must exit `0` only when both `not allow` and its exact deny reason are defined.
- Both positive-control queries use unification `allow = true` and must exit `0`.
- Running without the intended Rego module must exit nonzero.
- `./node_modules/node/bin/node plans/validate-production-plan.mjs` must exit `0`.

## Deferred separate gap

OPA bundle staging/data layout is not changed here. The observed empty bundle `data.json` must be incorporated into the existing F1-04 bundle implementation task or a separately approved new gap before that WU starts.
