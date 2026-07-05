/** Python OSS data proxy bridge for SQLGlot, DuckDB, and Presidio. */
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import type { DataQueryResult } from './types.ts';

const execFileAsync = promisify(execFile);

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
