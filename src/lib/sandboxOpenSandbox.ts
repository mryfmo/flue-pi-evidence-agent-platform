import { posix as pathPosix } from 'node:path';
import {
  ConnectionConfig,
  Sandbox,
  type ConnectionProtocol,
  type Execution,
  type NetworkPolicy,
} from '@alibaba-group/opensandbox';
import { appendAudit } from './audit.ts';
import { evaluatePolicy } from './opa.ts';
import {
  SandboxRuntimeError,
  type SandboxExecOptions,
  type SandboxExecResult,
  type SandboxExecutor,
  type SandboxFile,
  type SandboxHandle,
  type SandboxSpec,
} from './sandbox.ts';

const remoteRoot = '/workspace';

interface OpenSandboxExecutorOptions {
  auditLog?: string;
}

export class OpenSandboxExecutor implements SandboxExecutor {
  private readonly auditLog: string;
  private readonly connectionConfig: ConnectionConfig;
  private readonly sandboxes = new Map<string, Sandbox>();

  constructor(options: OpenSandboxExecutorOptions = {}) {
    this.auditLog = options.auditLog ?? 'artifacts/audit/remediation.jsonl';
    const endpoint = process.env.EAP_OPENSANDBOX_URL;
    if (!endpoint) {
      throw new SandboxRuntimeError(
        'EAP_OPENSANDBOX_URL is required for opensandbox runtime',
      );
    }
    const url = new URL(endpoint);
    const protocol = url.protocol.replace(':', '') as ConnectionProtocol;
    const config = {
      domain: url.host,
      protocol,
      requestTimeoutSeconds: 30,
      useServerProxy: true,
      ...(process.env.EAP_OPENSANDBOX_API_KEY
        ? { apiKey: process.env.EAP_OPENSANDBOX_API_KEY }
        : {}),
    };
    this.connectionConfig = new ConnectionConfig(config);
  }

  async create(spec: SandboxSpec): Promise<SandboxHandle> {
    await this.enforcePolicy(spec);
    try {
      const sandbox = await Sandbox.create({
        connectionConfig: this.connectionConfig,
        image: `${spec.image.name}:${spec.image.tag}@${spec.image.digest}`,
        env: spec.env ?? {},
        networkPolicy: toOpenSandboxNetworkPolicy(spec),
        resource: {
          cpu: spec.limits.cpu,
          memory: `${spec.limits.memoryMb}Mi`,
        },
        timeoutSeconds: Math.ceil(spec.limits.timeoutMs / 1000),
        metadata: {
          audit_id: spec.audit_id,
          trace_id: spec.trace_id,
        },
      });
      await sandbox.files.createDirectories([{ path: remoteRoot }]);
      this.sandboxes.set(sandbox.id, sandbox);
      const handle = {
        id: sandbox.id,
        runtime: 'opensandbox' as const,
        audit_id: spec.audit_id,
        trace_id: spec.trace_id,
      };
      await this.audit('sandbox_create', {
        audit_id: spec.audit_id,
        trace_id: spec.trace_id,
        runtime: handle.runtime,
        sandbox_id: sandbox.id,
        image: spec.image,
        limits: spec.limits,
        network: spec.network,
        envKeys: Object.keys(spec.env ?? {}).sort(),
      });
      return handle;
    } catch (error) {
      throw new SandboxRuntimeError(
        `opensandbox create failed: ${errorMessage(error)}`,
      );
    }
  }

  async putFiles(handle: SandboxHandle, files: SandboxFile[]): Promise<void> {
    const sandbox = this.lookup(handle);
    const directories = [
      ...new Set(
        files
          .map((file) => pathPosix.dirname(remotePath(file.path)))
          .filter((path) => path !== remoteRoot),
      ),
    ];
    if (directories.length > 0) {
      await sandbox.files.createDirectories(
        directories.map((path) => ({ path })),
      );
    }
    await sandbox.files.writeFiles(
      files.map((file) => ({
        path: remotePath(file.path),
        data: file.content,
        ...(file.mode === undefined ? {} : { mode: file.mode }),
      })),
    );
    await this.audit('sandbox_put_files', {
      audit_id: handle.audit_id,
      trace_id: handle.trace_id,
      sandbox_id: handle.id,
      files: files.map((file) => ({
        path: file.path,
        bytes:
          typeof file.content === 'string'
            ? Buffer.byteLength(file.content)
            : file.content.byteLength,
      })),
    });
  }

  async exec(
    handle: SandboxHandle,
    argv: string[],
    options: SandboxExecOptions,
  ): Promise<SandboxExecResult> {
    if (argv.length === 0)
      throw new SandboxRuntimeError('argv must not be empty');
    const command = argv[0];
    if (!command) throw new SandboxRuntimeError('argv must not be empty');
    const sandbox = this.lookup(handle);
    const execution = await sandbox.commands.run(shellCommand(argv), {
      workingDirectory: remoteRoot,
      timeoutSeconds: Math.ceil(options.timeoutMs / 1000),
    });
    const result = toExecResult(execution);
    await this.audit('sandbox_exec', {
      audit_id: options.audit_id,
      trace_id: options.trace_id,
      sandbox_id: handle.id,
      command,
      exitCode: result.exitCode,
    });
    return result;
  }

  async collectArtifacts(
    handle: SandboxHandle,
    paths: string[],
    options: { maxBytes: number; audit_id: string; trace_id: string },
  ): Promise<SandboxFile[]> {
    const sandbox = this.lookup(handle);
    let totalBytes = 0;
    const files: SandboxFile[] = [];
    for (const path of paths) {
      const content = await sandbox.files.readFile(remotePath(path));
      totalBytes += Buffer.byteLength(content);
      if (totalBytes > options.maxBytes) {
        throw new SandboxRuntimeError('artifact size exceeds maxBytes');
      }
      files.push({ path, content });
    }
    await this.audit('sandbox_collect', {
      audit_id: options.audit_id,
      trace_id: options.trace_id,
      sandbox_id: handle.id,
      files: files.map((file) => ({
        path: file.path,
        bytes:
          typeof file.content === 'string'
            ? Buffer.byteLength(file.content)
            : file.content.byteLength,
      })),
      totalBytes,
    });
    return files;
  }

  async destroy(handle: SandboxHandle): Promise<void> {
    const sandbox = this.sandboxes.get(handle.id);
    if (sandbox) {
      try {
        await sandbox.kill();
      } finally {
        await sandbox.close();
        this.sandboxes.delete(handle.id);
      }
    }
    await this.audit('sandbox_destroy', {
      audit_id: handle.audit_id,
      trace_id: handle.trace_id,
      sandbox_id: handle.id,
      retained: false,
    });
  }

  private lookup(handle: SandboxHandle): Sandbox {
    const sandbox = this.sandboxes.get(handle.id);
    if (!sandbox) {
      throw new SandboxRuntimeError(`unknown opensandbox handle: ${handle.id}`);
    }
    return sandbox;
  }

  private async enforcePolicy(spec: SandboxSpec): Promise<void> {
    const decision = await evaluatePolicy(
      {
        tenant: process.env.EAP_SANDBOX_TENANT ?? 'acme',
        image: spec.image,
        egress: spec.network.egress,
        policy_id: spec.network.policyId ?? '',
        env_keys: Object.keys(spec.env ?? {}).sort(),
      },
      'policy/sandbox.rego',
      'data.eap.sandbox',
    );
    if (!decision.allow || decision.requires_approval) {
      throw new SandboxRuntimeError(
        `sandbox policy denied: ${decision.reasons.join(',')}`,
      );
    }
  }

  private async audit(
    type: string,
    event: Record<string, unknown>,
  ): Promise<void> {
    await appendAudit(this.auditLog, { type, ...event });
  }
}

function toOpenSandboxNetworkPolicy(spec: SandboxSpec): NetworkPolicy {
  return {
    defaultAction: spec.network.egress === 'deny' ? 'deny' : 'allow',
  };
}

function remotePath(requested: string): string {
  if (
    requested.startsWith('/') ||
    requested === '..' ||
    requested.startsWith('../') ||
    requested.includes('/../')
  ) {
    throw new SandboxRuntimeError(`path escapes sandbox: ${requested}`);
  }
  return `${remoteRoot}/${requested}`;
}

function shellCommand(argv: string[]): string {
  return `/bin/sh -lc ${shellQuote(argv.map(shellQuote).join(' '))}`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function toExecResult(execution: Execution): SandboxExecResult {
  return {
    exitCode: execution.exitCode ?? (execution.error ? 1 : 0),
    stdout: execution.logs.stdout.map(outputText).join(''),
    stderr: [
      ...execution.logs.stderr.map(outputText),
      ...(execution.error
        ? [`${execution.error.name}: ${execution.error.value}`]
        : []),
    ].join(''),
  };
}

function outputText(message: { text?: string }): string {
  return message.text ?? '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
