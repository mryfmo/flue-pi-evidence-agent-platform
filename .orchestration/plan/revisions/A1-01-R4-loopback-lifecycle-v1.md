# Plan Revision A1-01-R4-loopback-lifecycle-v1

**Planned at:** `aa04655432c6527360f570d0122cd99e0cb587f5` (A0-07 tests-only checkpoint)

## Goal

Repair only the two test loopback fixtures that can remain pending for 90 seconds when `listen()` fails. Startup must either return a valid `127.0.0.1` address, reject with the original bind error, or abort the pending listen and reject after exactly 2,000 ms. Every successfully started fixture must close in a literal `try/finally` at its test call site.

This revision is a test-lifecycle repair. It does not change production behavior, policy semantics, release gates, or unrelated failing assertions.

## Decision

Use Node 22.19's native `server.listen({ host, port, signal })` cancellation with one private `AbortController`. Do not build a custom close state machine. The deadline transition marks the Promise settled, removes helper listeners, clears its timer, then calls `abort()` before rejecting. This prevents a pending listen from becoming a residual late-listening server.

The official Node 22.19 documentation establishes that:

- `server.listen()` is asynchronous and emits `listening` on success;
- `server.listen(options)` has supported `AbortSignal` since Node 15.6;
- aborting that signal is similar to calling `server.close()`;
- port `0` selects an OS-assigned port, readable only after `listening`.

Reference: <https://nodejs.org/download/release/v22.19.0/docs/api/net.html#serverlistenoptions-callback>

The repository pins `node: 22.19.0` in `package.json`, so this requires no dependency or runtime-version change.

## Preconditions and stop conditions

- [ ] Obtain independent cold-review acceptance of this revised plan before any implementation edit.
- [ ] Confirm A1-01-R3 remains accepted and do not modify its runner or gate tuples.
- [ ] Confirm the orchestrator-designated source checkpoint is `aa04655432c6527360f570d0122cd99e0cb587f5` (A0-07 tests-only checkpoint), or obtain an explicit replacement checkpoint before implementation.
- [ ] Capture `git status --short` and hashes of the two existing permitted files before editing.
- [ ] Confirm exactly two resolve-only startup helpers: `tests/failure/llm_outage.test.ts:35-43` and `tests/contract/llm_contract.test.ts:21-45`.
- [ ] Confirm exactly 13 live-server consumers: one in `llm_outage.test.ts` and 12 in `llm_contract.test.ts`.

**Stop:** return to the orchestrator without editing if the checkpoint, inventory, or permitted files differ; if another worker changed a permitted file; or if the repair requires any forbidden file. Never restore or absorb unrelated dirty-worktree changes.

## Exact scope

Implementation may create or edit only:

1. `tests/helpers/loopback-server.ts` — new minimal startup helper.
2. `tests/unit/loopback_server.test.ts` — new focused lifecycle tests.
3. `tests/failure/llm_outage.test.ts` — migrate one fixture and one consumer.
4. `tests/contract/llm_contract.test.ts` — migrate one fixture and 12 consumers.

No orchestration evidence file is part of the implementation diff. The executor returns command output to the orchestrator; the orchestrator owns later evidence persistence and acceptance updates.

## Forbidden changes

- No edits to `src/**`, including the separate follow-up risk at `src/lib/localGateway.ts:121`.
- No edits to policy, routing, schemas, production gateway behavior, existing assertion meaning, or the known unrelated policy/gateway/test drift.
- No edits to `vitest.config.ts`, `package.json`, lockfiles, dependencies, Node versions, R3 runner files, gate commands, manifests, generated release reports, tasks, main plans, acceptance files, or orchestrator state.
- No skip, retry, environment-based bypass, swallowed bind error, wider timeout, mocked replacement for existing real HTTP behavior, global registry, or shared `afterEach` cleanup.
- No configurable host, port, timeout, class, factory, dependency injection, or exported close helper.
- No stage, commit, push, manifest regeneration, full suite, or release run before implementation cold-review acceptance.

Any forbidden change means the implementation is rejected, not complete.

## Minimal helper contract

### Public API

`tests/helpers/loopback-server.ts` exports only:

```ts
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export function listenLoopback(server: Server): Promise<AddressInfo>;
```

Keep `2_000`, `127.0.0.1`, and port `0` private literals/constants. Do not export a deadline constant or a close function.

### Required behavior

1. Create one `AbortController`, one timer, and one-shot `error` and `listening` handlers inside the Promise.
2. Attach both handlers before calling:

   ```ts
   server.listen({ host: '127.0.0.1', port: 0, signal: controller.signal });
   ```

3. Use one settlement guard with terminal outcomes `listening`, `failed`, or `timed_out`. The winning path must mark settled before any abort, cleanup, resolve, or reject action.
4. Every terminal path clears the timer and removes only the helper's two server listeners. A late callback cannot settle again.
5. `error` and synchronous `listen()` throw paths abort the signal and reject with the exact original error object; `EPERM` and its fields must not be wrapped or translated.
6. The deadline path marks `timed_out`, removes listeners and clears the timer, aborts the signal, then rejects with a stable error message containing `2000ms`. It must not branch on `server.listening` and must not call a guarded no-op close.
7. The `listening` path reads `server.address()` only after that event, inside `try/catch`; a thrown error must use the same failed-startup path and preserve the original error object. Resolve only for an `AddressInfo` with address `127.0.0.1` and an integer port in `1..65535`.
8. An invalid address is a failed startup: mark settled, clean helper resources, abort the signal, and reject a concise invariant error.
9. A successful resolution clears the timer/listeners but does not abort; ownership transfers back to the fixture, whose existing `close()` is awaited in its test's `finally`.

The required order is `mark -> cleanup -> abort -> reject` for failed/timed-out startup and `mark -> cleanup -> resolve` for success.

The helper must not wait for a `close` event after abort. Node owns signal-driven cancellation; the tests must prove that no late `listening` occurs and `server.listening` remains false after the event loop advances.

## Call-site contract

- [ ] Both local fixture functions call `await listenLoopback(server)` and build their URL from the returned `AddressInfo`.
- [ ] Neither target file retains a callback-only `new Promise(... server.listen(...))` or reads `server.address()` directly.
- [ ] Preserve each fixture's existing return shape and local `close()` implementation unless a type-only mechanical adjustment is necessary.
- [ ] Wrap the one outage consumer and all 12 contract consumers literally:

```ts
const mock = await startMockProvider(/* existing argument */);
try {
  // Existing setup, request, and assertions stay semantically unchanged.
} finally {
  await mock.close();
}
```

- [ ] The `finally` is in the same test body as acquisition. Post-assertion close, global cleanup, or an indirect registry does not count.
- [ ] Static inventory after editing reports 13 acquisitions, 13 matching `finally` blocks, and 13 awaited local closes. Manually inspect all 13; counts alone are insufficient.

## Focused tests

Add only the following five behaviors to `tests/unit/loopback_server.test.ts`. Use fake timers for lifecycle failure cases and the 2,000 ms case, and restore every method/timer modification in `finally`.

### T1 — Original bind error

- [ ] On a real `Server` with instance-local `listen` replacement, capture the options, emit a deterministic error object with `code = 'EPERM'`, and prove rejection is the same object.
- [ ] Prove the options are exactly host `127.0.0.1`, port `0`, and a non-aborted `AbortSignal` when `listen` is invoked.
- [ ] Prove the signal is aborted after failure, the timer cannot later re-settle, and helper listener counts return to their baseline.

### T2 — Deadline cancels pending listen

- [ ] Replace only that server instance's `listen` with a deterministic pending-listen double that records the signal and would emit `listening` later only if the signal were not aborted.
- [ ] Advance fake time to 1,999 ms and prove the Promise remains pending and the signal is not aborted.
- [ ] Advance to 2,000 ms and prove one rejection whose message contains `2000ms`, and prove the signal is aborted before rejection observation.
- [ ] Advance timers and the event loop beyond the double's delayed-listening point; prove zero `listening` events, `server.listening === false`, no second settlement, and helper listener counts at baseline.

This test specifically rejects the superseded design where `server.listening === false` caused timeout cleanup to do nothing.

### T3 — Synchronous throw

- [ ] Make the instance-local `listen` throw one error synchronously.
- [ ] Prove rejection preserves that object, aborts the passed signal, clears the deadline, and restores helper listener counts.

### T4 — Real allowed loopback

- [ ] With the pinned `./node_modules/node/bin/node`, start a real HTTP server via `listenLoopback` in an environment that permits loopback bind.
- [ ] Send one real HTTP request, assert exact response bytes, and await the fixture close in `finally`.
- [ ] Prove `server.listening === false` after close. Do not mock the HTTP client, server events, or `fetch`.

### T5 — Address inspection throws

- [ ] On an instance-local server double, emit `listening` and make `server.address()` throw one deterministic error object.
- [ ] Prove rejection preserves that exact object, aborts the passed signal, clears the deadline, restores helper listener counts, and cannot settle a second time.
- [ ] An uncaught exception, pending Promise, or residual timer/listener fails this test.

No separate guarded-close, process-tree, address-fuzzing, or production-helper test belongs to R4.

## Execution checklist

### R4.1 — Red tests

- [ ] Add the test file and only the minimal compiling API skeleton.
- [ ] Demonstrate T1-T3 and T5 fail behaviorally for the missing contract; import, syntax, or tool failure is not a valid red result.
- **Complete when:** the red cause matches error propagation or abort cancellation, not infrastructure.

### R4.2 — Implement helper

- [ ] Implement the minimal API and exact signal-first lifecycle above.
- [ ] Run T1-T3 and T5 after each correction.
- **Complete when:** original errors, synchronous throws, and the exact 2,000 ms abort path pass with one settlement and baseline listener counts.

### R4.3 — Migrate consumers

- [ ] Migrate both fixtures.
- [ ] Add all 13 literal `try/finally` blocks without changing assertions.
- [ ] Perform static counts and manual diff review.
- **Complete when:** no resolve-only startup remains and acquisition/finally/close counts are 13/13/13.

### R4.4 — Environment verification

- [ ] In the restricted environment, run exactly `./node_modules/node/bin/node scripts/run-with-timeout.mjs 10 ./node_modules/.bin/vitest run tests/failure/llm_outage.test.ts --pool=forks`. Expected: prompt original `EPERM`, no 90-second test timeout, and no wrapper exit 124.
- [ ] In a loopback-allowed environment, run T4 and the two focused existing files. Expected: real HTTP lifecycle completes; unrelated existing assertion failures, if any, are reported unchanged and do not expand R4.
- [ ] If either environment is unavailable, mark only that observation `BLOCKED`; do not simulate it or infer success.
- **Complete when:** abort cancellation is deterministic in T2, restricted bind failure is prompt when available, and real HTTP is proven when available.

### R4.5 — Static quality

Run only these scoped checks:

```sh
./node_modules/.bin/vitest run tests/unit/loopback_server.test.ts --pool=forks
./node_modules/.bin/vitest run tests/failure/llm_outage.test.ts tests/contract/llm_contract.test.ts --pool=forks
./node_modules/.bin/biome format --diagnostic-level=error tests
npm run lint
npm run typecheck
git diff --check -- tests/helpers/loopback-server.ts tests/unit/loopback_server.test.ts tests/failure/llm_outage.test.ts tests/contract/llm_contract.test.ts
# Each no-index check below is successful only when it exits 1 because the new
# file differs from /dev/null and emits no whitespace diagnostic.
git diff --no-index --check /dev/null tests/helpers/loopback-server.ts
git diff --no-index --check /dev/null tests/unit/loopback_server.test.ts
```

- [ ] Record command, exit code, and relevant output for each check.
- [ ] Unit tests, format check, lint, and typecheck exit 0. The four-path tracked `git diff --check` exits 0. Each new-file `git diff --no-index --check` exits exactly 1 and emits no whitespace diagnostic; any other code or any diagnostic fails this check.
- [ ] Focused existing files terminate within their intended bound; unrelated assertion failures are reported separately and not called green.
- [ ] Compare final `git status --short` with the captured baseline. The executor-created delta contains only the four permitted paths.
- [ ] Inspect tracked diffs plus explicit content/diff for the two new untracked files; `git diff` alone is insufficient.
- **Complete when:** no R4-attributable failure or out-of-scope delta remains.

## Independent cold-review gate

Before manifest regeneration, full-suite/full-release execution, commit, or push, a fresh reviewer receives this plan and the four-file implementation diff. Acceptance requires:

- [ ] only the four permitted files changed;
- [ ] `listen(options)` receives the AbortSignal and both event handlers already exist;
- [ ] the timeout marks settlement before abort and rejects only after abort;
- [ ] error and throw paths preserve the original object;
- [ ] every terminal path clears the timer and removes helper listeners;
- [ ] T2 proves no late `listening` or residual listening server after timeout;
- [ ] all 13 call sites use literal awaited cleanup in `finally`;
- [ ] focused checks and environment results are reported truthfully;
- [ ] no policy, production, assertion, gate, manifest, or release change is present.

Any finding reopens its R4 task. If correction needs a forbidden file, stop and request another plan revision. Reviewer acceptance is not release acceptance.

## Prohibited until cold-review acceptance

Do not run a full `vitest run`, `scripts/validate-release.mjs`, validation-manifest generation, `make verify`, `make ops-check`, or any equivalent full gate. Do not alter the 283-file release manifest, final verification reports, acceptance records, checkpoint, or Git history. After acceptance, only the orchestrator may establish the next checkpoint and restart the full 25-gate run from gate 1; no partial evidence is reused.

## Definition of done

- [ ] Preconditions and exact four-file scope hold.
- [ ] Both fixtures use the AbortSignal-based helper.
- [ ] Original bind errors and synchronous throws reject unchanged.
- [ ] The exact 2,000 ms deadline aborts pending listen before rejection.
- [ ] T2 proves no late `listening`, no residual server, no second settlement, and no helper listener/timer leak.
- [ ] All 13 successful acquisitions close in literal awaited `finally` blocks.
- [ ] T1-T5 and scoped static checks meet their stated conditions.
- [ ] Restricted and allowed observations are truthful or explicitly blocked.
- [ ] Independent cold review has no open finding.
- [ ] No prohibited manifest, full-run, release, commit, or push action occurred.

## Plan quality self-check

- [x] Root cause and superseded unsafe design are explicit.
- [x] Native Node 22.19 behavior replaces custom lifecycle machinery.
- [x] Scope is four files with named forbidden areas and stop conditions.
- [x] Each task has atomic checks and a completion condition.
- [x] Timeout cancellation, late-event absence, error identity, success lifecycle, and 13 call-site cleanups have runnable evidence.
- [x] Unrelated process-tree and production concerns are excluded.
- [x] Cold review precedes manifest, full-run, and Git mutations.
