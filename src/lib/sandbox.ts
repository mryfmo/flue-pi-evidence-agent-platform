/** Sandbox execution boundary for remediation workspace operations. */
import { execFile } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { appendAudit } from './audit.ts';

const execFileAsync = promisify(execFile);

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

export class SandboxRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SandboxRuntimeError';
  }
}

interface LocalWorkspaceExecutorOptions {
  auditLog?: string;
}

export class LocalWorkspaceExecutor implements SandboxExecutor {
  private readonly auditLog: string;

  constructor(options: LocalWorkspaceExecutorOptions = {}) {
    this.auditLog = options.auditLog ?? 'artifacts/audit/remediation.jsonl';
  }

  async create(spec: SandboxSpec): Promise<SandboxHandle> {
    const workspace = resolve(
      'artifacts/demo/workspace',
      `local-${process.pid}-${randomUUID()}`,
    );
    await mkdir(workspace, { recursive: true });
    const handle = {
      id: workspace,
      runtime: 'local' as const,
      audit_id: spec.audit_id,
      trace_id: spec.trace_id,
    };
    await this.audit('sandbox_create', {
      audit_id: spec.audit_id,
      trace_id: spec.trace_id,
      runtime: handle.runtime,
      workspace,
      image: spec.image,
      limits: spec.limits,
      network: spec.network,
      envKeys: Object.keys(spec.env ?? {}).sort(),
    });
    return handle;
  }

  async putFiles(handle: SandboxHandle, files: SandboxFile[]): Promise<void> {
    const written: Array<{ path: string; bytes: number; sha256: string }> = [];
    for (const file of files) {
      const target = confinedPath(handle.id, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(
        target,
        file.content,
        file.mode ? { mode: file.mode } : undefined,
      );
      const bytes =
        typeof file.content === 'string'
          ? Buffer.byteLength(file.content)
          : file.content.byteLength;
      written.push({
        path: file.path,
        bytes,
        sha256: digest(file.content),
      });
    }
    await this.audit('sandbox_put_files', {
      audit_id: handle.audit_id,
      trace_id: handle.trace_id,
      sandbox_id: handle.id,
      files: written,
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
    const args = argv.slice(1);
    try {
      const { stdout, stderr } = await execFileAsync(command, args, {
        cwd: handle.id,
        maxBuffer: 1024 * 1024,
        timeout: options.timeoutMs,
      });
      const result = { exitCode: 0, stdout, stderr };
      await this.auditExec(handle, argv, options, result);
      return result;
    } catch (error) {
      const err = error as { stdout?: string; stderr?: string; code?: number };
      const result = {
        exitCode: typeof err.code === 'number' ? err.code : 1,
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? '',
      };
      await this.auditExec(handle, argv, options, result);
      return result;
    }
  }

  async collectArtifacts(
    handle: SandboxHandle,
    paths: string[],
    options: { maxBytes: number; audit_id: string; trace_id: string },
  ): Promise<SandboxFile[]> {
    let totalBytes = 0;
    const files: SandboxFile[] = [];
    const auditFiles: Array<{ path: string; bytes: number; sha256: string }> =
      [];
    for (const path of paths) {
      const content = await readFile(confinedPath(handle.id, path), 'utf8');
      const bytes = Buffer.byteLength(content);
      totalBytes += bytes;
      if (totalBytes > options.maxBytes) {
        throw new SandboxRuntimeError('artifact size exceeds maxBytes');
      }
      files.push({ path, content });
      auditFiles.push({ path, bytes, sha256: digest(content) });
    }
    await this.audit('sandbox_collect', {
      audit_id: options.audit_id,
      trace_id: options.trace_id,
      sandbox_id: handle.id,
      files: auditFiles,
      totalBytes,
    });
    return files;
  }

  async destroy(handle: SandboxHandle): Promise<void> {
    // ponytail: local runtime preserves current artifact retention; remote teardown starts in T06c.
    await this.audit('sandbox_destroy', {
      audit_id: handle.audit_id,
      trace_id: handle.trace_id,
      sandbox_id: handle.id,
      retained: true,
    });
  }

  private async audit(
    type: string,
    event: Record<string, unknown>,
  ): Promise<void> {
    await appendAudit(this.auditLog, { type, ...event });
  }

  private async auditExec(
    handle: SandboxHandle,
    argv: string[],
    options: SandboxExecOptions,
    result: SandboxExecResult,
  ): Promise<void> {
    await this.audit('sandbox_exec', {
      audit_id: options.audit_id,
      trace_id: options.trace_id,
      sandbox_id: handle.id,
      argvDigest: digest(argv.join('\0')),
      command: basename(argv[0] ?? 'unknown'),
      exitCode: result.exitCode,
    });
  }
}

export function getSandboxExecutor(
  options: LocalWorkspaceExecutorOptions = {},
): SandboxExecutor {
  const runtime = process.env.EAP_SANDBOX_RUNTIME ?? 'local';
  if (runtime === 'local') return new LocalWorkspaceExecutor(options);
  if (runtime === 'opensandbox') {
    throw new SandboxRuntimeError(
      'OpenSandboxExecutor not yet implemented; see T06c',
    );
  }
  throw new SandboxRuntimeError(`Unknown sandbox runtime: ${runtime}`);
}

function confinedPath(root: string, requested: string): string {
  const target = resolve(root, requested);
  const rel = relative(root, target);
  if (
    rel.startsWith('..') ||
    rel === '' ||
    rel.startsWith(`..${resolve('/')}`)
  ) {
    throw new SandboxRuntimeError(`path escapes sandbox: ${requested}`);
  }
  return target;
}

function digest(content: Uint8Array | string): string {
  return createHash('sha256').update(content).digest('hex');
}
