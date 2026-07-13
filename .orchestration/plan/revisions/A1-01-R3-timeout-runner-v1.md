# Plan Revision A1-01-R3-timeout-runner-v1

## Decision

Approved under the plan deviation procedure using the user's standing authorization. The synchronized full run reached `vitest_all` and failed with exit 127 because macOS has no GNU `timeout`; the same non-portable dependency appears in `llm_contract`, `npm_audit_prod`, and `npm_sbom_prod`. Preserve time limits without adding a dependency or using shell command strings.

## Exact implementation contract

1. Add `scripts/run-with-timeout.mjs` using only Node standard-library process APIs. CLI is `./node_modules/node/bin/node scripts/run-with-timeout.mjs <seconds> <executable> [args...]`. `<seconds>` must match `^(?:[1-9][0-9]{0,3})$` (integer 1..9999); malformed arguments exit 64 and spawn failure exits 127 with a concise message.
2. Execute with `shell: false`; inherit stdin, and pipe stdout/stderr through the runner while forwarding their bytes unchanged. On POSIX, use `detached: true` and signal the negative PID process group. Timeout grace is exactly 2000 ms. The deadline callback owns a one-way timeout latch: if it runs before child close, send `SIGTERM`, ignore close as a settlement event, always attempt group `SIGKILL` after 2000 ms even if the leader exited, then exit 124. `ESRCH` during either timeout kill is benign; after the final grace attempt, any other group-kill error tears down stdout/stderr forwarding and forces a bounded exit 70. If close wins before the deadline, clear timers/listeners and propagate numeric exit 0..255, or `128 + os.constants.signals[signal]` for a known signal; unknown/unrepresentable close status exits 70. Settlement and cleanup occur once.
3. On non-POSIX systems use `detached: false` and the same latch/grace/exit rules against the direct child with `child.kill`; descendant-group guarantees are POSIX-only and must be documented. Current release gates target Linux/macOS.
4. Replace exactly these canonical tuples while keeping all 25 gate names/order unchanged:
   - `vitest_all`: executable `./node_modules/node/bin/node`; args `scripts/run-with-timeout.mjs`, `180`, `./node_modules/.bin/vitest`, `run`, `--pool=forks`
   - `llm_contract`: executable `./node_modules/node/bin/node`; args `scripts/run-with-timeout.mjs`, `120`, `./node_modules/.bin/vitest`, `run`, `tests/contract`, `--pool=forks`
   - `npm_audit_prod`: executable `./node_modules/node/bin/node`; args `scripts/run-with-timeout.mjs`, `60`, `npm`, `audit`, `--audit-level=high`, `--omit=dev`
   - `npm_sbom_prod`: executable `./node_modules/node/bin/node`; args `scripts/run-with-timeout.mjs`, `60`, `npm`, `sbom`, `--omit=dev`, `--sbom-format=cyclonedx`, `--json`
5. `scripts/validate-release.mjs` must retain its existing 120-second outer `spawnSync` watchdog for every non-runner gate. For the four exact runner tuples only, the outer timeout must be omitted so it cannot preempt the authoritative runner, bypass its 124 result, or orphan its detached descendants. Tests must prove the discriminator matches only those four exact tuples; malformed/lookalike runner tuples remain under the outer watchdog and are rejected by manifest checks.
6. Do not use `bash -lc`, GNU `timeout`, `npx`, shell interpolation, or a new package. Preserve stdout artifact handling for `npm_sbom_prod`.

## Adversarial verification

- Real CLI success and exact nonzero exit propagation.
- Boundary invalid timeouts (`0`, leading zero, decimal, sign, nonnumeric, `10000`), missing executable, and spawn failure reject with the exact codes above.
- Timeout exits 124 after the 2000 ms grace and terminates a spawned descendant on POSIX. The fixture must use a child-to-test readiness file/IPC handshake, bounded polling, and a `finally` cleanup/kill; a sleep-only assertion is forbidden.
- Direct-child close after the timeout latch cannot cancel the final group `SIGKILL`; close-before-deadline, timeout-before-close, known signal, and spawn-error outcomes are independently tested.
- Canonical manifest has 25 unchanged names/order, contains no shell timeout string, binds the four literal tuples above, and tests the exact outer-watchdog discriminator.
- Focused runner tests, A1 manifest tests, format, lint, typecheck, and diff pass before manifest regeneration.

## Exit sequence

Implementation and independent cold review must pass, then regenerate the 283-file manifest, commit/push a clean synchronized checkpoint, and restart the full 25-gate run from gate 1. Partial prior evidence is never reused.
