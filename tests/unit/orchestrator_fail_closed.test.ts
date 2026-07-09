import { execFileSync, spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = resolve('.');
const node = resolve(repo, 'node_modules/node/bin/node');
const delegateScript = resolve(repo, 'scripts/orchestrator/delegate.mjs');
const statusScript = resolve(repo, 'scripts/orchestrator/status.mjs');
const healthScript = resolve(repo, 'scripts/orchestrator/platform-health.mjs');

describe('orchestrator fail-closed behavior', () => {
  it('does not leave partial ledgers when agmsg write fails', () => {
    const dir = tempWorkspace();
    const failingSend = join(dir, 'send-fails.sh');
    writeFileSync(
      failingSend,
      '#!/bin/sh\necho "sqlite write failed" >&2\nexit 1\n',
      { mode: 0o755 },
    );

    const result = spawnSync(
      node,
      [
        delegateScript,
        '--task-id',
        'T-fail',
        '--task-file',
        '.orchestration/tasks/T-fail.md',
        '--to',
        'worker',
        '--lease',
        'docs/owned.md',
      ],
      {
        cwd: dir,
        env: {
          ...process.env,
          AGMSG_SEND_SH: failingSend,
          AGMSG_DB: join(dir, 'missing/agmsg.sqlite'),
        },
        encoding: 'utf8',
      },
    );

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('task_not_delegated');
    expect(
      existsSync(join(dir, '.orchestration/orchestrator/leases.json')),
    ).toBe(false);
    expect(
      existsSync(join(dir, '.orchestration/orchestrator/events.jsonl')),
    ).toBe(false);
  });

  it('includes max_turns in delegated task messages', () => {
    const dir = tempWorkspace();
    const sendOk = join(dir, 'send-ok.sh');
    const sent = join(dir, 'sent.txt');
    writeFileSync(
      sendOk,
      `#!/bin/sh\nprintf '%s\\n' "$4" > ${sent}\nexit 0\n`,
      { mode: 0o755 },
    );

    const result = spawnSync(
      node,
      [
        delegateScript,
        '--task-id',
        'T-send',
        '--task-file',
        '.orchestration/tasks/T-send.md',
        '--to',
        'worker',
        '--lease',
        'docs/owned.md',
        '--max-turns',
        '7',
      ],
      {
        cwd: dir,
        env: { ...process.env, AGMSG_SEND_SH: sendOk },
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(0);
    expect(readFileSync(sent, 'utf8')).toContain('max_turns=7');
  });

  it('reports missing RESULT as unknown without suggesting delegated execution', () => {
    const dir = tempWorkspace();
    const history = join(dir, 'history.txt');
    writeFileSync(history, 'AGMSG-TASK v1 task_id=T-missing\n', 'utf8');

    const output = execFileSync(
      node,
      [statusScript, '--task-id', 'T-missing', '--history-file', history],
      { cwd: repo, encoding: 'utf8' },
    );

    expect(output.trim()).toBe('state: unknown');
    expect(output).not.toMatch(/delegate|execute|代行|実行/i);
  });

  it('fails platform health when agmsg DB is unreachable', () => {
    const dir = tempWorkspace();
    copyPolicyAndConfig(dir);
    const result = spawnSync(node, [healthScript], {
      cwd: dir,
      env: { ...process.env, AGMSG_DB: join(dir, 'missing/agmsg.sqlite') },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('agmsg_db: fail');
    expect(result.stdout).toContain('litellm_live: skip');
  });

  it('passes platform health with a messages table in the agmsg DB', () => {
    const dir = tempWorkspace();
    copyPolicyAndConfig(dir);
    const db = createMessagesDb(dir);

    const result = spawnSync(node, [healthScript], {
      cwd: dir,
      env: { ...process.env, AGMSG_DB: db },
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('agmsg_db: ok');
    expect(result.stdout).toContain('litellm_live: skip');
  });

  it('fails platform health when LiteLLM config is invalid', () => {
    const dir = tempWorkspace();
    copyPolicyAndConfig(dir);
    const db = createMessagesDb(dir);
    writeFileSync(
      join(dir, 'config/litellm/config.yaml'),
      'model_list: []\nlitellm_settings:\n  turn_off_message_logging: false\nhost: 0.0.0.0\n',
      'utf8',
    );

    const result = spawnSync(node, [healthScript], {
      cwd: dir,
      env: {
        ...process.env,
        AGMSG_DB: db,
      },
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain('litellm_config: fail');
    expect(result.stdout).toContain('litellm_live: skip');
  });
});

function tempWorkspace() {
  const dir = mkdtempSync(join(tmpdir(), 'orchestrator-fail-closed-'));
  mkdirSync(join(dir, '.orchestration/orchestrator'), { recursive: true });
  return dir;
}

function createMessagesDb(dir: string) {
  const db = join(dir, 'messages.db');
  const create = spawnSync('sqlite3', [
    db,
    'CREATE TABLE messages(id INTEGER PRIMARY KEY);',
  ]);
  expect(create.status).toBe(0);
  return db;
}

function copyPolicyAndConfig(dir: string) {
  mkdirSync(join(dir, 'policy'), { recursive: true });
  mkdirSync(join(dir, 'config/litellm'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(
    join(dir, 'policy/routing.json'),
    readFileSync('policy/routing.json', 'utf8'),
    'utf8',
  );
  writeFileSync(
    join(dir, 'policy/routing.prod.json'),
    readFileSync('policy/routing.prod.json', 'utf8'),
    'utf8',
  );
  writeFileSync(
    join(dir, 'config/litellm/config.yaml'),
    readFileSync('config/litellm/config.yaml', 'utf8'),
    'utf8',
  );
  writeFileSync(
    join(dir, 'scripts/check-litellm-config.mjs'),
    readFileSync('scripts/check-litellm-config.mjs', 'utf8'),
    'utf8',
  );
}
