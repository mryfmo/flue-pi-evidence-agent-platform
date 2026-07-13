import { spawn } from 'node:child_process';
import { constants } from 'node:os';

const GRACE_MS = 2_000;
const POSIX = process.platform !== 'win32';
const [secondsText, executable, ...args] = process.argv.slice(2);

if (!/^(?:[1-9][0-9]{0,3})$/.test(secondsText ?? '') || !executable) {
  console.error('run-with-timeout: invalid arguments');
  process.exit(64);
}

let child;
try {
  child = spawn(executable, args, {
    detached: POSIX,
    shell: false,
    stdio: ['inherit', 'pipe', 'pipe'],
  });
} catch (error) {
  spawnFailed(error);
}

let settled = false;
let latchedExitCode;
let killFailed = false;
let graceTimer;
const deadlineTimer = setTimeout(onDeadline, Number(secondsText) * 1_000);
const externalSignalHandlers = new Map(
  ['SIGTERM', 'SIGINT'].map((name) => [
    name,
    () => latch(128 + constants.signals[name]),
  ]),
);

child.once('error', onSpawnError);
child.once('close', onClose);
process.stdout.on('error', onOutputError);
process.stderr.on('error', onOutputError);
child.stdout.pipe(process.stdout);
child.stderr.pipe(process.stderr);
for (const [name, handler] of externalSignalHandlers) {
  process.on(name, handler);
}

function onDeadline() {
  latch(124);
}

function latch(exitCode) {
  if (settled || latchedExitCode !== undefined) return;
  latchedExitCode = exitCode;
  clearTimeout(deadlineTimer);
  signal('SIGTERM');
  graceTimer = setTimeout(() => {
    signal('SIGKILL');
    if (killFailed) forceExit70();
    else settle(latchedExitCode);
  }, GRACE_MS);
}

function signal(name) {
  try {
    if (POSIX) process.kill(-child.pid, name);
    else if (!child.kill(name) && child.exitCode === null) {
      throw Object.assign(new Error('signal failed'), { code: 'UNKNOWN' });
    }
  } catch (error) {
    if (error?.code === 'ESRCH') return;
    killFailed = true;
    console.error(
      `run-with-timeout: kill failed signal=${name} code=${error?.code ?? 'unknown'}`,
    );
  }
}

function onSpawnError(error) {
  if (latchedExitCode !== undefined) return;
  console.error(
    `run-with-timeout: spawn failed executable=${executable} code=${error?.code ?? 'unknown'}`,
  );
  settle(127);
}

function onOutputError(error) {
  if (error?.code !== 'EPIPE') latch(70);
}

function onClose(code, signalName) {
  if (latchedExitCode !== undefined) return;
  if (Number.isInteger(code) && code >= 0 && code <= 255) {
    settle(code);
    return;
  }
  const signalNumber = signalName ? constants.signals[signalName] : undefined;
  const signalCode =
    signalNumber === undefined ? undefined : 128 + signalNumber;
  settle(
    Number.isInteger(signalCode) && signalCode >= 0 && signalCode <= 255
      ? signalCode
      : 70,
  );
}

function settle(code) {
  if (settled) return;
  settled = true;
  cleanup();
  process.exitCode = code;
}

function forceExit70() {
  if (settled) return;
  settled = true;
  cleanup();
  child.stdout.unpipe(process.stdout);
  child.stderr.unpipe(process.stderr);
  child.stdout.destroy();
  child.stderr.destroy();
  process.exit(70);
}

function cleanup() {
  clearTimeout(deadlineTimer);
  clearTimeout(graceTimer);
  child.removeListener('error', onSpawnError);
  child.removeListener('close', onClose);
  process.stdout.removeListener('error', onOutputError);
  process.stderr.removeListener('error', onOutputError);
  for (const [name, handler] of externalSignalHandlers) {
    process.removeListener(name, handler);
  }
}

function spawnFailed(error) {
  console.error(
    `run-with-timeout: spawn failed executable=${executable} code=${error?.code ?? 'unknown'}`,
  );
  process.exit(127);
}
