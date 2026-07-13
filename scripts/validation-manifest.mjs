import { execFileSync } from 'node:child_process';
import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { isAbsolute, posix, resolve } from 'node:path';

export const GATE_MANIFEST_VERSION = 1;
export const GATES = Object.freeze([
  gate('setup_python', './node_modules/node/bin/node', [
    'scripts/setup-python.mjs',
  ]),
  gate('spec_traceability', './node_modules/node/bin/node', [
    'scripts/spec-check.mjs',
  ]),
  gate('format', './node_modules/.bin/biome', [
    'format',
    '--diagnostic-level=error',
    'src',
    'tests',
    'scripts',
    'flue.config.ts',
  ]),
  gate('lint', './node_modules/.bin/biome', [
    'lint',
    '--diagnostic-level=error',
    'src',
    'tests',
    'scripts',
    'flue.config.ts',
  ]),
  gate('typecheck', './node_modules/.bin/tsc', ['--noEmit']),
  gate('opa', './node_modules/node/bin/node', ['scripts/opa-check.mjs']),
  gate('litellm_config', './node_modules/node/bin/node', [
    'scripts/check-litellm-config.mjs',
  ]),
  gate('python_compile', '.venv/bin/python', [
    '-m',
    'py_compile',
    'scripts/data_guard.py',
  ]),
  gate('python_ruff', '.venv/bin/ruff', ['check', 'scripts', 'tests_py']),
  gate('python_mypy', '.venv/bin/mypy', ['scripts/data_guard.py']),
  gate('python_bandit', '.venv/bin/bandit', [
    '-q',
    '-r',
    'scripts',
    '-x',
    'scripts/__pycache__',
  ]),
  gate('python_tests', '.venv/bin/python', [
    '-m',
    'pytest',
    '-q',
    'tests_py',
    '--cov=scripts',
    '--cov-report=term-missing',
    '--cov-fail-under=85',
  ]),
  gate('vitest_all', 'bash', [
    '-lc',
    'timeout 180 ./node_modules/.bin/vitest run --pool=forks',
  ]),
  gate('skill_lifecycle_node', './node_modules/node/bin/node', [
    '--test',
    'tests/unit/skill_lifecycle.test.mjs',
  ]),
  gate('llm_contract', 'bash', [
    '-lc',
    'timeout 120 npx vitest run tests/contract --pool=forks',
  ]),
  gate('flue_build', './node_modules/node/bin/node', [
    './node_modules/@flue/cli/bin/flue.mjs',
    'build',
    '--target',
    'node',
  ]),
  gate('e2e_artifacts', './node_modules/node/bin/node', [
    'scripts/assert-e2e-artifacts.mjs',
  ]),
  gate('npm_audit_prod', 'bash', [
    '-lc',
    'timeout 60 npm audit --audit-level=high --omit=dev',
  ]),
  gate(
    'npm_sbom_prod',
    'bash',
    ['-lc', 'timeout 60 npm sbom --omit=dev --sbom-format=cyclonedx --json'],
    'artifacts/sbom/npm-cyclonedx.json',
  ),
  gate(
    'python_sbom',
    '.venv/bin/python',
    [
      '-c',
      "import importlib.metadata as m, json, uuid, datetime; print(json.dumps({'bomFormat':'CycloneDX','specVersion':'1.4','serialNumber':'urn:uuid:'+str(uuid.uuid4()),'version':1,'metadata':{'timestamp':datetime.datetime.now(datetime.UTC).isoformat()},'components':[{'type':'library','name':d.metadata['Name'],'version':d.version,'purl':'pkg:pypi/'+d.metadata['Name'].lower().replace('_','-')+'@'+d.version} for d in sorted(m.distributions(), key=lambda d: d.metadata['Name'].lower())]}))",
    ],
    'artifacts/sbom/python-cyclonedx.json',
  ),
  gate('python_audit', '.venv/bin/pip-audit', [
    '--local',
    '--progress-spinner',
    'off',
  ]),
  gate('lockfile_registry', './node_modules/node/bin/node', [
    'scripts/check-lockfile-registry.mjs',
  ]),
  gate('opa_test', './node_modules/node/bin/node', ['scripts/opa-test.mjs']),
  gate('opa_bundle', './node_modules/node/bin/node', [
    'scripts/opa-bundle.mjs',
  ]),
  gate('skill_registry', './node_modules/node/bin/node', [
    'scripts/check-skill-registry.mjs',
  ]),
]);

const NON_RELEASE_PATHS = Object.freeze([
  '.coverage',
  'RELEASE_FILE_MANIFEST.json',
]);
const NON_RELEASE_PREFIXES = Object.freeze([
  '.agents/',
  '.git/',
  '.mypy_cache/',
  '.pytest_cache/',
  '.ruff_cache/',
  '.venv/',
  'artifacts/',
  'coverage/',
  'dist/',
  'node_modules/',
  'plans/',
]);
const RELEASE_REVISION_PATHS = Object.freeze([
  '.orchestration/plan/revisions/A2-01-R1-baseline.json',
  '.orchestration/plan/revisions/A2-01-R2-contract.json',
]);
const RELEASE_MANIFEST_PATH = 'RELEASE_FILE_MANIFEST.json';
const REPORT_PATH = 'artifacts/validation/final_verification_report.json';
const REPORT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const FILE_CANONICALIZATION =
  'UTF-8 canonical JSON; object keys sorted by code point; NFC files sorted by path bytes; source digest hashes path\\0mode\\0bytes\\0sha256\\n';

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function gateManifestDigest() {
  return digest(
    canonicalJson({ schemaVersion: GATE_MANIFEST_VERSION, gates: GATES }),
  );
}

export function writeReleaseFileManifest(repo = '.') {
  const root = realpathSync(repo);
  const files = currentReleaseFiles(root);
  const manifest = {
    schemaVersion: 1,
    canonicalization: FILE_CANONICALIZATION,
    files,
  };
  writeFileSync(
    resolve(root, RELEASE_MANIFEST_PATH),
    `${canonicalJson(manifest)}\n`,
    'utf8',
  );
  return manifest;
}

export function verifyReleaseFileManifest(repo = '.') {
  const root = realpathSync(repo);
  const path = resolve(root, RELEASE_MANIFEST_PATH);
  const bytes = readFileSync(path, 'utf8');
  const manifest = parseJson(path, 'release_file_manifest');
  assertExactKeys(
    manifest,
    ['canonicalization', 'files', 'schemaVersion'],
    'release_file_manifest',
  );
  if (
    manifest.schemaVersion !== 1 ||
    manifest.canonicalization !== FILE_CANONICALIZATION ||
    !Array.isArray(manifest.files)
  ) {
    throw new Error('release_file_manifest: malformed header');
  }
  if (bytes !== `${canonicalJson(manifest)}\n`) {
    throw new Error('release_file_manifest: noncanonical JSON encoding');
  }
  const seen = new Set();
  let previous = '';
  for (const item of manifest.files) {
    assertExactKeys(
      item,
      ['bytes', 'mode', 'path', 'sha256'],
      'release_file_entry',
    );
    assertCanonicalPath(item.path);
    if (seen.has(item.path)) {
      throw new Error(`release_file_manifest: duplicate path=${item.path}`);
    }
    if (
      previous &&
      Buffer.compare(Buffer.from(previous), Buffer.from(item.path)) >= 0
    ) {
      throw new Error(
        `release_file_manifest: noncanonical order path=${item.path}`,
      );
    }
    if (!Number.isSafeInteger(item.bytes) || item.bytes < 0) {
      throw new Error(`release_file_manifest: invalid bytes path=${item.path}`);
    }
    if (!['100644', '100755'].includes(item.mode)) {
      throw new Error(`release_file_manifest: invalid mode path=${item.path}`);
    }
    if (!/^[a-f0-9]{64}$/.test(item.sha256)) {
      throw new Error(
        `release_file_manifest: invalid digest path=${item.path}`,
      );
    }
    seen.add(item.path);
    previous = item.path;
  }
  const actual = currentReleaseFiles(root);
  const expectedPaths = new Set(manifest.files.map((item) => item.path));
  const actualPaths = new Set(actual.map((item) => item.path));
  const missing = manifest.files.find((item) => !actualPaths.has(item.path));
  if (missing)
    throw new Error(`release_file_manifest: missing path=${missing.path}`);
  const extra = actual.find((item) => !expectedPaths.has(item.path));
  if (extra) throw new Error(`release_file_manifest: extra path=${extra.path}`);
  for (let index = 0; index < actual.length; index += 1) {
    const expected = manifest.files[index];
    const observed = actual[index];
    if (
      expected.path !== observed.path ||
      expected.mode !== observed.mode ||
      expected.bytes !== observed.bytes ||
      expected.sha256 !== observed.sha256
    ) {
      throw new Error(
        `release_file_manifest: byte digest mismatch path=${expected.path}`,
      );
    }
  }
  return manifest;
}

export function collectSourceIdentity(repo = '.') {
  const root = realpathSync(repo);
  const releaseManifest = verifyReleaseFileManifest(root);
  const files = currentReleaseFiles(root);
  const status = releaseDirtyState(root);
  return {
    revision: git(root, ['rev-parse', 'HEAD']).trim(),
    treeDigest: digest(
      files
        .map(
          (item) =>
            `${item.path}\0${item.mode}\0${item.bytes}\0${item.sha256}\n`,
        )
        .join(''),
    ),
    dirty: status.length > 0,
    dirtyDigest: digest(status),
    validationScriptDigest: fileDigest(
      resolve(root, 'scripts/validate-release.mjs'),
    ),
    gateManifestDigest: gateManifestDigest(),
    releaseFileManifestDigest: digest(
      readFileSync(resolve(root, RELEASE_MANIFEST_PATH)),
    ),
    releaseFileCount: releaseManifest.files.length,
  };
}

export function createValidationReport({
  status,
  results,
  identity,
  generatedAt = new Date().toISOString(),
  runId = randomUUID(),
  node = process.version,
}) {
  const report = {
    schemaVersion: 1,
    status,
    runId,
    generatedAt,
    node,
    source: {
      revision: identity.revision,
      treeDigest: identity.treeDigest,
      dirty: identity.dirty,
      dirtyDigest: identity.dirtyDigest,
    },
    bindings: {
      validationScriptDigest: identity.validationScriptDigest,
      gateManifestDigest: identity.gateManifestDigest,
      releaseFileManifestDigest: identity.releaseFileManifestDigest,
    },
    results,
  };
  return { ...report, evidenceDigest: digest(canonicalJson(report)) };
}

export function createGateRecord({
  gate,
  result,
  identity,
  runId,
  sequence,
  stdoutDigest,
  stderrDigest,
  artifactDigests = {},
}) {
  return {
    schemaVersion: 1,
    runId,
    sequence,
    sourceTreeDigest: identity.treeDigest,
    gateManifestDigest: identity.gateManifestDigest,
    name: gate.name,
    executable: gate.executable,
    args: gate.args,
    status: result.status,
    returnCode: result.returnCode,
    durationMs: result.durationMs,
    stdoutDigest,
    stderrDigest,
    artifactDigests,
  };
}

export function writeGateRecord(record, repo = '.') {
  const bytes = `${canonicalJson(record)}\n`;
  writeFileSync(
    resolve(repo, `artifacts/validation/${record.name}.record.json`),
    bytes,
    'utf8',
  );
  return digest(bytes);
}

export function writeValidationReport(report, repo = '.') {
  writeFileSync(
    resolve(repo, REPORT_PATH),
    `${canonicalJson(report)}\n`,
    'utf8',
  );
}

export function writeCiSourceBinding(directory, metadata, repo = '.') {
  const root = realpathSync(repo);
  const artifactRoot = realpathSync(resolve(root, directory));
  if (!artifactRoot.startsWith(`${root}/`)) {
    throw new Error('ci_source_binding: artifact directory outside repository');
  }
  const identity = collectSourceIdentity(root);
  if (identity.dirty || metadata.commitSha !== identity.revision) {
    throw new Error('ci_source_binding: current source mismatch');
  }
  const files = enumerateArtifactFiles(artifactRoot).map((path) => {
    const bytes = readFileSync(resolve(artifactRoot, path));
    return { path, bytes: bytes.length, sha256: digest(bytes) };
  });
  const binding = {
    schemaVersion: 1,
    repository: metadata.repository,
    workflow: metadata.workflow,
    job: metadata.job,
    runId: Number(metadata.runId),
    runAttempt: Number(metadata.runAttempt),
    commitSha: metadata.commitSha,
    sourceTreeDigest: identity.treeDigest,
    files,
  };
  if (
    !/^[^/\s]+\/[^/\s]+$/.test(binding.repository) ||
    !/^[A-Za-z0-9_-]+$/.test(binding.workflow) ||
    !/^[A-Za-z0-9_-]+$/.test(binding.job) ||
    !Number.isSafeInteger(binding.runId) ||
    binding.runId < 1 ||
    !Number.isSafeInteger(binding.runAttempt) ||
    binding.runAttempt < 1
  ) {
    throw new Error('ci_source_binding: malformed run metadata');
  }
  writeFileSync(
    resolve(artifactRoot, 'ci-source-binding.json'),
    `${canonicalJson(binding)}\n`,
    'utf8',
  );
  return binding;
}

function enumerateArtifactFiles(root, directory = '') {
  const files = [];
  for (const entry of readdirSync(resolve(root, directory), {
    withFileTypes: true,
  }).sort((left, right) =>
    Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)),
  )) {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    assertCanonicalPath(path);
    if (path === 'ci-source-binding.json') continue;
    if (entry.isDirectory()) files.push(...enumerateArtifactFiles(root, path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`ci_source_binding: non-file rejected path=${path}`);
  }
  return files.sort(comparePathsByBytes);
}

export function verifyValidationReport(
  repo = '.',
  reportPath = REPORT_PATH,
  { now = Date.now(), maxAgeMs = REPORT_MAX_AGE_MS } = {},
) {
  const root = realpathSync(repo);
  const absoluteReportPath = resolve(root, reportPath);
  const reportBytes = readFileSync(absoluteReportPath, 'utf8');
  const report = parseJson(absoluteReportPath, 'final_report');
  if (reportBytes !== `${canonicalJson(report)}\n`) {
    throw new Error('final_report: noncanonical JSON encoding');
  }
  assertExactKeys(
    report,
    [
      'bindings',
      'evidenceDigest',
      'generatedAt',
      'node',
      'results',
      'runId',
      'schemaVersion',
      'source',
      'status',
    ],
    'final_report',
  );
  if (report.schemaVersion !== 1 || report.status !== 'passed') {
    throw new Error(`final_report: status=${report.status ?? 'missing'}`);
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      report.runId,
    ) ||
    typeof report.node !== 'string'
  ) {
    throw new Error('final_report: malformed run identity');
  }
  const generated = Date.parse(report.generatedAt);
  if (
    !Number.isFinite(generated) ||
    new Date(generated).toISOString() !== report.generatedAt ||
    generated > now ||
    now - generated > maxAgeMs
  ) {
    throw new Error('final_report: stale generatedAt');
  }
  const { evidenceDigest, ...core } = report;
  if (
    !/^[a-f0-9]{64}$/.test(evidenceDigest) ||
    digest(canonicalJson(core)) !== evidenceDigest
  ) {
    throw new Error('final_report: evidence digest mismatch');
  }
  assertExactKeys(
    report.source,
    ['dirty', 'dirtyDigest', 'revision', 'treeDigest'],
    'final_report.source',
  );
  assertExactKeys(
    report.bindings,
    [
      'gateManifestDigest',
      'releaseFileManifestDigest',
      'validationScriptDigest',
    ],
    'final_report.bindings',
  );
  if (
    !/^[a-f0-9]{40,64}$/.test(report.source.revision) ||
    !/^[a-f0-9]{64}$/.test(report.source.treeDigest) ||
    !/^[a-f0-9]{64}$/.test(report.source.dirtyDigest) ||
    Object.values(report.bindings).some(
      (value) => typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value),
    )
  ) {
    throw new Error('final_report: malformed source binding');
  }
  if (
    !Array.isArray(report.results) ||
    report.results.length !== GATES.length
  ) {
    throw new Error('final_report: gate set size mismatch');
  }
  const names = new Set();
  for (let index = 0; index < GATES.length; index += 1) {
    const result = report.results[index];
    const expected = GATES[index];
    assertExactKeys(
      result,
      [
        'args',
        'durationMs',
        'executable',
        'name',
        'recordDigest',
        'returnCode',
        'status',
      ],
      'final_report.result',
    );
    if (names.has(result.name))
      throw new Error(`final_report: duplicate gate=${result.name}`);
    names.add(result.name);
    if (
      result.name !== expected.name ||
      result.executable !== expected.executable ||
      canonicalJson(result.args) !== canonicalJson(expected.args)
    ) {
      throw new Error(
        `final_report: gate order or command mismatch index=${index}`,
      );
    }
    if (
      result.status !== 'passed' ||
      result.returnCode !== 0 ||
      !/^[a-f0-9]{64}$/.test(result.recordDigest) ||
      !Number.isSafeInteger(result.durationMs) ||
      result.durationMs < 0
    ) {
      throw new Error(`final_report: incomplete gate=${result.name}`);
    }
    verifyGateRecord(root, report, result, expected, index);
  }
  const current = collectSourceIdentity(root);
  if (report.source.dirty !== false || current.dirty !== false) {
    throw new Error('final_report: dirty state rejected');
  }
  for (const key of ['revision', 'treeDigest', 'dirtyDigest']) {
    if (report.source[key] !== current[key]) {
      throw new Error(`final_report: source ${key} mismatch`);
    }
  }
  for (const key of [
    'validationScriptDigest',
    'gateManifestDigest',
    'releaseFileManifestDigest',
  ]) {
    if (report.bindings[key] !== current[key]) {
      throw new Error(`final_report: ${key} mismatch`);
    }
  }
  return report;
}

export function verifyArchivedValidationEvidence(readEntry, entries, expected) {
  if (!Array.isArray(entries) || new Set(entries).size !== entries.length) {
    throw new Error('ci_evidence: duplicate archive entry');
  }
  for (const path of entries) assertCanonicalPath(path);
  const reportPaths = entries.filter((path) =>
    path.endsWith('validation/final_verification_report.json'),
  );
  if (reportPaths.length !== 1) {
    throw new Error('ci_evidence: canonical final report missing');
  }
  const validationPrefix = reportPaths[0].slice(
    0,
    -'final_verification_report.json'.length,
  );
  const reportBytes = readEntry(reportPaths[0]);
  const report = parseArchiveJson(reportBytes, 'ci_evidence.final_report');
  if (reportBytes.toString('utf8') !== `${canonicalJson(report)}\n`) {
    throw new Error('ci_evidence: noncanonical final report');
  }
  assertExactKeys(
    report,
    [
      'bindings',
      'evidenceDigest',
      'generatedAt',
      'node',
      'results',
      'runId',
      'schemaVersion',
      'source',
      'status',
    ],
    'ci_evidence.final_report',
  );
  const { evidenceDigest, ...core } = report;
  assertExactKeys(
    report.source,
    ['dirty', 'dirtyDigest', 'revision', 'treeDigest'],
    'ci_evidence.final_report.source',
  );
  assertExactKeys(
    report.bindings,
    [
      'gateManifestDigest',
      'releaseFileManifestDigest',
      'validationScriptDigest',
    ],
    'ci_evidence.final_report.bindings',
  );
  const generated = Date.parse(report.generatedAt);
  if (
    report.schemaVersion !== 1 ||
    report.status !== 'passed' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      report.runId,
    ) ||
    typeof report.node !== 'string' ||
    !Number.isFinite(generated) ||
    new Date(generated).toISOString() !== report.generatedAt ||
    generated > Date.now() ||
    Date.now() - generated > REPORT_MAX_AGE_MS ||
    report.source?.dirty !== false ||
    report.source?.revision !== expected.revision ||
    report.source?.treeDigest !== expected.treeDigest ||
    report.source?.dirtyDigest !== expected.dirtyDigest ||
    report.bindings?.gateManifestDigest !== expected.gateManifestDigest ||
    report.bindings?.releaseFileManifestDigest !==
      expected.releaseFileManifestDigest ||
    report.bindings?.validationScriptDigest !==
      expected.validationScriptDigest ||
    digest(canonicalJson(core)) !== evidenceDigest ||
    !Array.isArray(report.results) ||
    report.results.length !== GATES.length
  ) {
    throw new Error('ci_evidence: final report binding mismatch');
  }

  const required = new Set([
    reportPaths[0],
    `${validationPrefix}final_verification_report.md`,
  ]);
  for (let sequence = 0; sequence < GATES.length; sequence += 1) {
    const gate = GATES[sequence];
    const result = report.results[sequence];
    const recordPath = `${validationPrefix}${gate.name}.record.json`;
    const stdoutPath = `${validationPrefix}${gate.name}.stdout.log`;
    const stderrPath = `${validationPrefix}${gate.name}.stderr.log`;
    required.add(recordPath);
    required.add(stdoutPath);
    required.add(stderrPath);
    assertExactKeys(
      result,
      [
        'args',
        'durationMs',
        'executable',
        'name',
        'recordDigest',
        'returnCode',
        'status',
      ],
      'ci_evidence.final_report.result',
    );
    if (
      result.name !== gate.name ||
      result.executable !== gate.executable ||
      canonicalJson(result.args) !== canonicalJson(gate.args) ||
      result.status !== 'passed' ||
      result.returnCode !== 0 ||
      !Number.isSafeInteger(result.durationMs) ||
      result.durationMs < 0 ||
      !/^[a-f0-9]{64}$/.test(result.recordDigest)
    ) {
      throw new Error(`ci_evidence: gate result mismatch gate=${gate.name}`);
    }
    const recordBytes = readEntry(recordPath);
    const record = parseArchiveJson(
      recordBytes,
      'ci_evidence.execution_record',
    );
    if (
      recordBytes.toString('utf8') !== `${canonicalJson(record)}\n` ||
      digest(recordBytes) !== result.recordDigest
    ) {
      throw new Error(
        `ci_evidence: execution record digest mismatch gate=${gate.name}`,
      );
    }
    assertExactKeys(
      record,
      [
        'args',
        'artifactDigests',
        'durationMs',
        'executable',
        'gateManifestDigest',
        'name',
        'returnCode',
        'runId',
        'schemaVersion',
        'sequence',
        'sourceTreeDigest',
        'status',
        'stderrDigest',
        'stdoutDigest',
      ],
      'ci_evidence.execution_record',
    );
    if (
      record.schemaVersion !== 1 ||
      record.runId !== report.runId ||
      record.sequence !== sequence ||
      record.sourceTreeDigest !== expected.treeDigest ||
      record.gateManifestDigest !== expected.gateManifestDigest ||
      record.name !== gate.name ||
      record.executable !== gate.executable ||
      canonicalJson(record.args) !== canonicalJson(gate.args) ||
      record.status !== 'passed' ||
      record.returnCode !== 0 ||
      !Number.isSafeInteger(record.durationMs) ||
      record.durationMs < 0 ||
      record.durationMs !== result.durationMs ||
      !/^[a-f0-9]{64}$/.test(record.stdoutDigest) ||
      !/^[a-f0-9]{64}$/.test(record.stderrDigest) ||
      digest(readEntry(stdoutPath)) !== record.stdoutDigest ||
      digest(readEntry(stderrPath)) !== record.stderrDigest
    ) {
      throw new Error(
        `ci_evidence: execution record mismatch gate=${gate.name}`,
      );
    }
    const expectedArtifacts = gate.stdoutArtifact ? [gate.stdoutArtifact] : [];
    assertExactKeys(
      record.artifactDigests,
      expectedArtifacts,
      'ci_evidence.execution_record.artifactDigests',
    );
    for (const path of expectedArtifacts) {
      const archivePath = archiveArtifactPath(entries, path);
      required.add(archivePath);
      if (digest(readEntry(archivePath)) !== record.artifactDigests[path]) {
        throw new Error(
          `ci_evidence: artifact digest mismatch gate=${gate.name}`,
        );
      }
    }
  }
  const extra = entries.find(
    (path) => !path.endsWith('/') && !required.has(path),
  );
  const missing = [...required].find((path) => !entries.includes(path));
  if (missing || extra) {
    throw new Error(
      `ci_evidence: archive set mismatch ${missing ? `missing=${missing}` : `extra=${extra}`}`,
    );
  }
  return report;
}

function archiveArtifactPath(entries, sourcePath) {
  const suffix = sourcePath.replace(/^artifacts\//, '');
  const matches = entries.filter(
    (entry) =>
      entry === sourcePath || entry.endsWith(`/${suffix}`) || entry === suffix,
  );
  if (matches.length !== 1) {
    throw new Error(`ci_evidence: bound artifact missing path=${sourcePath}`);
  }
  return matches[0];
}

function parseArchiveJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${label}: malformed JSON`);
  }
}

function verifyGateRecord(root, report, result, gate, sequence) {
  const recordPath = resolve(
    root,
    `artifacts/validation/${gate.name}.record.json`,
  );
  let recordBytes;
  let record;
  try {
    recordBytes = readFileSync(recordPath, 'utf8');
    record = JSON.parse(recordBytes);
  } catch {
    throw new Error(`final_report: execution record missing gate=${gate.name}`);
  }
  if (
    recordBytes !== `${canonicalJson(record)}\n` ||
    digest(recordBytes) !== result.recordDigest
  ) {
    throw new Error(
      `final_report: execution record digest mismatch gate=${gate.name}`,
    );
  }
  assertExactKeys(
    record,
    [
      'args',
      'artifactDigests',
      'durationMs',
      'executable',
      'gateManifestDigest',
      'name',
      'returnCode',
      'runId',
      'schemaVersion',
      'sequence',
      'sourceTreeDigest',
      'status',
      'stderrDigest',
      'stdoutDigest',
    ],
    'final_report.execution_record',
  );
  if (
    record.schemaVersion !== 1 ||
    record.runId !== report.runId ||
    record.sequence !== sequence ||
    record.sourceTreeDigest !== report.source.treeDigest ||
    record.gateManifestDigest !== report.bindings.gateManifestDigest ||
    record.name !== result.name ||
    record.executable !== result.executable ||
    canonicalJson(record.args) !== canonicalJson(result.args) ||
    record.status !== result.status ||
    record.returnCode !== result.returnCode ||
    record.durationMs !== result.durationMs ||
    !/^[a-f0-9]{64}$/.test(record.stdoutDigest) ||
    !/^[a-f0-9]{64}$/.test(record.stderrDigest)
  ) {
    throw new Error(
      `final_report: execution record mismatch gate=${gate.name}`,
    );
  }
  for (const stream of ['stdout', 'stderr']) {
    let bytes;
    try {
      bytes = readFileSync(
        resolve(root, `artifacts/validation/${gate.name}.${stream}.log`),
      );
    } catch {
      throw new Error(`final_report: ${stream} log missing gate=${gate.name}`);
    }
    if (digest(bytes) !== record[`${stream}Digest`]) {
      throw new Error(
        `final_report: ${stream} log digest mismatch gate=${gate.name}`,
      );
    }
  }
  const expectedArtifacts = gate.stdoutArtifact ? [gate.stdoutArtifact] : [];
  assertExactKeys(
    record.artifactDigests,
    expectedArtifacts,
    'final_report.execution_record.artifactDigests',
  );
  for (const path of expectedArtifacts) {
    let bytes;
    try {
      bytes = readFileSync(resolve(root, path));
    } catch {
      throw new Error(`final_report: artifact missing gate=${gate.name}`);
    }
    if (digest(bytes) !== record.artifactDigests[path]) {
      throw new Error(
        `final_report: artifact digest mismatch gate=${gate.name}`,
      );
    }
  }
}

export function validateGateManifest() {
  const seen = new Set();
  for (const item of GATES) {
    const keys = item.stdoutArtifact
      ? ['args', 'executable', 'name', 'stdoutArtifact']
      : ['args', 'executable', 'name'];
    assertExactKeys(item, keys, 'gate_manifest');
    if (!/^[a-z][a-z0-9_]*$/.test(item.name) || seen.has(item.name)) {
      throw new Error(`gate_manifest: invalid or duplicate gate=${item.name}`);
    }
    if (
      typeof item.executable !== 'string' ||
      !Array.isArray(item.args) ||
      item.args.some((arg) => typeof arg !== 'string')
    ) {
      throw new Error(`gate_manifest: malformed command gate=${item.name}`);
    }
    if (item.stdoutArtifact) assertCanonicalPath(item.stdoutArtifact);
    seen.add(item.name);
  }
  return GATES;
}

function gate(name, executable, args, stdoutArtifact) {
  return Object.freeze(
    stdoutArtifact
      ? { name, executable, args: Object.freeze(args), stdoutArtifact }
      : { name, executable, args: Object.freeze(args) },
  );
}

function currentReleaseFiles(root) {
  const listed = [
    ...new Set([...enumerateReleasePaths(root), ...RELEASE_REVISION_PATHS]),
  ].sort(comparePathsByBytes);
  return listed.map((path) => {
    assertCanonicalPath(path);
    const absolute = resolve(root, path);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch {
      throw new Error(`release_file_manifest: missing path=${path}`);
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`release_file_manifest: symlink rejected path=${path}`);
    }
    if (!stat.isFile()) {
      throw new Error(`release_file_manifest: non-file rejected path=${path}`);
    }
    let bytes;
    try {
      bytes = readFileSync(absolute);
    } catch {
      throw new Error(`release_file_manifest: unreadable path=${path}`);
    }
    return {
      path,
      mode: stat.mode & 0o111 ? '100755' : '100644',
      bytes: bytes.length,
      sha256: digest(bytes),
    };
  });
}

function releaseDirtyState(root) {
  const head = gitTree(root);
  const index = gitIndex(root);
  const paths = [
    ...new Set([
      ...head.keys(),
      ...index.keys(),
      ...enumerateReleasePaths(root),
      RELEASE_MANIFEST_PATH,
    ]),
  ]
    .filter(isDirtyRelevantPath)
    .sort();
  const worktree = worktreeObjects(root, paths);
  const flags = gitFlags(root);
  const reasons = [];
  for (const path of paths) {
    const headEntry = head.get(path);
    const indexEntry = index.get(path);
    const worktreeEntry = worktree.get(path);
    if (!headEntry || !indexEntry || !worktreeEntry) {
      reasons.push(`set:${path}`);
      continue;
    }
    if (
      headEntry.mode !== indexEntry.mode ||
      headEntry.oid !== indexEntry.oid
    ) {
      reasons.push(`index:${path}`);
    }
    if (
      headEntry.mode !== worktreeEntry.mode ||
      headEntry.oid !== worktreeEntry.oid
    ) {
      reasons.push(`worktree:${path}`);
    }
    if (flags.get(path) !== 'H') reasons.push(`index-flag:${path}`);
  }
  return reasons.sort().join('\0');
}

function enumerateReleasePaths(root, directory = '') {
  let entries;
  try {
    entries = readdirSync(resolve(root, directory), { withFileTypes: true });
  } catch {
    throw new Error(
      `release_file_manifest: unreadable directory=${directory || '.'}`,
    );
  }
  const paths = [];
  for (const entry of entries.sort((left, right) =>
    Buffer.compare(Buffer.from(left.name), Buffer.from(right.name)),
  )) {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (!isReleasePath(path)) continue;
    assertCanonicalPath(path);
    if (entry.isDirectory()) paths.push(...enumerateReleasePaths(root, path));
    else paths.push(path);
  }
  return paths.sort(comparePathsByBytes);
}

function comparePathsByBytes(left, right) {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

function gitTree(root) {
  const entries = new Map();
  for (const record of git(root, ['ls-tree', '-r', '--full-tree', '-z', 'HEAD'])
    .split('\0')
    .filter(Boolean)) {
    const [metadata, path] = record.split('\t');
    const [mode, type, oid] = metadata.split(' ');
    if (type === 'blob' && isDirtyRelevantPath(path)) {
      entries.set(path, { mode, oid });
    }
  }
  return entries;
}

function gitIndex(root) {
  const entries = new Map();
  for (const record of git(root, ['ls-files', '--stage', '-z'])
    .split('\0')
    .filter(Boolean)) {
    const [metadata, path] = record.split('\t');
    const [mode, oid, stage] = metadata.split(' ');
    if (!isDirtyRelevantPath(path)) continue;
    if (stage !== '0' || entries.has(path)) {
      entries.set(path, { mode: 'unmerged', oid: 'unmerged' });
    } else {
      entries.set(path, { mode, oid });
    }
  }
  return entries;
}

function gitFlags(root) {
  const flags = new Map();
  for (const record of git(root, ['ls-files', '-v', '-z'])
    .split('\0')
    .filter(Boolean)) {
    const match = record.match(/^(.) (.*)$/s);
    if (match && isDirtyRelevantPath(match[2])) flags.set(match[2], match[1]);
  }
  return flags;
}

function worktreeObjects(root, paths) {
  const existing = paths.filter((path) => {
    try {
      return lstatSync(resolve(root, path)).isFile();
    } catch {
      return false;
    }
  });
  if (existing.length === 0) return new Map();
  const hashes = gitWithInput(
    root,
    ['hash-object', '--stdin-paths'],
    `${existing.join('\n')}\n`,
  )
    .trim()
    .split('\n');
  const entries = new Map();
  for (let index = 0; index < existing.length; index += 1) {
    const stat = lstatSync(resolve(root, existing[index]));
    entries.set(existing[index], {
      mode: stat.mode & 0o111 ? '100755' : '100644',
      oid: hashes[index],
    });
  }
  return entries;
}

function isReleasePath(path) {
  if (NON_RELEASE_PATHS.includes(path)) return false;
  const name = posix.basename(path);
  if (
    name === '.DS_Store' ||
    name === '__pycache__' ||
    name.endsWith('.pyc') ||
    (name.startsWith('.env') && name !== '.env.example')
  ) {
    return false;
  }
  if (path.startsWith('.orchestration/')) {
    return (
      path === '.orchestration/skills' ||
      path.startsWith('.orchestration/skills/') ||
      RELEASE_REVISION_PATHS.some(
        (releasePath) =>
          path === releasePath || releasePath.startsWith(`${path}/`),
      )
    );
  }
  return !NON_RELEASE_PREFIXES.some(
    (prefix) => path === prefix.slice(0, -1) || path.startsWith(prefix),
  );
}

function isDirtyRelevantPath(path) {
  return path === RELEASE_MANIFEST_PATH || isReleasePath(path);
}

function assertCanonicalPath(path) {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    isAbsolute(path) ||
    path.includes('\\') ||
    path.includes('\0') ||
    hasControlCharacters(path) ||
    path === '.' ||
    path.startsWith('../') ||
    posix.normalize(path) !== path ||
    path.normalize('NFC') !== path
  ) {
    throw new Error(`release_file_manifest: noncanonical path=${String(path)}`);
  }
}

function hasControlCharacters(value) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint < 32 || codePoint === 127;
  });
}

function assertExactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}: expected object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (canonicalJson(actual) !== canonicalJson(wanted)) {
    throw new Error(`${label}: unknown or missing fields`);
  }
}

function parseJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error(`${label}: missing or malformed JSON`);
  }
}

function fileDigest(path) {
  return digest(readFileSync(path));
}

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitWithInput(root, args, input) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function usage() {
  console.error(
    'usage: validation-manifest.mjs --check|--write-release-files|--source-identity|--verify-report [path]|--write-ci-source-binding DIR',
  );
  process.exit(2);
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(import.meta.filename)
) {
  try {
    const [command, argument, ...extra] = process.argv.slice(2);
    if (extra.length > 0) usage();
    if (command === '--check' && !argument) {
      validateGateManifest();
      verifyReleaseFileManifest();
      console.log(`validation-manifest:passed gates=${GATES.length}`);
    } else if (command === '--write-release-files' && !argument) {
      const manifest = writeReleaseFileManifest();
      console.log(`validation-manifest:wrote files=${manifest.files.length}`);
    } else if (command === '--source-identity' && !argument) {
      console.log(JSON.stringify(collectSourceIdentity()));
    } else if (command === '--write-ci-source-binding' && argument) {
      const binding = writeCiSourceBinding(argument, {
        repository: process.env.GITHUB_REPOSITORY,
        workflow: process.env.EAP_CI_WORKFLOW,
        job: process.env.GITHUB_JOB,
        runId: process.env.GITHUB_RUN_ID,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        commitSha: process.env.GITHUB_SHA,
      });
      console.log(
        `validation-manifest:ci-binding files=${binding.files.length}`,
      );
    } else if (command === '--verify-report') {
      verifyValidationReport('.', argument || REPORT_PATH);
      console.log('validation-manifest:report-passed');
    } else {
      usage();
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'validation-manifest: failed',
    );
    process.exit(1);
  }
}
