/** Code scanning, patch fan-out, and verification for remediation workflows. */
import { execFile } from 'node:child_process';
import {
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { SandboxExecutor, SandboxFile, SandboxHandle } from './sandbox.ts';
import type {
  Hypothesis,
  PatchCandidate,
  VerificationResult,
} from './types.ts';

const execFileAsync = promisify(execFile);

export async function prepareWorkspace(source: string): Promise<string> {
  const target = resolve(
    'artifacts/demo/workspace',
    `${basename(source)}-${process.pid}-${randomUUID()}`,
  );
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(source, target, { recursive: true });
  return target;
}

export async function readWorkspaceFiles(
  source: string,
): Promise<SandboxFile[]> {
  const root = resolve(source);
  const files: SandboxFile[] = [];
  async function walk(relativePath: string): Promise<void> {
    const absolute = join(root, relativePath);
    const entry = await stat(absolute);
    if (entry.isDirectory()) {
      for (const child of (await readdir(absolute)).sort()) {
        await walk(join(relativePath, child));
      }
      return;
    }
    if (entry.isFile()) {
      files.push({
        path: relativePath,
        content: await readFile(absolute),
        mode: entry.mode,
      });
    }
  }
  await walk('');
  return files;
}

function hasMissingZeroGuard(code: string): boolean {
  return code.includes('return a / b') && !code.includes('if b == 0:');
}

function hasMissingIntegerValidation(code: string): boolean {
  return (
    code.includes('return int(value)') && !code.includes('normalized.isdigit()')
  );
}

export async function scanWorkspace(workspace: string): Promise<Hypothesis[]> {
  const appPath = join(workspace, 'app.py');
  const code = await readFile(appPath, 'utf8');
  const hypotheses: Hypothesis[] = [];
  if (hasMissingZeroGuard(code)) {
    hypotheses.push({
      id: 'HYP-DIVIDE-ZERO-001',
      title: 'divide() does not reject zero divisor before division',
      affectedFile: appPath,
      affectedSymbol: 'divide',
      evidence: ['app.py contains `return a / b` without a zero-divisor guard'],
      status: 'localized',
      severity: 'medium',
      requiredChecks: ['pytest', 'rescan'],
    });
  }
  if (hasMissingIntegerValidation(code)) {
    hypotheses.push({
      id: 'HYP-DISCOUNT-VALIDATION-001',
      title:
        'parse_discount() accepts invalid integer strings through raw int()',
      affectedFile: appPath,
      affectedSymbol: 'parse_discount',
      evidence: [
        'app.py contains `return int(value)` without explicit input validation',
      ],
      status: 'localized',
      severity: 'low',
      requiredChecks: ['pytest', 'rescan'],
    });
  }
  return hypotheses;
}

export function proposePatchCandidates(
  hypotheses: Hypothesis[],
): PatchCandidate[] {
  return hypotheses.flatMap((hypothesis) => [
    {
      id: `PATCH-${hypothesis.id}-MINIMAL`,
      hypothesisId: hypothesis.id,
      affectedFile: hypothesis.affectedFile,
      strategy: 'minimal_guard' as const,
      status: 'proposed' as const,
      rationale:
        'Smallest targeted change that satisfies the failing behavior.',
    },
    {
      id: `PATCH-${hypothesis.id}-VALIDATION`,
      hypothesisId: hypothesis.id,
      affectedFile: hypothesis.affectedFile,
      strategy: 'input_validation' as const,
      status: 'proposed' as const,
      rationale: 'Explicit defensive validation for the affected boundary.',
    },
  ]);
}

export async function applySelectedPatches(
  workspace: string,
  candidates: PatchCandidate[],
): Promise<{ hypothesesPatched: string[]; appliedPatchIds: string[] }> {
  const appPath = join(workspace, 'app.py');
  let code = await readFile(appPath, 'utf8');
  const hypothesesPatched: string[] = [];
  const appliedPatchIds: string[] = [];
  for (const candidate of candidates) {
    if (candidate.status !== 'proposed' || !candidate.id.endsWith('-MINIMAL'))
      continue;
    if (
      candidate.hypothesisId === 'HYP-DIVIDE-ZERO-001' &&
      code.includes('return a / b') &&
      !code.includes('if b == 0:')
    ) {
      code = code.replace(
        'def divide(a: float, b: float) -> float:\n    return a / b\n',
        'def divide(a: float, b: float) -> float:\n    if b == 0:\n        raise ValueError("division by zero")\n    return a / b\n',
      );
      hypothesesPatched.push(candidate.hypothesisId);
      appliedPatchIds.push(candidate.id);
    }
    if (
      candidate.hypothesisId === 'HYP-DISCOUNT-VALIDATION-001' &&
      code.includes('return int(value)') &&
      !code.includes('normalized.isdigit()')
    ) {
      code = code.replace(
        'def parse_discount(value: str) -> int:\n    return int(value)\n',
        'def parse_discount(value: str) -> int:\n    normalized = value.strip()\n    if not normalized.isdigit():\n        raise ValueError("discount must be a non-negative integer")\n    return int(normalized)\n',
      );
      hypothesesPatched.push(candidate.hypothesisId);
      appliedPatchIds.push(candidate.id);
    }
  }
  await writeFile(appPath, code, 'utf8');
  return { hypothesesPatched, appliedPatchIds };
}

export async function verifyWorkspace(
  workspace: string,
): Promise<VerificationResult> {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.env.EAP_PYTHON ?? resolve('.venv/bin/python'),
      ['-m', 'pytest', '-q'],
      { cwd: workspace, maxBuffer: 1024 * 1024, timeout: 30_000 },
    );
    return {
      passed: true,
      command: 'python -m pytest -q',
      stdout,
      stderr,
      exitCode: 0,
    };
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; code?: number };
    return {
      passed: false,
      command: 'python -m pytest -q',
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
      exitCode: typeof err.code === 'number' ? err.code : 1,
    };
  }
}

export async function verifyWorkspaceWithExecutor(
  executor: SandboxExecutor,
  handle: SandboxHandle,
): Promise<VerificationResult> {
  const result = await executor.exec(
    handle,
    [
      process.env.EAP_PYTHON ?? resolve('.venv/bin/python'),
      '-m',
      'pytest',
      '-q',
    ],
    {
      timeoutMs: 30_000,
      audit_id: handle.audit_id,
      trace_id: handle.trace_id,
    },
  );
  return {
    passed: result.exitCode === 0,
    command: 'python -m pytest -q',
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}
