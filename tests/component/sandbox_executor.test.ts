import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  LocalWorkspaceExecutor,
  getSandboxExecutor,
  type SandboxSpec,
} from '../../src/lib/sandbox.ts';

const spec: SandboxSpec = {
  image: { name: 'local-workspace', tag: 'test', digest: 'sha256:local' },
  limits: { cpu: '1', memoryMb: 256, timeoutMs: 30_000 },
  network: { egress: 'deny' },
  audit_id: 'audit-test',
  trace_id: 'trace-test',
};

describe('SandboxExecutor local implementation', () => {
  const oldRuntime = process.env.EAP_SANDBOX_RUNTIME;

  afterEach(() => {
    if (oldRuntime === undefined) delete process.env.EAP_SANDBOX_RUNTIME;
    else process.env.EAP_SANDBOX_RUNTIME = oldRuntime;
  });

  it('creates a workspace, writes files, executes in cwd, collects artifacts, and audits lifecycle events', async () => {
    const auditLog = join(
      await mkdtemp(join(tmpdir(), 'eap-sandbox-audit-')),
      'audit.jsonl',
    );
    const executor = new LocalWorkspaceExecutor({ auditLog });
    const handle = await executor.create(spec);

    await executor.putFiles(handle, [
      { path: 'input.txt', content: 'sandbox input\n' },
    ]);
    const result = await executor.exec(
      handle,
      [
        process.execPath,
        '-e',
        "require('node:fs').writeFileSync('out.txt', require('node:fs').readFileSync('input.txt', 'utf8').toUpperCase())",
      ],
      { timeoutMs: 30_000, audit_id: 'audit-test', trace_id: 'trace-test' },
    );
    expect(result).toMatchObject({ exitCode: 0, stderr: '' });

    const files = await executor.collectArtifacts(handle, ['out.txt'], {
      maxBytes: 1024,
      audit_id: 'audit-test',
      trace_id: 'trace-test',
    });
    expect(files).toEqual([{ path: 'out.txt', content: 'SANDBOX INPUT\n' }]);

    await executor.destroy(handle);
    const events = (await readFile(auditLog, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as { type: string });
    expect(events.map((event) => event.type)).toEqual([
      'sandbox_create',
      'sandbox_put_files',
      'sandbox_exec',
      'sandbox_collect',
      'sandbox_destroy',
    ]);
  });

  it('enforces collectArtifacts maxBytes', async () => {
    const executor = new LocalWorkspaceExecutor();
    const handle = await executor.create(spec);
    await executor.putFiles(handle, [
      { path: 'large.txt', content: 'too large' },
    ]);

    await expect(
      executor.collectArtifacts(handle, ['large.txt'], {
        maxBytes: 3,
        audit_id: 'audit-test',
        trace_id: 'trace-test',
      }),
    ).rejects.toThrow(/artifact size exceeds maxBytes/);
  });

  it('fails closed for opensandbox runtime until T06c implements it', () => {
    process.env.EAP_SANDBOX_RUNTIME = 'opensandbox';
    expect(() => getSandboxExecutor()).toThrow(
      /OpenSandboxExecutor not yet implemented; see T06c/,
    );
  });
});
