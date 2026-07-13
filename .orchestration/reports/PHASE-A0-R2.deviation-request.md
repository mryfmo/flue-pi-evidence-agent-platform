# PHASE-A0-R2 Deviation Request

## Status

blocked

## Protocol Step

Deviation protocol step 1 only: record the plan/runtime conflict and request an
orchestrator-owned plan revision. This report does not authorize or apply a
plan, policy, runtime-policy-document, fixture, or validation-script change.

## Blocked DoD

Phase A0 cannot satisfy the direct OPA evaluation checkbox in
`plans/001-production-work-plan.md:903`. The command exits `2`, rather than the
required `0`, before any counterexample is evaluated:

```text
{
  "errors": [
    {
      "message": "policy/routing.prod.json: merge error"
    }
  ]
}
```

Consequently, Phase A0 evidence must not be marked `status: passed`, and the
same direct-evaluation checkbox in the final gate at
`plans/001-production-work-plan.md:971` is also blocked.

## Conflicting Plan Text and Locations

The plan treats `policy/` simultaneously as:

1. an OPA `--data` directory whose JSON files are merged into one base-data
   document; and
2. the canonical location of two independent, flat runtime documents passed as
   `input.policy`: `policy/routing.json` and `policy/routing.prod.json`.

Those two uses are incompatible with `opa eval --data policy` because both flat
documents define overlapping root keys such as `version`, `defaults`, `routes`,
and `providers`.

Affected A0 task text:

- A0-01 DoD and verification: lines 110-112 use `--data policy`.
- A0-02 DoD and verification: lines 128-129 use `--data policy`.
- A0-03 DoD and verification: lines 146-147 use `--data policy`.
- A0-05 DoD and verification: lines 181-182 use `--data policy`.
- Phase A0 Exit: line 903 uses `--data policy` for all three direct checks.
- Final gate: line 971 repeats the same command.

A0-04, A0-06, A0-07, and A0-08 already name individual Rego files and do not
cause this JSON merge conflict.

The current negative expressions at lines 110, 112, 128-129, 146-147,
181-182, 903, and 971 also rely on `not data.*.allow` without always requiring
a policy-specific deny reason. That can false-green when the intended package
is not loaded: an undefined `data.eap.routing.allow` makes
`not data.eap.routing.allow` true.

## Source and Experiment Evidence

### OPA loading semantics

- Installed binary: OPA `0.70.0`.
- Its `opa eval --help` states that `--data` recursively loads all `*.rego`,
  `*.json`, and `*.yaml` files below a directory.
- Official CLI reference states the same:
  <https://www.openpolicyagent.org/docs/cli>.
- `scripts/opa-test.mjs` already avoids the conflict by passing
  `--ignore routing*.json`; the Phase A0 direct command does not.

### Exact repository reproduction

The planned command prefix was executed without repository edits:

```sh
OPA=./node_modules/agent-control-specification-opa-darwin-arm64/bin/opa
$OPA eval --fail --data policy \
  --input tests/fixtures/policy/routing_missing_classification.json \
  'not data.eap.routing.allow'
```

Observed result: `policy/routing.prod.json: merge error`, exit `2`.

An isolated `/tmp` experiment with two different files that both contained the
identical JSON object `{"x":1}` also produced a merge error on the second file,
exit `2`. Equality of overlapping values does not make the directory layout
valid.

Replacing the two runtime documents with symlinks in an isolated `/tmp`
directory did not help; OPA followed the symlinks and produced the same merge
error. Wrapping, moving, or renaming the canonical runtime documents is
therefore neither necessary nor an acceptable A0 repair.

### Explicit dependency experiment

The following dependencies loaded without merge errors:

```text
routing checks: policy/routing.rego + policy/tenants.json
agent checks:   policy/agent.rego + policy/tenants.json
```

With those dependencies, all proposed negative checks and both positive
controls below exited `0` and returned the expected decision/reason.

### `--fail` false-green experiment

OPA `--fail` fails on an undefined query, not on a defined boolean `false`:

```text
query: false                         exit: 0
query: false == true                 exit: 0
query: false = true                  exit: 1
query: not data.eap.routing.allow    exit: 0 when routing module is absent
```

Positive controls must therefore use unification (`allow = true`), not a bare
boolean term or `allow == true`. Negative controls must require a named deny
reason so an absent module remains undefined and exits nonzero.

## Requested Plan Revision

Preserve the accepted flat `input.policy` contract and both canonical paths.
Do not wrap, move, rename, or convert `policy/routing.json` or
`policy/routing.prod.json` into OPA base data.

Replace directory-wide direct evaluation with explicit dependencies:

```text
routing: --data policy/routing.rego --data policy/tenants.json
agent:   --data policy/agent.rego --data policy/tenants.json
```

Replace the Phase A0 and final-gate command with checks equivalent to:

```sh
OPA_BIN="$(./node_modules/node/bin/node --input-type=module -e "import { opaBinary } from './src/lib/opa.ts'; process.stdout.write(opaBinary())")"

"$OPA_BIN" eval --fail \
  --data policy/routing.rego --data policy/tenants.json \
  --input tests/fixtures/policy/routing_missing_classification.json \
  'not data.eap.routing.allow; data.eap.routing.deny_reason["missing_classification"]'

"$OPA_BIN" eval --fail \
  --data policy/routing.rego --data policy/tenants.json \
  --input tests/fixtures/policy/routing_default_unknown.json \
  'not data.eap.routing.allow; data.eap.routing.deny_reason["unknown_route"]'

"$OPA_BIN" eval --fail \
  --data policy/agent.rego --data policy/tenants.json \
  --input tests/fixtures/policy/identity_forged_body.json \
  'not data.eap.agent.allow; data.eap.agent.deny_reason["body_identity_forbidden"]'

"$OPA_BIN" eval --fail \
  --data policy/routing.rego --data policy/tenants.json \
  --input tests/fixtures/policy/production_contract_routing_valid.json \
  'data.eap.routing.allow = true'

"$OPA_BIN" eval --fail \
  --data policy/agent.rego --data policy/tenants.json \
  --input tests/fixtures/policy/identity_valid.json \
  'data.eap.agent.allow = true'
```

Revise the affected A0 DoD/verification commands consistently:

- A0-01: explicit routing dependencies; require
  `missing_classification` and `unknown_route`; include the routing positive
  control.
- A0-02: explicit agent dependencies; require
  `body_identity_forbidden`; include the agent positive control.
- A0-03: explicit routing dependencies; require
  `synthetic_output_not_local_non_evidence`; include the routing positive
  control.
- A0-05: explicit routing dependencies; require at least the contract-specific
  `unknown_route` result for the old wrapped document; include the routing
  positive control.

After plan revision, rerun the corrected direct checks for A0-01, A0-02,
A0-03, and A0-05 before accepting Phase A0. Historical acceptance prose is not
a substitute for executing the corrected commands.

Using `--ignore 'routing*.json'` is a working tactical alternative, but is not
the requested durable repair: explicit dependencies avoid future merge
failures from any unrelated JSON file added under `policy/` and make the
evaluated trust inputs reviewable.

## Separate New Gap: OPA Bundle Layout

This gap is recorded for separate planning and must not be fixed under
PHASE-A0-R2.

Experiment:

```sh
opa build -b policy -o /tmp/flue-pi-policy-current.tar.gz
```

The command exited `0`, but the bundle contained `/data.json` with exactly
`{}`. It did not contain tenant data or either runtime routing document. This
matches the official bundle rule that only files named `data.json` or
`data.yaml` are loaded as bundle data; arbitrary JSON files are ignored:
<https://www.openpolicyagent.org/docs/management-bundles>.

Therefore `scripts/opa-bundle.mjs` currently proves only that a non-empty
archive was written, not that the declared policy data is present or usable.
A separate WU must decide the bundle data layout/staging contract and add a
content assertion. PHASE-A0-R2 must neither alter bundle layout nor silently
claim this new gap is closed.

## Requested Orchestrator Action

1. Approve and apply the plan revision above through the plan-deviation
   protocol.
2. Delegate the corrected direct checks and record new evidence.
3. Keep Phase A0 and the final gate blocked until those checks pass.
4. Register and schedule the separate OPA bundle-layout gap without folding it
   into this repair.
