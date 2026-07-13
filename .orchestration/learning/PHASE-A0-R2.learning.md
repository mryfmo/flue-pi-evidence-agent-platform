# PHASE-A0-R2 learning record

status: recorded
promotion: not_performed

## Reusable finding

OPA `eval --fail` rejects an undefined query but does not reject a defined
boolean `false`. A fail-closed command that checks only `not data.pkg.allow`
can therefore false-green when `data.pkg` was never loaded. Direct policy gates
should load explicit dependencies, bind denial to an expected named reason,
and pair negative cases with a positive control using unification
(`allow = true`).

## Application

The accepted plan revision applies this rule to A0-01, A0-02, A0-03, A0-05,
Phase A0 Exit, and Production Ready. The three module-omission checks and two
wrong-expectation checks in the validation log demonstrate that the revised
queries fail when their proof mechanism is removed or inverted.

## Deferred separate gap

The OPA bundle data-layout omission remains a separately recorded planning gap.
It was neither modified nor treated as closed by this verification-only task.
