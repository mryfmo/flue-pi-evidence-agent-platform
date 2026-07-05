/** Python OSS data proxy bridge for SQLGlot, DuckDB, and Presidio. */
import { execFile } from 'node:child_process';
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
