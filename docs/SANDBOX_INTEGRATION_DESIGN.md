# OpenSandbox Product Integration Design

## Purpose And Scope

OpenSandbox is the product-required execution-isolation layer for remediation workspace operations. It isolates workspace preparation, patch application, pytest verification, artifact collection, and rescanning from the host kernel and host filesystem.

This document defines the target product architecture only. It does not install the OpenSandbox SDK, change CI, change Rego, or edit product source.

The design follows the production gateway coexistence pattern: keep the deterministic local implementation for release validation, and add the product runtime behind a typed boundary.

## Current State

The current remediation workflow calls `src/lib/code.ts` directly:

1. `prepareWorkspace(source)` copies a repository into `artifacts/demo/workspace/<repo>-<pid>-<uuid>`.
2. `scanWorkspace(workspace)` reads files from that copied tree.
3. `applySelectedPatches(workspace, candidates)` edits files in that copied tree.
4. `verifyWorkspace(workspace)` runs `python -m pytest -q` directly on the host through `execFile`.
5. `scanWorkspace(workspace)` rescans the copied tree.

This gives filesystem separation from the source repository, but not kernel, process, network, or runtime-image isolation. The host environment can still influence pytest execution through binaries, environment variables, interpreter packages, and filesystem access reachable from the process.

## Runtime Model

Runtime selection is explicit:

```text
EAP_SANDBOX_RUNTIME=local|opensandbox
```

Default:

```text
EAP_SANDBOX_RUNTIME=local
```

Implementations:

- `LocalWorkspaceExecutor`: wraps the current `src/lib/code.ts` behavior. This remains the `validate-release` path so all release gates stay deterministic and runnable on macOS and CI.
- `OpenSandboxExecutor`: product path for remediation workspace execution. It connects to a pinned OpenSandbox server and runs workspace operations inside a sandbox created from pinned images.

No silent fallback is allowed. If `EAP_SANDBOX_RUNTIME=opensandbox` and OpenSandbox is unavailable, remediation fails closed. Degrading to local execution requires an explicit operator config change to `EAP_SANDBOX_RUNTIME=local`.

## Typed Contract

T06b should extract a TypeScript contract shaped like this:

```ts
export type SandboxRuntime = 'local' | 'opensandbox';

export interface SandboxSpec {
  image: {
    name: string;
    tag: string;
    digest: string;
  };
  limits: {
    cpu: string;
    memoryMb: number;
    timeoutMs: number;
  };
  network: {
    egress: 'deny' | 'allow';
    policyId?: string;
  };
  env?: Record<string, string>;
  audit_id: string;
  trace_id: string;
}

export interface SandboxHandle {
  id: string;
  runtime: SandboxRuntime;
  audit_id: string;
  trace_id: string;
}

export interface SandboxFile {
  path: string;
  content: Uint8Array | string;
  mode?: number;
}

export interface SandboxExecOptions {
  timeoutMs: number;
  audit_id: string;
  trace_id: string;
}

export interface SandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface SandboxExecutor {
  create(spec: SandboxSpec): Promise<SandboxHandle>;
  putFiles(handle: SandboxHandle, files: SandboxFile[]): Promise<void>;
  exec(
    handle: SandboxHandle,
    argv: string[],
    options: SandboxExecOptions,
  ): Promise<SandboxExecResult>;
  collectArtifacts(
    handle: SandboxHandle,
    paths: string[],
    options: { maxBytes: number; audit_id: string; trace_id: string },
  ): Promise<SandboxFile[]>;
  destroy(handle: SandboxHandle): Promise<void>;
}
```

Every operation carries `audit_id` and `trace_id`. Implementations may add internal provider IDs, but product workflow code should depend only on this contract.

## Remediation Flow

Target product path:

```text
remediate workflow
  -> choose SandboxExecutor from EAP_SANDBOX_RUNTIME
  -> create pinned sandbox with limits and default-deny network
  -> put workspace files into sandbox
  -> scan/localize through typed code operation
  -> apply selected patch inside sandbox
  -> exec pytest inside sandbox
  -> rescan inside sandbox
  -> collect capped artifacts
  -> destroy sandbox
  -> append audit and telemetry evidence
```

The local implementation can preserve the current direct function calls internally. The OpenSandbox implementation must perform filesystem transfer and command execution through the OpenSandbox server rather than host `execFile`.

## Security Invariants

| # | Invariant | Enforcement point | Test idea |
| --- | --- | --- | --- |
| 1 | No credentials or host environment leak into sandboxes. | `SandboxSpec.env` defaults to empty; only an explicit allowlist can inject variables. The executor must not pass `process.env` wholesale. | Contract test sets host-only variables and asserts sandbox `env` output cannot see them. |
| 2 | Network egress is denied by default per sandbox. | `SandboxSpec.network.egress` defaults to `deny`; any `allow` requires OPA authorization through new package `eap.sandbox` using the existing fail-closed adapter posture. | CI contract test attempts outbound access in the default sandbox and expects failure; separate OPA deny test asserts no sandbox starts with egress allowed. |
| 3 | Artifact retrieval is artifact-only and size-capped. | `collectArtifacts(handle, paths, {maxBytes})` only returns requested sandbox paths and refuses over-cap payloads. No host secret paths or repo-external paths are mounted. | Test requests an allowed small artifact and an over-cap artifact; the first succeeds and the second fails closed. |
| 4 | Lifecycle events are audited. | `src/lib/audit.ts` records create, exec, collect, and destroy events with image tag, image digest, limits, command digest, artifact digests, `audit_id`, and `trace_id`. | Test reads audit JSONL and asserts lifecycle events exist without raw secret values or full file contents. |
| 5 | `opensandbox` runtime fails closed with no silent fallback. | Runtime factory and workflow preflight: server unreachable, SDK failure, image mismatch, or OPA failure returns a typed remediation failure. | Contract test points to an unreachable OpenSandbox server with `EAP_SANDBOX_RUNTIME=opensandbox` and asserts local execution is not called. |

## OPA Policy Boundary

OpenSandbox egress and high-risk sandbox capabilities require a new Rego package:

```text
data.eap.sandbox
```

The package should be evaluated through the same OPA adapter style as `src/lib/opa.ts`. Missing OPA, missing policy, malformed input, or deny all fail closed.

Minimum policy input:

```json
{
  "tenant": "tenant-id",
  "user": "user-id",
  "sandbox": {
    "runtime": "opensandbox",
    "image": "name:tag@digest",
    "network": "deny",
    "limits": {
      "cpu": "1",
      "memoryMb": 1024,
      "timeoutMs": 30000
    }
  },
  "operation": "create|exec|collect|destroy",
  "audit_id": "audit-id",
  "trace_id": "trace-id"
}
```

## Version Pinning

OpenSandbox artifacts must never use `latest`.

Required pins:

- npm SDK `@alibaba-group/opensandbox`: exact package version, verified and pinned by T06c.
- OpenSandbox server: image tag plus digest, recorded in config.
- Sandbox base image: image tag plus digest, recorded in config.

The research record says OpenSandbox is Apache 2.0, local runtime requires Docker, Kubernetes is the scale runtime, npm SDK is available as `@alibaba-group/opensandbox`, server release `0.2.1` existed as of 2026-06-29, and prebuilt sandbox images include `opensandbox/code-interpreter` tags. T06c must verify final versions and digests before implementation.

## Verification Strategy

Local release validation remains unchanged:

- `validate-release` continues using `LocalWorkspaceExecutor`.
- Existing gates stay deterministic and runnable without Docker.
- macOS development hosts are not required to run the Docker-based OpenSandbox runtime.

New CI-only job:

```text
opensandbox-integration
```

Runner:

- GitHub Actions ubuntu runner.
- Docker available on the runner.

Job behavior:

1. Start the pinned OpenSandbox server.
2. Run contract tests for `create`, `putFiles`, `exec`, `collectArtifacts`, and `destroy`.
3. Assert default egress denial.
4. Assert credential and host environment isolation.
5. Assert artifact size caps.
6. Assert lifecycle audit evidence.
7. Upload evidence logs as CI artifacts.

This job is CI-only because macOS development hosts using Apple container do not provide the Docker API required by the OpenSandbox local runtime.

## Migration Plan

### T06b

Scope:

- Extract the `SandboxExecutor` interface.
- Refactor `src/lib/code.ts` behind `LocalWorkspaceExecutor`.
- Preserve current behavior.
- Add contract tests for local create, file transfer, exec, artifact collection, destroy, and failure paths.
- Keep all existing release gates green.

Non-scope:

- No OpenSandbox SDK.
- No CI OpenSandbox job.
- No new runtime dependency.

### T06c

Scope:

- Add `OpenSandboxExecutor` through pinned `@alibaba-group/opensandbox`.
- Add `eap.sandbox` policy for sandbox network/capability authorization.
- Add `opensandbox-integration` CI job on ubuntu with Docker.
- Pin OpenSandbox SDK, server image, and sandbox base image.
- Add contract tests for credential isolation, default egress deny, lifecycle audit, artifact caps, and no silent fallback.

Non-scope:

- No Kubernetes runtime.
- No gVisor, Kata, Firecracker, or other stronger runtime adoption.
- No replacement of the deterministic local release path.

## Out Of Scope

- Installing the OpenSandbox SDK in this task.
- Editing CI in this task.
- Editing source code in this task.
- Kubernetes runtime adoption.
- Stronger runtime adoption such as gVisor, Kata, or Firecracker.
- Secret-manager integration.
- Allowing LLM or sandbox output to authorize side effects.

## Traceability Proposals

These are proposed IDs only. This task does not edit traceability files.

| Proposed ID | Requirement | Evidence target |
| --- | --- | --- |
| REQ-SANDBOX-001 | The product shall support OpenSandbox as the required execution-isolation layer for remediation workspace operations. | T06c implementation and `opensandbox-integration` CI evidence. |
| REQ-SANDBOX-002 | OpenSandbox runtime failures shall fail closed with no silent fallback to local execution. | Contract test with unreachable server and audit evidence. |
| REQ-SANDBOX-003 | Sandboxes shall isolate credentials and deny network egress by default. | Credential-isolation and egress-deny CI contract tests. |
| REQ-SANDBOX-004 | Sandbox lifecycle operations shall emit audit evidence. | Audit JSONL assertions for create, exec, collect, and destroy. |

## Open Questions

- `docs/SANDBOX_INTEGRATION_DESIGN.md` defines OpenSandbox as a product-required isolation layer, while `.orchestration/sandboxes/POLICY.md` is still v1 and describes OpenSandbox as unavailable on the local macOS host. T06b or T06c should update the sandbox policy document to separate product runtime requirements from developer-host fallback.
- T06c must choose and pin exact OpenSandbox npm SDK version, server image digest, and sandbox base image digest.
- T06c must define the final `eap.sandbox` input schema and policy file layout.
- T06c must decide the evidence artifact paths for the `opensandbox-integration` CI job.
