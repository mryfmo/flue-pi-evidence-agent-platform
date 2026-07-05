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
import { basename, join, relative, resolve } from 'node:path';
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

function missingZeroGuardDenominator(code: string): string | undefined {
  const denominator = code.match(/return \w+ \/ (?<denominator>\w+)/)?.groups
    ?.denominator;
  if (!denominator || code.includes(`if ${denominator} == 0:`)) {
    return undefined;
  }
  return denominator;
}

function missingIntegerValidationArgument(code: string): string | undefined {
  const argument = code.match(/return int\((?<argument>\w+)\)/)?.groups
    ?.argument;
  if (!argument || code.includes('normalized.isdigit()')) {
    return undefined;
  }
  return argument;
}

function missingDictKeyGuard(
  code: string,
): { key: string; expression: string } | undefined {
  const match = code.match(/return (?<name>\w+)\["(?<key>[^"]+)"\]/);
  const key = match?.groups?.key;
  if (
    !key ||
    code.includes(`.get("${key}"`) ||
    code.includes(`if "${key}" not in`)
  ) {
    return undefined;
  }
  return { key, expression: match[0] };
}

async function findPythonSourceFiles(workspace: string): Promise<string[]> {
  const root = resolve(workspace);
  const files: string[] = [];
  async function walk(relativePath: string): Promise<void> {
    const absolute = join(root, relativePath);
    const entry = await stat(absolute);
    if (entry.isDirectory()) {
      if (basename(absolute) === 'tests') return;
      for (const child of (await readdir(absolute)).sort()) {
        await walk(join(relativePath, child));
      }
      return;
    }
    if (entry.isFile() && absolute.endsWith('.py')) {
      files.push(absolute);
    }
  }
  await walk('');
  return files.sort();
}

export async function scanWorkspace(workspace: string): Promise<Hypothesis[]> {
  const hypotheses: Hypothesis[] = [];
  for (const sourcePath of await findPythonSourceFiles(workspace)) {
    const code = await readFile(sourcePath, 'utf8');
    const sourceName = basename(sourcePath);
    const denominator = missingZeroGuardDenominator(code);
    if (denominator) {
      hypotheses.push({
        id: 'HYP-DIVIDE-ZERO-001',
        title: 'division helper does not reject zero divisor before division',
        affectedFile: sourcePath,
        affectedSymbol: 'division helper',
        evidence: [
          `${sourceName} divides by ${denominator} without a zero-divisor guard`,
        ],
        status: 'localized',
        severity: 'medium',
        requiredChecks: ['pytest', 'rescan'],
      });
    }
    const integerArgument = missingIntegerValidationArgument(code);
    if (integerArgument) {
      hypotheses.push({
        id: 'HYP-DISCOUNT-VALIDATION-001',
        title: 'integer parser accepts invalid strings through raw int()',
        affectedFile: sourcePath,
        affectedSymbol: 'integer parser',
        evidence: [
          `${sourceName} contains \`return int(${integerArgument})\` without explicit input validation`,
        ],
        status: 'localized',
        severity: 'low',
        requiredChecks: ['pytest', 'rescan'],
      });
    }
    const dictKey = missingDictKeyGuard(code);
    if (dictKey) {
      hypotheses.push({
        id: 'HYP-DICT-KEY-GUARD-001',
        title: 'dictionary lookup can raise KeyError for a missing key',
        affectedFile: sourcePath,
        affectedSymbol: 'dictionary lookup',
        evidence: [
          `${sourceName} contains \`${dictKey.expression}\` without a missing-key guard`,
        ],
        status: 'localized',
        severity: 'low',
        requiredChecks: ['pytest', 'rescan'],
      });
    }
  }
  return hypotheses;
}

export function proposePatchCandidates(
  hypotheses: Hypothesis[],
): PatchCandidate[] {
  return hypotheses.flatMap((hypothesis) => {
    const isDictKey = hypothesis.id === 'HYP-DICT-KEY-GUARD-001';
    return [
      {
        id: `PATCH-${hypothesis.id}-MINIMAL`,
        hypothesisId: hypothesis.id,
        affectedFile: hypothesis.affectedFile,
        strategy: 'minimal_guard' as const,
        status: 'proposed' as const,
        rationale: isDictKey
          ? 'Use .get() with a safe default for the missing-key case.'
          : 'Smallest targeted change that satisfies the failing behavior.',
      },
      {
        id: `PATCH-${hypothesis.id}-VALIDATION`,
        hypothesisId: hypothesis.id,
        affectedFile: hypothesis.affectedFile,
        strategy: 'input_validation' as const,
        status: 'proposed' as const,
        rationale: isDictKey
          ? 'Add an explicit guard branch before indexing the dictionary.'
          : 'Explicit defensive validation for the affected boundary.',
      },
    ];
  });
}

export function sourceArtifactPaths(
  workspace: string,
  hypotheses: Hypothesis[],
): string[] {
  const root = resolve(workspace);
  return [
    ...new Set(
      hypotheses.map((hypothesis) => relative(root, hypothesis.affectedFile)),
    ),
  ]
    .filter((path) => path && !path.startsWith('..'))
    .sort();
}

export async function applySelectedPatches(
  workspace: string,
  candidates: PatchCandidate[],
): Promise<{ hypothesesPatched: string[]; appliedPatchIds: string[] }> {
  const fileCodes = new Map<string, string>();
  const hypothesesPatched: string[] = [];
  const appliedPatchIds: string[] = [];
  for (const candidate of candidates) {
    if (candidate.status !== 'proposed' || !candidate.id.endsWith('-MINIMAL'))
      continue;
    const affectedFile = candidate.affectedFile;
    let code =
      fileCodes.get(affectedFile) ?? (await readFile(affectedFile, 'utf8'));
    if (
      candidate.hypothesisId === 'HYP-DIVIDE-ZERO-001' &&
      missingZeroGuardDenominator(code)
    ) {
      const before = code;
      code = code
        .replace(
          'def divide(a: float, b: float) -> float:\n    return a / b\n',
          'def divide(a: float, b: float) -> float:\n    if b == 0:\n        raise ValueError("division by zero")\n    return a / b\n',
        )
        .replace(
          'def average(total: float, count: float) -> float:\n    return total / count\n',
          'def average(total: float, count: float) -> float:\n    if count == 0:\n        raise ValueError("division by zero")\n    return total / count\n',
        );
      if (code !== before) {
        hypothesesPatched.push(candidate.hypothesisId);
        appliedPatchIds.push(candidate.id);
      }
    }
    if (
      candidate.hypothesisId === 'HYP-DISCOUNT-VALIDATION-001' &&
      missingIntegerValidationArgument(code)
    ) {
      const before = code;
      code = code
        .replace(
          'def parse_discount(value: str) -> int:\n    return int(value)\n',
          'def parse_discount(value: str) -> int:\n    normalized = value.strip()\n    if not normalized.isdigit():\n        raise ValueError("discount must be a non-negative integer")\n    return int(normalized)\n',
        )
        .replace(
          'def parse_quantity(raw: str) -> int:\n    return int(raw)\n',
          'def parse_quantity(raw: str) -> int:\n    normalized = raw.strip()\n    if not normalized.isdigit():\n        raise ValueError("quantity must be a non-negative integer")\n    return int(normalized)\n',
        );
      if (code !== before) {
        hypothesesPatched.push(candidate.hypothesisId);
        appliedPatchIds.push(candidate.id);
      }
    }
    if (
      candidate.hypothesisId === 'HYP-DICT-KEY-GUARD-001' &&
      missingDictKeyGuard(code)
    ) {
      const before = code;
      code = code
        .replace(
          'def preferred_region(profile: dict[str, str]) -> str:\n    return profile["region"]\n',
          'def preferred_region(profile: dict[str, str]) -> str:\n    return profile.get("region", "unknown")\n',
        )
        .replace(
          'def country_code(account: dict[str, str]) -> str:\n    return account["country"]\n',
          'def country_code(account: dict[str, str]) -> str:\n    return account.get("country", "ZZ")\n',
        );
      if (code !== before) {
        hypothesesPatched.push(candidate.hypothesisId);
        appliedPatchIds.push(candidate.id);
      }
    }
    fileCodes.set(affectedFile, code);
  }
  for (const [filePath, code] of fileCodes) {
    await writeFile(filePath, code, 'utf8');
  }
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
