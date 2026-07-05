import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const validationDir = 'artifacts/validation';
rmSync(validationDir, { recursive: true, force: true });
mkdirSync(validationDir, { recursive: true });
mkdirSync('artifacts/sbom', { recursive: true });

const node = './node_modules/node/bin/node';
const commands = [
  ['setup_python', node, ['scripts/setup-python.mjs']],
  ['spec_traceability', node, ['scripts/spec-check.mjs']],
  [
    'format',
    './node_modules/.bin/biome',
    [
      'format',
      '--diagnostic-level=error',
      'src',
      'tests',
      'scripts',
      'flue.config.ts',
    ],
  ],
  [
    'lint',
    './node_modules/.bin/biome',
    [
      'lint',
      '--diagnostic-level=error',
      'src',
      'tests',
      'scripts',
      'flue.config.ts',
    ],
  ],
  ['typecheck', './node_modules/.bin/tsc', ['--noEmit']],
  ['opa', node, ['scripts/opa-check.mjs']],
  [
    'python_compile',
    '.venv/bin/python',
    ['-m', 'py_compile', 'scripts/data_guard.py'],
  ],
  ['python_ruff', '.venv/bin/ruff', ['check', 'scripts', 'tests_py']],
  ['python_mypy', '.venv/bin/mypy', ['scripts/data_guard.py']],
  [
    'python_bandit',
    '.venv/bin/bandit',
    ['-q', '-r', 'scripts', '-x', 'scripts/__pycache__'],
  ],
  [
    'python_tests',
    '.venv/bin/python',
    [
      '-m',
      'pytest',
      '-q',
      'tests_py',
      '--cov=scripts',
      '--cov-report=term-missing',
      '--cov-fail-under=85',
    ],
  ],
  [
    'vitest_all',
    'bash',
    ['-lc', 'timeout 180 ./node_modules/.bin/vitest run --pool=forks'],
  ],
  [
    'flue_build',
    node,
    ['./node_modules/@flue/cli/bin/flue.mjs', 'build', '--target', 'node'],
  ],
  ['e2e_artifacts', node, ['scripts/assert-e2e-artifacts.mjs']],
  [
    'npm_audit_prod',
    'bash',
    ['-lc', 'timeout 60 npm audit --audit-level=high --omit=dev'],
  ],
  [
    'npm_sbom_prod',
    'bash',
    ['-lc', 'timeout 60 npm sbom --omit=dev --sbom-format=cyclonedx --json'],
  ],
];

const results = [];
for (const [name, cmd, args] of commands) {
  const start = Date.now();
  const completed = spawnSync(cmd, args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 120_000,
  });
  let stdout = completed.stdout ?? '';
  if (name === 'npm_sbom_prod') {
    mkdirSync('artifacts/sbom', { recursive: true });
    writeFileSync('artifacts/sbom/npm-cyclonedx.json', stdout, 'utf8');
    stdout = `wrote artifacts/sbom/npm-cyclonedx.json\n${stdout.slice(0, 500)}`;
  }
  writeFileSync(`${validationDir}/${name}.stdout.log`, stdout, 'utf8');
  writeFileSync(
    `${validationDir}/${name}.stderr.log`,
    completed.stderr ?? '',
    'utf8',
  );
  const result = {
    name,
    status: completed.status === 0 ? 'passed' : 'failed',
    returnCode: completed.status,
    durationMs: Date.now() - start,
  };
  results.push(result);
  if (completed.status !== 0) {
    writeReport('failed', results);
    process.exit(completed.status ?? 1);
  }
}
writeReport('passed', results);
console.log('validate-release:passed');
process.exit(0);

function writeReport(status, results) {
  const report = {
    status,
    generatedAt: new Date().toISOString(),
    node: execFileSync(node, ['--version'], { encoding: 'utf8' }).trim(),
    results,
  };
  writeFileSync(
    `${validationDir}/final_verification_report.json`,
    JSON.stringify(report, null, 2),
    'utf8',
  );
  const md = [
    '# Final verification report',
    '',
    `overall: ${status}`,
    '',
    ...results.map(
      (item) => `- ${item.name}: ${item.status} (${item.durationMs}ms)`,
    ),
    '',
  ].join('\n');
  writeFileSync(`${validationDir}/final_verification_report.md`, md, 'utf8');
}
