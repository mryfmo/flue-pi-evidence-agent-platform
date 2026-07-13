import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error Production validation is an executable ESM script.
import * as validationManifest from '../../scripts/validation-manifest.mjs';

const {
  GATES,
  canonicalJson,
  collectSourceIdentity,
  createGateRecord,
  createValidationReport,
  digest,
  writeGateRecord,
  writeValidationReport,
} = validationManifest;

const repo = resolve('.');
const node = resolve(repo, 'node_modules/node/bin/node');

describe('validation evidence binding', () => {
  it('rejects source drift', () => {
    const fixture = cleanFixture();
    expect(runOps(fixture).status).toBe(0);

    writeFileSync(join(fixture, 'src/app.ts'), 'export const value = 2;\n');
    expect(runOps(fixture).stdout).toContain('byte digest mismatch');

    git(fixture, ['add', 'src/app.ts']);
    expect(runOps(fixture).status).toBe(1);

    writeFileSync(join(fixture, 'src/app.ts'), 'export const value = 1;\n');
    git(fixture, ['add', 'src/app.ts']);
    writeFileSync(join(fixture, 'src/untracked.ts'), 'export {};\n');
    expect(runOps(fixture).status).toBe(1);
  });

  it('rejects gate set drift', () => {
    const fixture = cleanFixture();
    const identity = collectSourceIdentity(fixture);
    const canonical = JSON.parse(
      readFileSync(
        join(fixture, 'artifacts/validation/final_verification_report.json'),
        'utf8',
      ),
    ).results;
    const mutations = [
      canonical.slice(1),
      [...canonical, { ...canonical[0], name: 'extra_gate' }],
      [canonical[1], canonical[0], ...canonical.slice(2)],
      [canonical[0], canonical[0], ...canonical.slice(2)],
      [
        { ...canonical[0], args: [...canonical[0].args, '--drift'] },
        ...canonical.slice(1),
      ],
      [{ ...canonical[0], executable: '/usr/bin/true' }, ...canonical.slice(1)],
    ];
    for (const results of mutations) {
      writeValidationReport(
        createValidationReport({ status: 'passed', results, identity }),
        fixture,
      );
      expect(runOps(fixture).status).toBe(1);
    }
  });

  it('verifies release file digests', () => {
    const fixture = cleanFixture();
    expect(runManifest(fixture, ['--check']).status).toBe(0);
    const manifestPath = join(fixture, 'RELEASE_FILE_MANIFEST.json');
    const original = readFileSync(manifestPath, 'utf8');

    writeFileSync(join(fixture, 'src/app.ts'), 'export const value = 0;\n');
    expect(runManifest(fixture, ['--check']).stderr).toContain(
      'byte digest mismatch',
    );
    writeFileSync(join(fixture, 'src/app.ts'), 'export const value = 1;\n');

    const manifest = JSON.parse(original);
    const ghost = {
      path: 'src/ghost.ts',
      mode: '100644',
      bytes: 0,
      sha256: '0'.repeat(64),
    };
    const variants = [
      [{ ...manifest, files: manifest.files.slice(1) }, 'extra path='],
      [
        {
          ...manifest,
          files: [...manifest.files, ghost].sort((left, right) =>
            Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)),
          ),
        },
        'missing path=src/ghost.ts',
      ],
      [
        { ...manifest, files: [manifest.files[0], ...manifest.files] },
        'duplicate path=',
      ],
      [
        {
          ...manifest,
          files: [
            {
              path: '../escape',
              mode: '100644',
              bytes: 0,
              sha256: '0'.repeat(64),
            },
            ...manifest.files,
          ],
        },
        'noncanonical path=../escape',
      ],
    ];
    for (const [variant, diagnostic] of variants) {
      writeFileSync(manifestPath, `${canonicalJson(variant)}\n`);
      const result = runManifest(fixture, ['--check']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(diagnostic);
    }

    writeFileSync(manifestPath, original);
    symlinkSync('app.ts', join(fixture, 'src/link.ts'));
    expect(runManifest(fixture, ['--check']).stderr).toContain(
      'symlink rejected',
    );
    rmSync(join(fixture, 'src/link.ts'));

    mkdirSync(join(fixture, 'a'));
    writeFileSync(join(fixture, 'a/x'), 'nested\n');
    writeFileSync(join(fixture, 'a.txt'), 'sibling\n');
    expect(runManifest(fixture, ['--write-release-files']).status).toBe(0);
    expect(runManifest(fixture, ['--check']).status).toBe(0);
    const paths = JSON.parse(readFileSync(manifestPath, 'utf8')).files.map(
      (entry: { path: string }) => entry.path,
    );
    expect(paths.indexOf('a.txt')).toBeLessThan(paths.indexOf('a/x'));
  });

  it('rejects hidden worktree and index drift', () => {
    const assumed = cleanFixture();
    git(assumed, ['update-index', '--assume-unchanged', 'src/app.ts']);
    git(assumed, [
      'update-index',
      '--assume-unchanged',
      'RELEASE_FILE_MANIFEST.json',
    ]);
    writeFileSync(join(assumed, 'src/app.ts'), 'export const value = 2;\n');
    expect(runManifest(assumed, ['--write-release-files']).status).toBe(0);
    const assumedIdentity = runManifest(assumed, ['--source-identity']);
    expect(assumedIdentity.status).toBe(0);
    expect(JSON.parse(assumedIdentity.stdout).dirty).toBe(true);

    const skipped = cleanFixture();
    git(skipped, ['update-index', '--skip-worktree', 'src/app.ts']);
    const skippedIdentity = runManifest(skipped, ['--source-identity']);
    expect(skippedIdentity.status).toBe(0);
    expect(JSON.parse(skippedIdentity.stdout).dirty).toBe(true);

    const infoExcluded = cleanFixture();
    writeFileSync(join(infoExcluded, '.git/info/exclude'), 'src/hidden.ts\n');
    writeFileSync(join(infoExcluded, 'src/hidden.ts'), 'export {};\n');
    expect(runManifest(infoExcluded, ['--check']).stderr).toContain(
      'extra path=src/hidden.ts',
    );

    const ignored = cleanFixture();
    writeFileSync(
      join(ignored, '.gitignore'),
      'artifacts/validation/\nsrc/ignored.ts\n',
    );
    writeFileSync(join(ignored, 'src/ignored.ts'), 'export {};\n');
    expect(runManifest(ignored, ['--write-release-files']).status).toBe(0);
    const ignoredManifest = JSON.parse(
      readFileSync(join(ignored, 'RELEASE_FILE_MANIFEST.json'), 'utf8'),
    );
    expect(
      ignoredManifest.files.some(
        (entry: { path: string }) => entry.path === 'src/ignored.ts',
      ),
    ).toBe(true);

    const filtered = cleanFixture();
    writeFileSync(
      join(filtered, '.gitattributes'),
      'src/eol.txt text eol=crlf\n',
    );
    writeFileSync(join(filtered, 'src/eol.txt'), 'line one\nline two\n');
    git(filtered, ['add', '.gitattributes', 'src/eol.txt']);
    git(filtered, ['commit', '-qm', 'filtered file']);
    writeFileSync(join(filtered, 'src/eol.txt'), 'force checkout\n');
    git(filtered, ['checkout', '--', 'src/eol.txt']);
    expect(runManifest(filtered, ['--write-release-files']).status).toBe(0);
    git(filtered, ['add', 'RELEASE_FILE_MANIFEST.json']);
    git(filtered, ['commit', '-qm', 'filtered manifest']);
    const filteredIdentity = runManifest(filtered, ['--source-identity']);
    expect(filteredIdentity.status).toBe(0);
    expect(JSON.parse(filteredIdentity.stdout).dirty).toBe(false);
  });

  it('rejects report digest tampering and unknown fields', () => {
    const fixture = cleanFixture();
    const reportPath = join(
      fixture,
      'artifacts/validation/final_verification_report.json',
    );
    const report = JSON.parse(readFileSync(reportPath, 'utf8'));
    report.results[0].durationMs += 1;
    writeValidationReport(report, fixture);
    expect(runOps(fixture).stdout).toContain('evidence digest mismatch');

    const identity = collectSourceIdentity(fixture);
    const unknown = createValidationReport({
      status: 'passed',
      results: JSON.parse(readFileSync(reportPath, 'utf8')).results,
      identity,
    });
    (unknown as Record<string, unknown>).untrusted = true;
    writeValidationReport(unknown, fixture);
    expect(runOps(fixture).stdout).toContain('unknown or missing fields');

    const missingRecord = cleanFixture();
    rmSync(
      join(missingRecord, 'artifacts/validation/setup_python.record.json'),
    );
    expect(runOps(missingRecord).stdout).toContain('execution record missing');
  });

  it('rejects malformed CI evidence without a trusted API binding', () => {
    const fixture = cleanFixture();
    mkdirSync(join(fixture, 'artifacts/ci'), { recursive: true });
    mkdirSync(join(fixture, '.github/workflows'), { recursive: true });
    writeFileSync(
      join(fixture, '.github/workflows/validate-release.yml'),
      [
        'name: Validate release',
        'jobs:',
        '  validate-release:',
        '    name: Validate release',
        '    steps:',
        '      - uses: actions/upload-artifact@v4',
        '        with:',
        '          name: validate-release-evidence',
        '  opensandbox-integration:',
        '    name: OpenSandbox integration',
        '    steps:',
        '      - uses: actions/upload-artifact@v4',
        '        with:',
        '          name: opensandbox-integration-evidence',
        '  python-matrix:',
        '    name: Python ${{ matrix.python }}',
        '    strategy:',
        '      matrix:',
        '        python: [3.11, 3.13]',
        '    steps:',
        '      - uses: actions/upload-artifact@v4',
        '        with:',
        '          name: python-${{ matrix.python }}-evidence',
        '',
      ].join('\n'),
    );
    git(fixture, ['add', '.github/workflows/validate-release.yml']);
    git(fixture, ['commit', '-qm', 'workflow']);
    expect(runManifest(fixture, ['--write-release-files']).status).toBe(0);
    git(fixture, ['add', 'RELEASE_FILE_MANIFEST.json']);
    git(fixture, ['commit', '-qm', 'workflow manifest']);
    writePassingEvidence(fixture);
    const identity = collectSourceIdentity(fixture);
    const revision = git(fixture, ['rev-parse', 'HEAD']).trim();
    const archive = join(fixture, 'artifacts/ci/evidence.zip');
    execFileSync('zip', ['-qr', archive, 'validation', 'sbom'], {
      cwd: join(fixture, 'artifacts'),
    });
    const runIdFile = join(fixture, 'artifacts/ci/run-id');
    writeFileSync(runIdFile, '123\n');
    const fakeBin = join(fixture, 'artifacts/fake-bin');
    writeFakeGh(fakeBin, {
      archive,
      archiveDigest: digest(readFileSync(archive)),
      conclusion: 'success',
      revision,
      sourceTreeDigest: identity.treeDigest,
    });
    const positive = runCi(fixture, runIdFile, fakeBin);
    expect(positive.stderr).toBe('');
    expect({
      status: positive.status,
      stdout: positive.stdout,
      stderr: positive.stderr,
    }).toMatchObject({ status: 0 });

    for (const origin of [
      'https://github.com/acme/repo',
      'https://github.com/acme/repo.git',
      'ssh://git@github.com/acme/repo',
      'ssh://git@github.com/acme/repo.git',
      'git@github.com:acme/repo',
      'git@github.com:acme/repo.git',
    ]) {
      git(fixture, ['remote', 'set-url', 'origin', origin]);
      expect(runCi(fixture, runIdFile, fakeBin).status).toBe(0);
    }
    for (const origin of [
      'https://evilgithub.com/acme/repo.git',
      'https://github.com.evil/acme/repo.git',
      'https://user@github.com/acme/repo.git',
      'https://github.com:443/acme/repo.git',
      'https://github.com/acme/repo.git?download=1',
      'https://github.com/acme/repo.git#fragment',
      'https://github.com/acme/extra/repo.git',
      'https://github.com/acme%2Frepo/other.git',
      'https://github.com/acme/repo%2Fother.git',
      'https://github.com/-acme/repo.git',
      'https://github.com/acme-/repo.git',
      'https://github.com/acme/..',
      '/tmp/github.com/acme/repo',
      'https://github.com/acme/repo.git\u0001',
    ]) {
      git(fixture, ['remote', 'set-url', 'origin', origin]);
      expect(runCi(fixture, runIdFile, fakeBin).status).toBe(1);
    }
    git(fixture, [
      'remote',
      'set-url',
      'origin',
      'https://github.com/acme/repo.git',
    ]);

    const reportPath = join(
      fixture,
      'artifacts/validation/final_verification_report.json',
    );
    const nestedUnknown = JSON.parse(readFileSync(reportPath, 'utf8'));
    nestedUnknown.source.untrusted = true;
    delete nestedUnknown.evidenceDigest;
    nestedUnknown.evidenceDigest = digest(canonicalJson(nestedUnknown));
    writeValidationReport(nestedUnknown, fixture);
    execFileSync('zip', ['-q', '-FS', archive, 'validation', 'sbom'], {
      cwd: join(fixture, 'artifacts'),
    });
    writeFakeGh(fakeBin, {
      archive,
      archiveDigest: digest(readFileSync(archive)),
      conclusion: 'success',
      revision,
      sourceTreeDigest: identity.treeDigest,
    });
    expect(runCi(fixture, runIdFile, fakeBin).status).toBe(1);
    writePassingEvidence(fixture);
    execFileSync('zip', ['-q', '-FS', archive, 'validation', 'sbom'], {
      cwd: join(fixture, 'artifacts'),
    });

    expect(
      run(fixture, 'ci-evidence-check.mjs', [
        '--evidence',
        'forged.json',
        '--github-run',
        'forged.json',
        '--artifact',
        archive,
      ]).status,
    ).toBe(1);

    writeFakeGh(fakeBin, {
      archive,
      archiveDigest: digest(readFileSync(archive)),
      conclusion: 'failure',
      revision,
      sourceTreeDigest: identity.treeDigest,
    });
    expect(runCi(fixture, runIdFile, fakeBin).status).toBe(1);

    writeFakeGh(fakeBin, {
      archive,
      archiveDigest: '0'.repeat(64),
      conclusion: 'success',
      revision,
      sourceTreeDigest: identity.treeDigest,
    });
    expect(runCi(fixture, runIdFile, fakeBin).status).toBe(1);

    const jobEvidence = join(fixture, 'artifacts/job-evidence');
    mkdirSync(jobEvidence, { recursive: true });
    writeFileSync(join(jobEvidence, 'server.log'), 'ok\n');
    const jobArchive = join(fixture, 'artifacts/ci/job-evidence.zip');
    execFileSync('zip', ['-qr', jobArchive, 'server.log'], {
      cwd: jobEvidence,
    });
    writeFakeGh(fakeBin, {
      archive: jobArchive,
      archiveDigest: digest(readFileSync(jobArchive)),
      artifactName: 'opensandbox-integration-evidence',
      conclusion: 'success',
      jobName: 'OpenSandbox integration',
      revision,
      sourceTreeDigest: identity.treeDigest,
    });
    expect(
      runCi(fixture, runIdFile, fakeBin, 'opensandbox-integration').stderr,
    ).toContain('job source binding missing');

    mkdirSync(join(jobEvidence, 'a'));
    writeFileSync(join(jobEvidence, 'a/x'), 'nested\n');
    writeFileSync(join(jobEvidence, 'a.txt'), 'sibling\n');

    expect(
      run(
        fixture,
        'validation-manifest.mjs',
        ['--write-ci-source-binding', 'artifacts/job-evidence'],
        ciEnvironment('0'.repeat(40), 'opensandbox-integration'),
      ).status,
    ).toBe(1);
    expect(
      run(
        fixture,
        'validation-manifest.mjs',
        ['--write-ci-source-binding', 'artifacts/job-evidence'],
        ciEnvironment(revision, 'opensandbox-integration'),
      ).status,
    ).toBe(0);
    execFileSync(
      'zip',
      [
        '-q',
        '-FS',
        jobArchive,
        'a.txt',
        'a/x',
        'server.log',
        'ci-source-binding.json',
      ],
      { cwd: jobEvidence },
    );
    writeFakeGh(fakeBin, {
      archive: jobArchive,
      archiveDigest: digest(readFileSync(jobArchive)),
      artifactName: 'opensandbox-integration-evidence',
      conclusion: 'success',
      jobName: 'OpenSandbox integration',
      revision,
      sourceTreeDigest: identity.treeDigest,
    });
    expect(
      runCi(fixture, runIdFile, fakeBin, 'opensandbox-integration').status,
    ).toBe(0);

    expect(
      run(
        fixture,
        'validation-manifest.mjs',
        ['--write-ci-source-binding', 'artifacts/job-evidence'],
        ciEnvironment(revision, 'python-matrix'),
      ).status,
    ).toBe(0);
    execFileSync(
      'zip',
      [
        '-q',
        '-FS',
        jobArchive,
        'a.txt',
        'a/x',
        'server.log',
        'ci-source-binding.json',
      ],
      { cwd: jobEvidence },
    );
    writeFakeMatrixGh(fakeBin, jobArchive, revision);
    expect(runCi(fixture, runIdFile, fakeBin, 'python-matrix').status).toBe(0);
    writeFakeMatrixGh(fakeBin, jobArchive, revision, false);
    expect(runCi(fixture, runIdFile, fakeBin, 'python-matrix').status).toBe(1);
  });
});

function cleanFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'a1-01-'));
  mkdirSync(join(directory, 'scripts'), { recursive: true });
  mkdirSync(join(directory, 'src'), { recursive: true });
  mkdirSync(join(directory, 'artifacts/validation'), { recursive: true });
  for (const file of [
    'validation-manifest.mjs',
    'validate-release.mjs',
    'ops-check.mjs',
    'ci-evidence-check.mjs',
  ]) {
    copyFileSync(join(repo, 'scripts', file), join(directory, 'scripts', file));
  }
  writeFileSync(join(directory, '.gitignore'), 'artifacts/validation/\n');
  writeFileSync(join(directory, 'RELEASE_MANIFEST.md'), '# Release\n');
  writeFileSync(join(directory, 'package.json'), '{"name":"fixture"}\n');
  writeFileSync(join(directory, 'src/app.ts'), 'export const value = 1;\n');
  git(directory, ['init', '-q']);
  git(directory, ['config', 'user.name', 'A1 Test']);
  git(directory, ['config', 'user.email', 'a1@example.invalid']);
  git(directory, [
    'remote',
    'add',
    'origin',
    'https://github.com/acme/repo.git',
  ]);
  git(directory, ['add', '.']);
  git(directory, ['commit', '-qm', 'fixture']);
  expect(runManifest(directory, ['--write-release-files']).status).toBe(0);
  git(directory, ['add', 'RELEASE_FILE_MANIFEST.json']);
  git(directory, ['commit', '-qm', 'manifest']);
  writePassingEvidence(directory);
  return directory;
}

function writePassingEvidence(directory: string) {
  const identity = collectSourceIdentity(directory);
  const runId = randomUUID();
  const results = GATES.map(
    (
      gate: {
        name: string;
        executable: string;
        args: readonly string[];
        stdoutArtifact?: string;
      },
      sequence: number,
    ) => {
      const stdoutPath = join(
        directory,
        `artifacts/validation/${gate.name}.stdout.log`,
      );
      const stderrPath = join(
        directory,
        `artifacts/validation/${gate.name}.stderr.log`,
      );
      writeFileSync(stdoutPath, '');
      writeFileSync(stderrPath, '');
      const artifactDigests: Record<string, string> = {};
      if (gate.stdoutArtifact) {
        const path = join(directory, gate.stdoutArtifact);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${gate.name}\n`);
        artifactDigests[gate.stdoutArtifact] = digest(readFileSync(path));
      }
      const result = {
        name: gate.name,
        executable: gate.executable,
        args: [...gate.args],
        status: 'passed',
        returnCode: 0,
        durationMs: 1,
      };
      const record = createGateRecord({
        gate,
        result,
        identity,
        runId,
        sequence,
        stdoutDigest: digest(readFileSync(stdoutPath)),
        stderrDigest: digest(readFileSync(stderrPath)),
        artifactDigests,
      });
      return {
        ...result,
        recordDigest: writeGateRecord(record, directory),
      };
    },
  );
  writeValidationReport(
    createValidationReport({ status: 'passed', results, identity, runId }),
    directory,
  );
  writeFileSync(
    join(directory, 'artifacts/validation/final_verification_report.md'),
    '# Final verification report\n\noverall: passed\n',
  );
}

function runManifest(directory: string, arguments_: string[]) {
  return run(directory, 'validation-manifest.mjs', arguments_);
}

function runOps(directory: string) {
  return run(directory, 'ops-check.mjs', ['--evidence-only']);
}

function runCi(
  directory: string,
  runIdFile: string,
  fakeBin: string,
  job = 'validate-release',
) {
  return run(
    directory,
    'ci-evidence-check.mjs',
    [
      '--run-id-file',
      runIdFile,
      '--workflow',
      'validate-release',
      '--job',
      job,
      '--require-current-source',
    ],
    { PATH: `${fakeBin}:${process.env.PATH}` },
  );
}

function run(
  directory: string,
  script: string,
  arguments_: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  return spawnSync(node, [join(directory, 'scripts', script), ...arguments_], {
    cwd: directory,
    encoding: 'utf8',
    env,
  });
}

function ciEnvironment(revision: string, job: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    EAP_CI_WORKFLOW: 'validate-release',
    GITHUB_JOB: job,
    GITHUB_REPOSITORY: 'acme/repo',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_RUN_ID: '123',
    GITHUB_SHA: revision,
  };
}

function writeFakeGh(
  directory: string,
  input: {
    archive: string;
    archiveDigest: string;
    artifactName?: string;
    conclusion: string;
    jobName?: string;
    revision: string;
    sourceTreeDigest: string;
  },
) {
  mkdirSync(directory, { recursive: true });
  const script = join(directory, 'gh');
  const artifactName = input.artifactName ?? 'validate-release-evidence';
  const jobName = input.jobName ?? 'Validate release';
  writeFileSync(
    script,
    `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const endpoint = process.argv[3];
const run = { id: 123, run_attempt: 1, head_sha: ${JSON.stringify(input.revision)}, conclusion: ${JSON.stringify(input.conclusion)}, name: 'Validate release', path: '.github/workflows/validate-release.yml@refs/heads/main', repository: { full_name: 'acme/repo' } };
if (endpoint.endsWith('/actions/runs/123')) console.log(JSON.stringify(run));
else if (endpoint.includes('/jobs?')) console.log(JSON.stringify({ jobs: [{ id: 456, name: ${JSON.stringify(jobName)}, conclusion: 'success', run_id: 123, head_sha: ${JSON.stringify(input.revision)}, workflow_name: 'Validate release' }] }));
else if (endpoint.includes('/artifacts?')) console.log(JSON.stringify({ artifacts: [{ id: 789, name: ${JSON.stringify(artifactName)}, expired: false, digest: 'sha256:${input.archiveDigest}', workflow_run: { id: 123, head_sha: ${JSON.stringify(input.revision)} } }] }));
else if (endpoint.endsWith('/actions/jobs/456/logs')) process.stdout.write(${JSON.stringify(`${artifactName}\nArtifact ID is 789\n`)});
else if (endpoint.endsWith('/actions/artifacts/789/zip')) process.stdout.write(readFileSync(${JSON.stringify(input.archive)}));
else process.exit(1);
`,
  );
  chmodSync(script, 0o755);
}

function writeFakeMatrixGh(
  directory: string,
  archive: string,
  revision: string,
  complete = true,
) {
  const archiveDigest = digest(readFileSync(archive));
  const jobs = [
    {
      id: 456,
      name: 'Python 3.11',
      run_id: 123,
      head_sha: revision,
      workflow_name: 'Validate release',
      conclusion: 'success',
    },
    {
      id: 457,
      name: 'Python 3.13',
      run_id: 123,
      head_sha: revision,
      workflow_name: 'Validate release',
      conclusion: 'success',
    },
  ];
  const artifacts = [
    {
      id: 789,
      name: 'python-3.11-evidence',
      expired: false,
      digest: `sha256:${archiveDigest}`,
      workflow_run: { id: 123, head_sha: revision },
    },
    {
      id: 790,
      name: 'python-3.13-evidence',
      expired: false,
      digest: `sha256:${archiveDigest}`,
      workflow_run: { id: 123, head_sha: revision },
    },
  ];
  if (!complete) {
    jobs.pop();
    artifacts.pop();
  }
  const script = join(directory, 'gh');
  writeFileSync(
    script,
    `#!/usr/bin/env node
import { readFileSync } from 'node:fs';
const endpoint = process.argv[3];
if (endpoint.endsWith('/actions/runs/123')) console.log(JSON.stringify({ id: 123, run_attempt: 1, head_sha: ${JSON.stringify(revision)}, conclusion: 'success', name: 'Validate release', path: '.github/workflows/validate-release.yml@refs/heads/main', repository: { full_name: 'acme/repo' } }));
else if (endpoint.includes('/jobs?')) console.log(JSON.stringify({ jobs: ${JSON.stringify(jobs)} }));
else if (endpoint.includes('/artifacts?')) console.log(JSON.stringify({ artifacts: ${JSON.stringify(artifacts)} }));
else if (endpoint.endsWith('/actions/jobs/456/logs')) process.stdout.write('python-3.11-evidence\\nArtifact ID is 789\\n');
else if (endpoint.endsWith('/actions/jobs/457/logs')) process.stdout.write('python-3.13-evidence\\nArtifact ID is 790\\n');
else if (endpoint.endsWith('/actions/artifacts/789/zip') || endpoint.endsWith('/actions/artifacts/790/zip')) process.stdout.write(readFileSync(${JSON.stringify(archive)}));
else process.exit(1);
`,
  );
  chmodSync(script, 0o755);
}

function git(directory: string, arguments_: string[]) {
  return execFileSync('git', arguments_, { cwd: directory, encoding: 'utf8' });
}
