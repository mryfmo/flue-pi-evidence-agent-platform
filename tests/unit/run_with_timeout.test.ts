import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, describe, expect, it } from 'vitest';

const node = resolve('node_modules/node/bin/node');
const runner = resolve('scripts/run-with-timeout.mjs');
const fixtures: string[] = [];

type Ready = {
  descendantPid?: number;
  leaderPid: number;
  pgid: number;
};

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { recursive: true, force: true });
  }
});

describe('run-with-timeout CLI', () => {
  it('propagates success and numeric failure', () => {
    const success = run([
      '5',
      node,
      '-e',
      'process.stdout.write("runner-output");process.stderr.write("runner-error")',
    ]);
    expect(success.status).toBe(0);
    expect(success.stdout).toBe('runner-output');
    expect(success.stderr).toBe('runner-error');
    expect(run(['5', node, '-e', 'process.exit(23)']).status).toBe(23);
  });

  it('rejects invalid arguments and spawn failure', () => {
    for (const seconds of ['0', '01', '1.5', '+1', '-1', 'one', '10000']) {
      const result = run([seconds, node, '-e', '']);
      expect(result.status, seconds).toBe(64);
      expect(result.stderr, seconds).toContain('invalid arguments');
    }
    expect(run(['1']).status).toBe(64);

    const missing = run(['1', 'definitely-not-an-a1-executable']);
    expect(missing.status).toBe(127);
    expect(missing.stderr).toContain('spawn failed');
  });

  it('propagates a known child signal', () => {
    if (process.platform === 'win32') return;
    expect(
      run(['5', node, '-e', 'process.kill(process.pid, "SIGTERM")']).status,
    ).toBe(143);
  });

  it('latches deadline until SIGKILL after the exact grace', async () => {
    if (process.platform === 'win32') return;
    const fixture = makeFixture();
    const readyPath = join(fixture, 'ready.json');
    const leaderScript = join(fixture, 'leader.mjs');
    writeFileSync(
      leaderScript,
      `import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], JSON.stringify({ leaderPid: process.pid, pgid: process.pid }));
process.on('SIGTERM', () => {});
setInterval(() => {}, 1000);
`,
    );
    const started = Date.now();
    const running = spawn(node, [runner, '1', node, leaderScript, readyPath], {
      stdio: 'ignore',
    });
    let ready: Ready = { leaderPid: 0, pgid: 0 };
    try {
      ready = await readReady(readyPath);
      expect((await waitForClose(running, 6_000)).code).toBe(124);
      expect(Date.now() - started).toBeGreaterThanOrEqual(2_800);
      await waitUntil(() => !isAlive(ready.leaderPid), 2_000);
    } finally {
      killGroup(ready.pgid);
      killPid(running.pid);
      killPid(ready.leaderPid);
    }
  });

  it('keeps the deadline latch when the leader closes and a signal follows', async () => {
    if (process.platform === 'win32') return;
    const fixture = makeFixture();
    const readyPath = join(fixture, 'ready.json');
    const termPath = join(fixture, 'leader-terminated');
    const descendantScript = join(fixture, 'descendant.mjs');
    const leaderScript = join(fixture, 'leader.mjs');
    writeFileSync(
      descendantScript,
      `import { writeFileSync } from 'node:fs';
const leaderPid = Number(process.argv[3]);
process.on('SIGTERM', () => {});
writeFileSync(process.argv[2], JSON.stringify({ leaderPid, descendantPid: process.pid, pgid: leaderPid }));
setInterval(() => {}, 1000);
`,
    );
    writeFileSync(
      leaderScript,
      `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
spawn(process.execPath, [process.argv[2], process.argv[3], String(process.pid)], { stdio: 'ignore' });
process.on('SIGTERM', () => { writeFileSync(process.argv[4], 'terminated'); process.exit(0); });
setInterval(() => {}, 1000);
`,
    );
    const running = spawn(
      node,
      [runner, '1', node, leaderScript, descendantScript, readyPath, termPath],
      { stdio: 'ignore' },
    );
    let ready: Ready = { leaderPid: 0, pgid: 0 };
    try {
      ready = await readReady(readyPath);
      await waitUntil(() => existsSync(termPath), 2_000);
      running.kill('SIGINT');
      expect((await waitForClose(running, 5_000)).code).toBe(124);
      await waitUntil(
        () => !isAlive(ready.leaderPid) && !isAlive(ready.descendantPid ?? 0),
        2_000,
      );
    } finally {
      killGroup(ready.pgid);
      killPid(running.pid);
      killPid(ready.leaderPid);
      killPid(ready.descendantPid);
    }
  });

  it('cleans the group and exits deterministically on external SIGINT', async () => {
    if (process.platform === 'win32') return;
    const fixture = makeFixture();
    const readyPath = join(fixture, 'ready.json');
    const leaderScript = join(fixture, 'leader.mjs');
    writeFileSync(
      leaderScript,
      `import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], JSON.stringify({ leaderPid: process.pid, pgid: process.pid }));
process.on('SIGTERM', () => {});
setInterval(() => {}, 1000);
`,
    );
    const running = spawn(node, [runner, '10', node, leaderScript, readyPath], {
      stdio: 'ignore',
    });
    let ready: Ready = { leaderPid: 0, pgid: 0 };
    try {
      ready = await readReady(readyPath);
      running.kill('SIGINT');
      running.kill('SIGINT');
      expect((await waitForClose(running, 5_000)).code).toBe(130);
      await waitUntil(() => !isAlive(ready.leaderPid), 2_000);
    } finally {
      killGroup(ready.pgid);
      killPid(running.pid);
      killPid(ready.leaderPid);
    }
  });

  it('cleans descendants when parent maxBuffer sends SIGTERM to the wrapper', async () => {
    if (process.platform === 'win32') return;
    const fixture = makeFixture();
    const readyPath = join(fixture, 'ready.json');
    const descendantScript = join(fixture, 'descendant.mjs');
    const leaderScript = join(fixture, 'noisy-leader.mjs');
    writeFileSync(
      descendantScript,
      `import { writeFileSync } from 'node:fs';
const leaderPid = Number(process.argv[3]);
process.on('SIGTERM', () => {});
writeFileSync(process.argv[2], JSON.stringify({ leaderPid, descendantPid: process.pid, pgid: leaderPid }));
setInterval(() => {}, 1000);
`,
    );
    writeFileSync(
      leaderScript,
      `import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
spawn(process.execPath, [process.argv[2], process.argv[3], String(process.pid)], { stdio: 'ignore' });
const wait = setInterval(() => {
  if (!existsSync(process.argv[3])) return;
  clearInterval(wait);
  setInterval(() => process.stdout.write('x'.repeat(4096)), 0);
}, 5);
`,
    );
    let ready: Ready = { leaderPid: 0, pgid: 0 };
    let wrapperPid = 0;
    try {
      const result = spawnSync(
        node,
        [runner, '30', node, leaderScript, descendantScript, readyPath],
        { encoding: 'utf8', maxBuffer: 1_024, timeout: 8_000 },
      );
      wrapperPid = result.pid;
      ready = await readReady(readyPath);
      expect((result.error as NodeJS.ErrnoException).code).toBe('ENOBUFS');
      await waitUntil(
        () =>
          !isAlive(wrapperPid) &&
          !isAlive(ready.leaderPid) &&
          !isAlive(ready.descendantPid ?? 0),
        4_000,
      );
    } finally {
      killGroup(ready.pgid);
      killPid(wrapperPid);
      killPid(ready.leaderPid);
      killPid(ready.descendantPid);
    }
  });

  it('returns 70 under captured stdio when group kills fail', async () => {
    if (process.platform === 'win32') return;
    const fixture = makeFixture();
    const readyPath = join(fixture, 'ready.json');
    const hook = join(fixture, 'kill-eperm.mjs');
    const leaderScript = join(fixture, 'leader.mjs');
    writeFileSync(
      hook,
      `const originalKill = process.kill.bind(process);
process.kill = (pid, signal) => {
  if (pid < 0 && (signal === 'SIGTERM' || signal === 'SIGKILL')) {
    throw Object.assign(new Error('injected kill failure'), { code: 'EPERM' });
  }
  return originalKill(pid, signal);
};
`,
    );
    writeFileSync(
      leaderScript,
      `import { writeFileSync } from 'node:fs';
writeFileSync(process.argv[2], JSON.stringify({ leaderPid: process.pid, pgid: process.pid }));
setInterval(() => {}, 1000);
`,
    );
    let ready: Ready = { leaderPid: 0, pgid: 0 };
    let wrapperPid = 0;
    try {
      const started = Date.now();
      const result = spawnSync(
        node,
        ['--import', hook, runner, '1', node, leaderScript, readyPath],
        {
          encoding: 'utf8',
          maxBuffer: 20 * 1024 * 1024,
          timeout: 6_000,
        },
      );
      wrapperPid = result.pid;
      ready = await readReady(readyPath);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(70);
      expect(Date.now() - started).toBeGreaterThanOrEqual(2_800);
      expect(Date.now() - started).toBeLessThan(5_000);
      expect(isAlive(ready.leaderPid)).toBe(true);
    } finally {
      killGroup(ready.pgid);
      killPid(wrapperPid);
      killPid(ready.leaderPid);
    }
  });
});

function run(arguments_: string[], timeout = 5_000) {
  return spawnSync(node, [runner, ...arguments_], {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout,
  });
}

function makeFixture() {
  const fixture = mkdtempSync(join(tmpdir(), 'a1-timeout-'));
  fixtures.push(fixture);
  return fixture;
}

async function readReady(path: string) {
  let ready: Ready | undefined;
  await waitUntil(() => {
    if (!existsSync(path)) return false;
    try {
      const candidate = JSON.parse(readFileSync(path, 'utf8')) as Ready;
      if (!candidate.leaderPid || !candidate.pgid) return false;
      ready = candidate;
      return true;
    } catch {
      return false;
    }
  }, 2_000);
  return ready as Ready;
}

async function waitUntil(predicate: () => boolean, timeout: number) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('bounded wait expired');
    await delay(20);
  }
}

function waitForClose(child: ChildProcess, timeout: number) {
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolveClose, reject) => {
      const timer = setTimeout(
        () => reject(new Error('close wait expired')),
        timeout,
      );
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        resolveClose({ code, signal });
      });
    },
  );
}

function isAlive(pid: number) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function killGroup(pgid: number) {
  if (process.platform === 'win32' || !pgid) return;
  try {
    process.kill(-pgid, 'SIGKILL');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

function killPid(pid?: number) {
  if (!pid) return;
  try {
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}
