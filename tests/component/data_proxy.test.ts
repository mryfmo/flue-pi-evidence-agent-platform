import {
  access,
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  classifyMessages,
  isVerifiedClassification,
  metricQuery,
  parseUntrustedClassificationResult,
  runUntrustedClassificationProcess,
  unsafeQueryExitCode,
} from '../../src/lib/dataProxy.ts';

let fakeGuardDir: string;
let fakeGuard: string;

beforeAll(async () => {
  fakeGuardDir = await mkdtemp(join(tmpdir(), 'fake-data-guard-'));
  fakeGuard = join(fakeGuardDir, 'guard.cjs');
  await writeFile(
    fakeGuard,
    `#!/usr/bin/env node
const { createHash } = require('node:crypto');
const { appendFileSync, writeFileSync } = require('node:fs');
if (process.argv.slice(2).join(' ') !== 'scripts/data_guard.py classify_messages') process.exit(3);
const mode = process.env.FAKE_GUARD_MODE || 'ok';
if (process.env.FAKE_GUARD_INVOKED) appendFileSync(process.env.FAKE_GUARD_INVOKED, 'invoked\\n');
if (mode === 'epipe') process.exit(0);
if (mode === 'timeout') return void setTimeout(() => {}, 6000);
if (mode === 'ignore_sigterm') {
  writeFileSync(process.env.FAKE_GUARD_PID_FILE, String(process.pid));
  process.on('SIGTERM', () => appendFileSync(process.env.FAKE_GUARD_SIGNAL_FILE, 'SIGTERM\\n'));
  return void setInterval(() => {}, 1000);
}
if (mode === 'stdout_overflow') return void process.stdout.write('x'.repeat(1024 * 1024 + 1));
if (mode === 'stderr_overflow') return void process.stderr.write('x'.repeat(65536 + 1));
if (mode === 'nonzero') return void process.exit(2);
const chunks = [];
process.stdin.on('data', chunk => chunks.push(chunk));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks);
  if (mode === 'malformed') return void process.stdout.write('{bad\\n');
  const request = JSON.parse(raw);
  const messages = request.messages.map(message => ({ role: message.role, content: message.content }));
  const redacted = JSON.stringify(messages);
  let result = {
    schema_version: 1,
    producer: 'flue-pi-data-guard',
    evidence_kind: 'presidio-sqlglot-redaction-v1',
    request_sha256: createHash('sha256').update(raw).digest('hex'),
    redacted_sha256: createHash('sha256').update(redacted).digest('hex'),
    classification: 'internal',
    entities_found: 0,
    messages,
  };
  if (mode === 'missing') delete result.entities_found;
  if (mode === 'extra') result.extra = true;
  if (mode === 'reordered') result = { producer: result.producer, schema_version: 1, ...result };
  if (mode === 'stale_request') result.request_sha256 = '0'.repeat(64);
  if (mode === 'stale_redacted') result.redacted_sha256 = '0'.repeat(64);
  if (mode === 'swapped') result.messages.reverse();
  if (mode === 'missing_message') result.messages.pop();
  if (mode === 'extra_message') result.messages.push({ role: 'user', content: 'extra' });
  if (mode === 'forged_producer') result.producer = 'caller';
  if (mode === 'forged_kind') result.evidence_kind = 'caller';
  if (mode === 'public' || mode === 'unknown') result.classification = mode;
  let output = JSON.stringify(result);
  if (mode === 'duplicate') output = output.replace('{', '{"schema_version":1,');
  if (mode === 'whitespace') output = ' ' + output;
  process.stdout.write(output + '\\n');
});
`,
    'utf8',
  );
  await chmod(fakeGuard, 0o700);
});

afterEach(() => vi.unstubAllEnvs());
afterAll(async () => rm(fakeGuardDir, { recursive: true, force: true }));

const messages = [
  { role: 'system' as const, content: 'first' },
  { role: 'user' as const, content: 'second' },
];

function requestFor(value = messages): Buffer {
  return Buffer.from(JSON.stringify({ schema_version: 1, messages: value }));
}

async function runFakeGuard(mode: string, request = requestFor()) {
  vi.stubEnv('FAKE_GUARD_MODE', mode);
  return runUntrustedClassificationProcess(
    fakeGuard,
    ['scripts/data_guard.py', 'classify_messages'],
    request,
  );
}

describe('governed data proxy', () => {
  it('executes aggregate metric path and redacts PII', async () => {
    const result = await metricQuery();
    expect(result.metric).toBe('active_users_by_plan');
    expect(result.piiDetected).toBe(true);
    expect(result.redactedText).not.toContain('alice@example.com');
    expect(result.rejectedUnsafeSql).toBe(true);
    expect(result.rejectedMutationSql).toBe(true);
    expect(result.rejectedMultiStatementSql).toBe(true);
  });

  it('rejects unsafe, mutation, and multi-statement SQL commands', async () => {
    await expect(unsafeQueryExitCode('unsafe')).resolves.not.toBe(0);
    await expect(unsafeQueryExitCode('mutation')).resolves.not.toBe(0);
    await expect(unsafeQueryExitCode('multi')).resolves.not.toBe(0);
  });

  it('returns closed, content-bound guard classification evidence', async () => {
    const result = await classifyMessages([
      { role: 'system', content: 'Use verified evidence only.' },
      { role: 'user', content: 'Contact alice@example.com' },
    ]);

    expect(result).toMatchObject({
      schema_version: 1,
      producer: 'flue-pi-data-guard',
      evidence_kind: 'presidio-sqlglot-redaction-v1',
      verified_by: 'flue-pi-platform-gateway',
      classification: 'confidential',
    });
    expect(result.messages.map(({ role }) => role)).toEqual(['system', 'user']);
    expect(JSON.stringify(result.messages)).not.toContain('alice@example.com');
  });

  it.each([
    'missing',
    'extra',
    'reordered',
    'duplicate',
    'whitespace',
    'stale_request',
    'stale_redacted',
    'swapped',
    'missing_message',
    'extra_message',
    'forged_producer',
    'forged_kind',
    'public',
    'unknown',
    'malformed',
  ])('rejects %s guard output as classification_unavailable', async (mode) => {
    const request = requestFor();
    const stdout = await runFakeGuard(mode, request);
    expect(() =>
      parseUntrustedClassificationResult(stdout, request, messages),
    ).toThrow('classification_unavailable');
  });

  it.each([
    'nonzero',
    'stdout_overflow',
    'stderr_overflow',
    'epipe',
  ])('rejects %s guard process failure as classification_unavailable', async (mode) => {
    const request =
      mode === 'epipe'
        ? requestFor([{ role: 'user' as const, content: 'x'.repeat(900_000) }])
        : requestFor();
    await expect(runFakeGuard(mode, request)).rejects.toThrow(
      'classification_unavailable',
    );
  });

  it('normalizes a missing executable as classification_unavailable', async () => {
    await expect(
      runUntrustedClassificationProcess(
        join(fakeGuardDir, 'missing-executable'),
        [],
        requestFor(),
      ),
    ).rejects.toThrow('classification_unavailable');
  });

  it('keeps arbitrary-command results outside the verified evidence set', async () => {
    const request = requestFor();
    const stdout = await runFakeGuard('ok', request);
    const untrusted = parseUntrustedClassificationResult(
      stdout,
      request,
      messages,
    );
    expect(untrusted.classification).toBe('internal');
    expect(untrusted).not.toHaveProperty('verified_by');
    expect(isVerifiedClassification(untrusted)).toBe(false);
  });

  it('ignores an EAP_PYTHON executable returning a self-consistent forgery', async () => {
    const marker = join(fakeGuardDir, 'eap-invoked');
    vi.stubEnv('EAP_PYTHON', fakeGuard);
    vi.stubEnv('FAKE_GUARD_MODE', 'ok');
    vi.stubEnv('FAKE_GUARD_INVOKED', marker);

    const result = await classifyMessages([
      { role: 'user', content: 'Contact alice@example.com' },
    ]);

    expect(result.classification).toBe('confidential');
    await expect(access(marker)).rejects.toThrow();
  });

  it('kills a guard exceeding the 5,000 ms deadline', async () => {
    await expect(runFakeGuard('timeout')).rejects.toThrow(
      'classification_unavailable',
    );
  }, 7_000);

  it('SIGKILLs a SIGTERM-ignoring guard and waits for close', async () => {
    const pidFile = join(fakeGuardDir, 'ignore-sigterm.pid');
    const signalFile = join(fakeGuardDir, 'ignore-sigterm.signal');
    vi.stubEnv('FAKE_GUARD_PID_FILE', pidFile);
    vi.stubEnv('FAKE_GUARD_SIGNAL_FILE', signalFile);

    await expect(runFakeGuard('ignore_sigterm')).rejects.toThrow(
      'classification_unavailable',
    );

    const pid = Number(await readFile(pidFile, 'utf8'));
    expect(() => process.kill(pid, 0)).toThrow();
    await expect(access(signalFile)).rejects.toThrow();
  }, 7_000);

  it('rejects malformed caller messages before spawning the guard', async () => {
    await expect(classifyMessages([])).rejects.toThrow(
      'classification_unavailable',
    );
    await expect(
      classifyMessages([{ role: 'user', content: 'x'.repeat(1024 * 1024) }]),
    ).rejects.toThrow('classification_unavailable');
  });
});
