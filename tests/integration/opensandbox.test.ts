import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getSandboxExecutor,
  type SandboxExecutor,
  type SandboxHandle,
  type SandboxSpec,
} from '../../src/lib/sandbox.ts';

const opensandboxUrl = process.env.EAP_OPENSANDBOX_URL;

if (!opensandboxUrl) {
  console.warn(
    'OpenSandbox integration skipped: EAP_OPENSANDBOX_URL is unset.',
  );
}

describe.skipIf(!opensandboxUrl)('OpenSandboxExecutor integration', () => {
  const oldRuntime = process.env.EAP_SANDBOX_RUNTIME;
  let executor: SandboxExecutor;
  let handle: SandboxHandle | undefined;
  let auditLog: string;

  const spec: SandboxSpec = {
    image: {
      name: 'opensandbox/code-interpreter',
      tag: 'v1.1.0',
      digest:
        'sha256:133a3c1720dd52291a019740c2987e7164ea6de79e23d8198798e58950ae2e6e',
    },
    limits: { cpu: '1', memoryMb: 512, timeoutMs: 60_000 },
    network: { egress: 'deny' },
    audit_id: 'opensandbox-audit-test',
    trace_id: 'opensandbox-trace-test',
  };

  beforeEach(async () => {
    process.env.EAP_SANDBOX_RUNTIME = 'opensandbox';
    auditLog = join(
      await mkdtemp(join(tmpdir(), 'eap-opensandbox-audit-')),
      'audit.jsonl',
    );
    executor = getSandboxExecutor({ auditLog });
    handle = await executor.create(spec);
  });

  afterEach(async () => {
    if (handle) await executor.destroy(handle);
    handle = undefined;
    if (oldRuntime === undefined) delete process.env.EAP_SANDBOX_RUNTIME;
    else process.env.EAP_SANDBOX_RUNTIME = oldRuntime;
  });

  it('runs commands, moves files, collects artifacts, and records audit events', async () => {
    if (!handle) throw new Error('missing sandbox handle');

    await executor.putFiles(handle, [
      { path: 'input.txt', content: 'opensandbox input\n' },
    ]);
    const result = await executor.exec(
      handle,
      [
        'python',
        '-c',
        "from pathlib import Path; Path('out.txt').write_text(Path('input.txt').read_text().upper())",
      ],
      {
        timeoutMs: 60_000,
        audit_id: spec.audit_id,
        trace_id: spec.trace_id,
      },
    );

    expect(result.exitCode).toBe(0);
    const artifacts = await executor.collectArtifacts(handle, ['out.txt'], {
      maxBytes: 1024,
      audit_id: spec.audit_id,
      trace_id: spec.trace_id,
    });
    expect(artifacts).toEqual([
      { path: 'out.txt', content: 'OPENSANDBOX INPUT\n' },
    ]);
    await executor.destroy(handle);
    handle = undefined;

    const auditTypes = (await readFile(auditLog, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as { type: string }).type);
    expect(auditTypes).toEqual([
      'sandbox_create',
      'sandbox_put_files',
      'sandbox_exec',
      'sandbox_collect',
      'sandbox_destroy',
    ]);
  });

  it('enforces artifact byte limits', async () => {
    if (!handle) throw new Error('missing sandbox handle');

    await executor.putFiles(handle, [
      { path: 'large.txt', content: 'too big' },
    ]);
    await expect(
      executor.collectArtifacts(handle, ['large.txt'], {
        maxBytes: 3,
        audit_id: spec.audit_id,
        trace_id: spec.trace_id,
      }),
    ).rejects.toThrow(/artifact size exceeds maxBytes/);
  });

  it('does not leak unspecified environment variables into commands', async () => {
    if (!handle) throw new Error('missing sandbox handle');

    process.env.OPEN_SANDBOX_HOST_SECRET = 'must-not-leak';
    const result = await executor.exec(
      handle,
      [
        'python',
        '-c',
        "import os; print(os.getenv('OPEN_SANDBOX_HOST_SECRET'))",
      ],
      {
        timeoutMs: 60_000,
        audit_id: spec.audit_id,
        trace_id: spec.trace_id,
      },
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('None');
  });

  it('blocks outbound network access by default', async () => {
    if (!handle) throw new Error('missing sandbox handle');

    const result = await executor.exec(
      handle,
      [
        'python',
        '-c',
        "import urllib.request; urllib.request.urlopen('https://example.com', timeout=5)",
      ],
      {
        timeoutMs: 60_000,
        audit_id: spec.audit_id,
        trace_id: spec.trace_id,
      },
    );

    expect(result.exitCode).not.toBe(0);
  });
});
