/** Python OSS data proxy bridge for SQLGlot, DuckDB, and Presidio. */
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { accessSync, constants, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import type { DataQueryResult } from './types.ts';

const execFileAsync = promisify(execFile);
const MAX_STDOUT_BYTES = 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const GUARD_TIMEOUT_MS = 5000;
const DEPLOYMENT_ROOT = resolve(process.cwd());
const CLASSIFICATION_PYTHON = resolve(DEPLOYMENT_ROOT, '.venv/bin/python');
const CLASSIFICATION_SCRIPT = resolve(DEPLOYMENT_ROOT, 'scripts/data_guard.py');
const RESULT_KEYS = [
  'schema_version',
  'producer',
  'evidence_kind',
  'request_sha256',
  'redacted_sha256',
  'classification',
  'entities_found',
  'messages',
] as const;
const ROLES = new Set(['system', 'user', 'assistant']);
const verifiedClassifications = new WeakSet<object>();

export interface GuardMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface VerifiedClassification {
  schema_version: 1;
  producer: 'flue-pi-data-guard';
  evidence_kind: 'presidio-sqlglot-redaction-v1';
  verified_by: 'flue-pi-platform-gateway';
  request_sha256: string;
  redacted_sha256: string;
  classification: 'internal' | 'confidential' | 'restricted';
  entities_found: number;
  messages: readonly GuardMessage[];
}

export type UntrustedClassification = Omit<
  VerifiedClassification,
  'verified_by'
>;

export function isVerifiedClassification(
  value: unknown,
): value is VerifiedClassification {
  return (
    typeof value === 'object' &&
    value !== null &&
    verifiedClassifications.has(value)
  );
}

export function pythonBinary(): string {
  if (process.env.EAP_PYTHON) return process.env.EAP_PYTHON;
  if (existsSync('.venv/bin/python')) return '.venv/bin/python';
  return 'python';
}

export async function metricQuery(): Promise<DataQueryResult> {
  const { stdout } = await execFileAsync(
    pythonBinary(),
    ['scripts/data_guard.py', 'metric'],
    { maxBuffer: 1024 * 1024 },
  );
  return JSON.parse(stdout) as DataQueryResult;
}

export interface RedactTextResult {
  redacted_text: string;
  entities_found: number;
}

export async function redactText(text: string): Promise<RedactTextResult> {
  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(pythonBinary(), [
      'scripts/data_guard.py',
      'redact_text',
    ]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(out).toString('utf8'));
        return;
      }
      reject(new Error(Buffer.concat(err).toString('utf8') || `exit ${code}`));
    });
    child.stdin.end(JSON.stringify({ text }));
  });
  return JSON.parse(stdout) as RedactTextResult;
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function hasExactKeys(value: object, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return (
    actual.length === keys.length && actual.every((key, i) => key === keys[i])
  );
}

function isGuardMessage(value: unknown): value is GuardMessage {
  if (
    !value ||
    typeof value !== 'object' ||
    !hasExactKeys(value, ['role', 'content'])
  ) {
    return false;
  }
  const message = value as Record<string, unknown>;
  return (
    typeof message.role === 'string' &&
    ROLES.has(message.role) &&
    typeof message.content === 'string'
  );
}

export function runUntrustedClassificationProcess(
  executable: string,
  args: readonly string[],
  request: Buffer,
  timeoutMs = GUARD_TIMEOUT_MS,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args);
    const stdout: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let failure = false;
    let settled = false;

    const fail = () => {
      if (failure) return;
      failure = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    };
    const onStdout = (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_STDOUT_BYTES) return fail();
      stdout.push(chunk);
    };
    const onStderr = (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes > MAX_STDERR_BYTES) fail();
    };
    const onError = () => fail();
    const onClose = (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.off('data', onStdout);
      child.stderr.off('data', onStderr);
      child.stdin.off('error', onError);
      child.off('error', onError);
      child.off('close', onClose);
      child.stdin.destroy();
      if (failure || code !== 0)
        reject(new Error('classification_unavailable'));
      else resolve(Buffer.concat(stdout).toString('utf8'));
    };
    const timer = setTimeout(fail, timeoutMs);

    child.stdout.on('data', onStdout);
    child.stderr.on('data', onStderr);
    child.stdin.on('error', onError);
    child.on('error', onError);
    child.on('close', onClose);
    try {
      child.stdin.end(request);
    } catch {
      fail();
    }
  });
}

function runClassificationGuard(request: Buffer): Promise<string> {
  try {
    accessSync(CLASSIFICATION_PYTHON, constants.X_OK);
    accessSync(CLASSIFICATION_SCRIPT, constants.R_OK);
  } catch {
    return Promise.reject(new Error('classification_unavailable'));
  }
  return runUntrustedClassificationProcess(
    CLASSIFICATION_PYTHON,
    [CLASSIFICATION_SCRIPT, 'classify_messages'],
    request,
  );
}

export function parseUntrustedClassificationResult(
  stdout: string,
  request: Buffer,
  messages: readonly GuardMessage[],
): UntrustedClassification {
  try {
    const parsed: unknown = JSON.parse(stdout);
    if (
      !Array.isArray(messages) ||
      !messages.every(isGuardMessage) ||
      !parsed ||
      typeof parsed !== 'object' ||
      !hasExactKeys(parsed, RESULT_KEYS) ||
      stdout !== `${JSON.stringify(parsed)}\n`
    ) {
      throw new Error('non-canonical guard result');
    }
    const result = parsed as Record<string, unknown>;
    const redactedMessages = result.messages;
    if (
      result.schema_version !== 1 ||
      result.producer !== 'flue-pi-data-guard' ||
      result.evidence_kind !== 'presidio-sqlglot-redaction-v1' ||
      typeof result.request_sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(result.request_sha256) ||
      result.request_sha256 !== sha256(request) ||
      typeof result.redacted_sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(result.redacted_sha256) ||
      !['internal', 'confidential', 'restricted'].includes(
        String(result.classification),
      ) ||
      typeof result.entities_found !== 'number' ||
      !Number.isInteger(result.entities_found) ||
      result.entities_found < 0 ||
      !Array.isArray(redactedMessages) ||
      redactedMessages.length !== messages.length ||
      !redactedMessages.every(isGuardMessage) ||
      !redactedMessages.every(
        (message, index) => message.role === messages[index]?.role,
      ) ||
      result.redacted_sha256 !== sha256(JSON.stringify(redactedMessages))
    ) {
      throw new Error('invalid guard result');
    }
    return {
      schema_version: 1,
      producer: 'flue-pi-data-guard',
      evidence_kind: 'presidio-sqlglot-redaction-v1',
      request_sha256: result.request_sha256,
      redacted_sha256: result.redacted_sha256,
      classification:
        result.classification as UntrustedClassification['classification'],
      entities_found: result.entities_found,
      messages: redactedMessages,
    };
  } catch {
    throw new Error('classification_unavailable');
  }
}

export async function classifyMessages(
  messages: readonly GuardMessage[],
): Promise<VerifiedClassification> {
  try {
    if (
      !Array.isArray(messages) ||
      messages.length < 1 ||
      messages.length > 128 ||
      !messages.every(isGuardMessage)
    ) {
      throw new Error('invalid messages');
    }
    const request = Buffer.from(
      JSON.stringify({ schema_version: 1, messages }),
    );
    if (request.length > MAX_STDOUT_BYTES) throw new Error('request too large');
    const stdout = await runClassificationGuard(request);
    const result = parseUntrustedClassificationResult(
      stdout,
      request,
      messages,
    );
    const frozenMessages = Object.freeze(
      result.messages.map((message) => Object.freeze({ ...message })),
    );
    const verified: VerifiedClassification = Object.freeze({
      schema_version: 1,
      producer: 'flue-pi-data-guard',
      evidence_kind: 'presidio-sqlglot-redaction-v1',
      verified_by: 'flue-pi-platform-gateway',
      request_sha256: result.request_sha256,
      redacted_sha256: result.redacted_sha256,
      classification:
        result.classification as VerifiedClassification['classification'],
      entities_found: result.entities_found,
      messages: frozenMessages,
    });
    verifiedClassifications.add(verified);
    return verified;
  } catch {
    throw new Error('classification_unavailable');
  }
}

export async function unsafeQueryExitCode(command = 'unsafe'): Promise<number> {
  try {
    await execFileAsync(pythonBinary(), ['scripts/data_guard.py', command], {
      maxBuffer: 1024 * 1024,
    });
    return 0;
  } catch (error) {
    const err = error as { code?: number };
    return typeof err.code === 'number' ? err.code : 1;
  }
}
