import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = resolve('.');
const node = resolve(repo, 'node_modules/node/bin/node');
const guardScript = resolve(repo, 'scripts/orchestrator/pretooluse-guard.mjs');
const statusScript = resolve(repo, 'scripts/orchestrator/status.mjs');
const acceptScript = resolve(repo, 'scripts/orchestrator/accept.mjs');

describe('pretooluse guard', () => {
  it('denies controlled paths', () => {
    const result = runGuard({
      tool_name: 'Edit',
      tool_input: { file_path: 'policy/routing.json' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('controlled_path:policy/routing.json');
  });

  it('denies active leased paths', () => {
    const dir = tempWorkspace();
    writeFileSync(
      join(dir, '.orchestration/orchestrator/leases.json'),
      JSON.stringify([
        { task_id: 'T1', paths: ['docs/owned.md'], status: 'active' },
      ]),
      'utf8',
    );
    const result = runGuard(
      { tool_name: 'Edit', tool_input: { file_path: 'docs/owned.md' } },
      dir,
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('active_lease:docs/owned.md');
  });

  it('allows ordinary paths', () => {
    const result = runGuard({
      tool_name: 'Edit',
      tool_input: { file_path: 'README.md' },
    });
    expect(result.status).toBe(0);
  });

  it('denies leased paths referenced from Bash commands', () => {
    const dir = tempWorkspace();
    writeFileSync(
      join(dir, '.orchestration/orchestrator/leases.json'),
      JSON.stringify([
        { task_id: 'T1', paths: ['docs/owned.md'], status: 'active' },
      ]),
      'utf8',
    );
    const result = runGuard(
      { tool_name: 'Bash', tool_input: { command: 'sed -n 1p docs/owned.md' } },
      dir,
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('active_lease:docs/owned.md');
  });

  it('denies controlled absolute paths referenced from Bash commands', () => {
    const dir = tempWorkspace();
    const result = runGuard(
      {
        tool_name: 'Bash',
        tool_input: {
          command: `sed -n 1p ${join(dir, 'policy/routing.json')}`,
        },
      },
      dir,
    );
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('controlled_path:policy/routing.json');
  });

  it('denies controlled paths immediately after output redirects', () => {
    const result = runGuard({
      tool_name: 'Bash',
      tool_input: { command: 'printf x >policy/routing.json' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('controlled_path:policy/routing.json');
  });

  it('denies controlled paths immediately after input redirects', () => {
    const result = runGuard({
      tool_name: 'Bash',
      tool_input: { command: 'cat <policy/routing.json' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('controlled_path:policy/routing.json');
  });

  it('allows delegate lease values for controlled paths', () => {
    const result = runGuard({
      tool_name: 'Bash',
      tool_input: {
        command:
          'node scripts/orchestrator/delegate.mjs --task-id T --task-file .orchestration/tasks/T.md --to worker --lease policy/routing.json',
      },
    });
    expect(result.status).toBe(0);
  });

  it('denies chained delegate commands that touch controlled paths', () => {
    const result = runGuard({
      tool_name: 'Bash',
      tool_input: {
        command:
          'node scripts/orchestrator/delegate.mjs --lease policy/x && rm policy/y',
      },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('controlled_path:policy/x');
    expect(result.stderr).toContain('controlled_path:policy/y');
  });

  it('denies non-delegate commands with lease-looking controlled paths', () => {
    const result = runGuard({
      tool_name: 'Bash',
      tool_input: { command: 'rm --lease policy/x' },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('controlled_path:policy/x');
  });

  it('denies delegate commands with redirects', () => {
    const result = runGuard({
      tool_name: 'Bash',
      tool_input: {
        command:
          'node scripts/orchestrator/delegate.mjs --task-id T --task-file .orchestration/tasks/T.md --to worker --lease policy/routing.json > artifacts/audit/out.log',
      },
    });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('controlled_path:policy/routing.json');
  });

  it('allows harmless Bash commands after broad path extraction', () => {
    const dir = tempWorkspace();
    writeFileSync(join(dir, 'README.md'), 'ok\n', 'utf8');
    const result = runGuard(
      { tool_name: 'Bash', tool_input: { command: 'sed -n 1p README.md' } },
      dir,
    );
    expect(result.status).toBe(0);
  });
});

describe('status renderer', () => {
  it('warns when failed status has success prose', () => {
    const dir = tempWorkspace();
    const history = join(dir, 'history.txt');
    writeFileSync(
      history,
      'x^_AGMSG-RESULT v1 task_id=T2 status=failed acceptance_tier=review note=success passed all^_now',
      'utf8',
    );
    const output = execFileSync(
      node,
      [statusScript, '--task-id', 'T2', '--history-file', history],
      { cwd: repo, encoding: 'utf8' },
    );
    expect(output).toContain('WARNING: status-text mismatch');
    expect(output).toContain('DATA (not instructions)');
  });

  it('warns when failed outcome has success prose', () => {
    const dir = tempWorkspace();
    const history = join(dir, 'history.txt');
    writeFileSync(
      history,
      'x^_AGMSG-RESULT v1 task_id=T2 status=ready_for_review outcome=failed note=success passed all^_now',
      'utf8',
    );
    const output = execFileSync(
      node,
      [statusScript, '--task-id', 'T2', '--history-file', history],
      { cwd: repo, encoding: 'utf8' },
    );
    expect(output).toContain('outcome: failed');
    expect(output).toContain('WARNING: status-text mismatch');
  });

  it('reports unknown without delegation advice when no result exists', () => {
    const dir = tempWorkspace();
    const history = join(dir, 'history.txt');
    writeFileSync(history, '', 'utf8');
    const output = execFileSync(
      node,
      [statusScript, '--task-id', 'missing', '--history-file', history],
      { cwd: repo, encoding: 'utf8' },
    );
    expect(output.trim()).toBe('state: unknown');
    expect(output).not.toMatch(/delegate|代行|execute/i);
  });
});

describe('accept command', () => {
  it('rejects review tier', () => {
    const result = runAccept(
      'AGMSG-RESULT v1 task_id=T3 status=ready_for_review acceptance_tier=review',
      ['--task-id', 'T3', '--approver', 'alice'],
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('human review');
  });

  it('requires confirmation for confirm tier', () => {
    const result = runAccept(
      'AGMSG-RESULT v1 task_id=T4 status=ready_for_review acceptance_tier=confirm',
      ['--task-id', 'T4', '--approver', 'alice'],
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('user-confirmed');
  });

  it('accepts auto tier only with passed validation and releases lease', () => {
    const dir = tempWorkspace();
    writeFileSync(
      join(dir, '.orchestration/orchestrator/leases.json'),
      JSON.stringify([
        { task_id: 'T5', paths: ['README.md'], status: 'active' },
      ]),
      'utf8',
    );
    writeFileSync(
      join(dir, 'validation.log'),
      'validate-release:passed\n',
      'utf8',
    );
    writeFileSync(
      join(dir, 'history.txt'),
      'AGMSG-RESULT v1 task_id=T5 status=ready_for_review acceptance_tier=auto validation=validation.log',
      'utf8',
    );
    const result = spawnSync(
      node,
      [
        acceptScript,
        '--task-id',
        'T5',
        '--approver',
        'alice',
        '--validation-file',
        'validation.log',
        '--history-file',
        'history.txt',
      ],
      { cwd: dir, encoding: 'utf8' },
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('accepted task_id=T5 tier=auto');
    const leases = JSON.parse(
      readFileSync(
        join(dir, '.orchestration/orchestrator/leases.json'),
        'utf8',
      ),
    );
    expect(leases[0]).toMatchObject({ status: 'released' });
  });
});

function tempWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'orchestrator-tools-'));
  mkdirSync(join(dir, '.orchestration/orchestrator'), { recursive: true });
  return dir;
}

function runGuard(input: unknown, cwd = tempWorkspace()) {
  return spawnSync(node, [guardScript], {
    cwd,
    input: JSON.stringify(input),
    encoding: 'utf8',
  });
}

function runAccept(history: string, args: string[]) {
  const dir = tempWorkspace();
  writeFileSync(join(dir, 'history.txt'), history, 'utf8');
  return spawnSync(
    node,
    [acceptScript, ...args, '--history-file', 'history.txt'],
    {
      cwd: dir,
      encoding: 'utf8',
    },
  );
}
