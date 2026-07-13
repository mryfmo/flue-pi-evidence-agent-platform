import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, posix } from 'node:path';
import {
  canonicalJson,
  collectSourceIdentity,
  digest,
  verifyArchivedValidationEvidence,
} from './validation-manifest.mjs';

try {
  const options = parseArguments(process.argv.slice(2));
  const runIdText = readFileSync(options.runIdFile, 'utf8').trim();
  if (!/^[1-9][0-9]*$/.test(runIdText)) {
    throw new Error('ci_evidence: malformed run id');
  }
  const runId = Number(runIdText);
  if (!Number.isSafeInteger(runId)) {
    throw new Error('ci_evidence: malformed run id');
  }
  const repository = repositoryFromOrigin();
  const run = ghApi(`repos/${repository}/actions/runs/${runId}`);
  if (
    run.id !== runId ||
    run.repository?.full_name !== repository ||
    run.conclusion !== 'success' ||
    typeof run.head_sha !== 'string'
  ) {
    throw new Error('ci_evidence: run identity or conclusion mismatch');
  }
  const workflowPath = String(run.path ?? '').split('@')[0];
  const workflow = posix.basename(workflowPath).replace(/\.ya?ml$/, '');
  if (workflow !== options.workflow) {
    throw new Error('ci_evidence: workflow mismatch');
  }
  const jobContract = workflowJobContract(workflowPath, options.job);
  const jobsResponse = ghApi(
    `repos/${repository}/actions/runs/${runId}/jobs?filter=latest&per_page=100`,
  );
  const jobs = Array.isArray(jobsResponse.jobs)
    ? jobsResponse.jobs.filter((job) => jobContract.namePattern.test(job.name))
    : [];
  if (
    jobs.length !== jobContract.expectedJobs ||
    jobs.some(
      (job) =>
        job.conclusion !== 'success' ||
        job.run_id !== runId ||
        job.head_sha !== run.head_sha ||
        (job.workflow_name !== undefined &&
          ![run.name, jobContract.workflowName].includes(job.workflow_name)),
    )
  ) {
    throw new Error('ci_evidence: job identity or conclusion mismatch');
  }
  const source = collectSourceIdentity();
  if (options.requireCurrentSource) {
    if (source.dirty) throw new Error('ci_evidence: dirty state rejected');
    if (source.revision !== run.head_sha) {
      throw new Error('ci_evidence: commit SHA mismatch');
    }
  }
  const artifactResponse = ghApi(
    `repos/${repository}/actions/runs/${runId}/artifacts?per_page=100`,
  );
  const artifacts = Array.isArray(artifactResponse.artifacts)
    ? artifactResponse.artifacts.filter(
        (artifact) =>
          !artifact.expired &&
          jobContract.artifactNamePattern.test(artifact.name),
      )
    : [];
  if (artifacts.length !== jobs.length) {
    throw new Error('ci_evidence: exact job artifact missing or duplicate');
  }
  const unusedArtifacts = new Set(artifacts);
  const artifactBindings = [];
  for (const job of [...jobs].sort((left, right) => left.id - right.id)) {
    const jobLog = ghApiBytes(
      `repos/${repository}/actions/jobs/${job.id}/logs`,
      'authenticated job-log download failed',
    ).toString('utf8');
    const matches = [...unusedArtifacts].filter(
      (artifact) =>
        jobLog.includes(artifact.name) &&
        [`Artifact ID is ${artifact.id}`, `Artifact ID: ${artifact.id}`].some(
          (marker) => jobLog.includes(marker),
        ),
    );
    if (matches.length !== 1) {
      throw new Error(
        'ci_evidence: selected job did not upload exact artifact',
      );
    }
    const artifact = matches[0];
    unusedArtifacts.delete(artifact);
    const expectedDigest = String(artifact.digest ?? '').replace(
      /^sha256:/,
      '',
    );
    if (
      !Number.isSafeInteger(artifact.id) ||
      !/^[a-f0-9]{64}$/.test(expectedDigest) ||
      (artifact.workflow_run?.id !== undefined &&
        artifact.workflow_run.id !== runId) ||
      (artifact.workflow_run?.head_sha !== undefined &&
        artifact.workflow_run.head_sha !== run.head_sha)
    ) {
      throw new Error('ci_evidence: artifact binding malformed');
    }
    const zip = ghApiBytes(
      `repos/${repository}/actions/artifacts/${artifact.id}/zip`,
      'authenticated artifact download failed',
    );
    if (digest(zip) !== expectedDigest) {
      throw new Error(
        `ci_evidence: artifact digest mismatch name=${artifact.name}`,
      );
    }
    const archive = openZip(zip);
    try {
      if (
        archive.entries.some((entry) =>
          entry.endsWith('validation/final_verification_report.json'),
        )
      ) {
        verifyArchivedValidationEvidence(archive.read, archive.entries, source);
      } else {
        if (options.job === 'validate-release') {
          throw new Error('ci_evidence: canonical final report missing');
        }
        verifyJobSourceBinding(archive, {
          repository,
          workflow: options.workflow,
          job: options.job,
          runId,
          runAttempt: run.run_attempt,
          commitSha: run.head_sha,
          sourceTreeDigest: source.treeDigest,
        });
      }
    } finally {
      archive.close();
    }
    artifactBindings.push({
      id: artifact.id,
      name: artifact.name,
      sha256: expectedDigest,
      jobId: job.id,
    });
  }
  const result = {
    repository,
    workflow: options.workflow,
    job: options.job,
    jobIds: artifactBindings.map((item) => item.jobId),
    runId,
    runAttempt: run.run_attempt,
    commitSha: run.head_sha,
    sourceTreeDigest: source.treeDigest,
    artifactSetDigest: digest(canonicalJson(artifactBindings)),
    artifacts: artifactBindings,
  };
  console.log(`ci-evidence:passed ${canonicalJson(result)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'ci_evidence: failed');
  process.exit(1);
}

function parseArguments(arguments_) {
  const values = new Map();
  for (let index = 0; index < arguments_.length; index += 1) {
    const flag = arguments_[index];
    if (flag === '--require-current-source') {
      if (values.has(flag)) usage();
      values.set(flag, true);
      continue;
    }
    if (!['--job', '--run-id-file', '--workflow'].includes(flag)) usage();
    const value = arguments_[index + 1];
    if (!value || value.startsWith('--') || values.has(flag)) usage();
    values.set(flag, value);
    index += 1;
  }
  if (values.size !== 4 || values.get('--require-current-source') !== true) {
    usage();
  }
  return {
    job: values.get('--job'),
    requireCurrentSource: true,
    runIdFile: values.get('--run-id-file'),
    workflow: values.get('--workflow'),
  };
}

function workflowJobContract(workflowPath, jobKey) {
  const localPath = workflowPath.replace(/^\.github\/workflows\//, '');
  if (basename(localPath) !== localPath || !/\.ya?ml$/.test(localPath)) {
    throw new Error('ci_evidence: workflow path rejected');
  }
  const bytes = readFileSync(`.github/workflows/${localPath}`, 'utf8');
  const workflowName = yamlScalar(
    bytes.match(/^name:\s*(.+)$/m)?.[1],
    'workflow name',
  );
  const escapedJob = jobKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const start = bytes.search(new RegExp(`^  ${escapedJob}:\\s*$`, 'm'));
  if (start < 0) throw new Error('ci_evidence: job absent from workflow');
  const tail = bytes.slice(start);
  const next = tail.slice(1).search(/^  [A-Za-z0-9_-]+:\s*$/m);
  const block = next < 0 ? tail : tail.slice(0, next + 1);
  const declaredName = yamlScalar(
    block.match(/^    name:\s*(.+)$/m)?.[1],
    'job display name',
  );
  const upload = block.match(
    /uses:\s*actions\/upload-artifact@[^\n]+[\s\S]*?^\s+with:\s*$[\s\S]*?^\s+name:\s*(.+)$/m,
  );
  const artifactName = yamlScalar(upload?.[1], 'artifact name');
  return {
    artifactName,
    artifactNamePattern: templatePattern(artifactName),
    expectedJobs: expectedMatrixJobs(block),
    namePattern: templatePattern(declaredName),
    workflowName,
  };
}

function templatePattern(template) {
  const pattern = template
    .split(/\$\{\{.*?\}\}/g)
    .map(escapeRegex)
    .join('.+');
  return new RegExp(`^${pattern}$`);
}

function expectedMatrixJobs(block) {
  const matrixStart = block.search(/^      matrix:\s*$/m);
  if (matrixStart < 0) return 1;
  const tail = block.slice(matrixStart).split('\n').slice(1);
  const dimensions = [];
  for (let index = 0; index < tail.length; index += 1) {
    const line = tail[index];
    if (/^\s{0,6}\S/.test(line)) break;
    const match = line.match(/^        ([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    if (['include', 'exclude'].includes(match[1])) {
      throw new Error(
        'ci_evidence: include/exclude matrix requires explicit WU support',
      );
    }
    let count = 0;
    if (match[2].startsWith('[') && match[2].endsWith(']')) {
      count = match[2]
        .slice(1, -1)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean).length;
    } else if (match[2] === '') {
      for (let child = index + 1; child < tail.length; child += 1) {
        if (!/^          -\s+/.test(tail[child])) break;
        count += 1;
        index = child;
      }
    }
    if (count < 1) throw new Error('ci_evidence: dynamic matrix rejected');
    dimensions.push(count);
  }
  if (dimensions.length === 0) {
    throw new Error('ci_evidence: empty matrix rejected');
  }
  return dimensions.reduce((product, count) => product * count, 1);
}

function yamlScalar(value, label) {
  if (!value) throw new Error(`ci_evidence: ${label} missing`);
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ghApi(endpoint) {
  try {
    return JSON.parse(
      execFileSync('gh', ['api', endpoint], {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch {
    throw new Error('ci_evidence: authenticated GitHub API lookup failed');
  }
}

function ghApiBytes(endpoint, diagnostic) {
  try {
    return execFileSync('gh', ['api', endpoint], {
      maxBuffer: 512 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error(`ci_evidence: ${diagnostic}`);
  }
}

function openZip(bytes) {
  const directory = mkdtempSync(join(tmpdir(), 'ci-evidence-'));
  const path = join(directory, 'artifact.zip');
  writeFileSync(path, bytes);
  let entries;
  try {
    entries = execFileSync('unzip', ['-Z1', path], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    rmSync(directory, { recursive: true, force: true });
    throw new Error('ci_evidence: malformed artifact archive');
  }
  return {
    entries,
    read(entry) {
      if (!entries.includes(entry)) {
        throw new Error(`ci_evidence: archive entry missing path=${entry}`);
      }
      try {
        return execFileSync('unzip', ['-p', path, entry], {
          maxBuffer: 512 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch {
        throw new Error(`ci_evidence: archive entry unreadable path=${entry}`);
      }
    },
    close() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function verifyJobSourceBinding(archive, expected) {
  if (
    new Set(archive.entries).size !== archive.entries.length ||
    archive.entries.some((entry) => !canonicalArchivePath(entry))
  ) {
    throw new Error('ci_evidence: noncanonical job artifact path');
  }
  const matches = archive.entries.filter(
    (entry) => entry === 'ci-source-binding.json',
  );
  if (matches.length !== 1) {
    throw new Error('ci_evidence: job source binding missing');
  }
  const bytes = archive.read(matches[0]);
  let binding;
  try {
    binding = JSON.parse(bytes);
  } catch {
    throw new Error('ci_evidence: malformed job source binding');
  }
  if (bytes.toString('utf8') !== `${canonicalJson(binding)}\n`) {
    throw new Error('ci_evidence: noncanonical job source binding');
  }
  const keys = [
    'commitSha',
    'files',
    'job',
    'repository',
    'runAttempt',
    'runId',
    'schemaVersion',
    'sourceTreeDigest',
    'workflow',
  ];
  if (
    !binding ||
    typeof binding !== 'object' ||
    Array.isArray(binding) ||
    JSON.stringify(Object.keys(binding).sort()) !== JSON.stringify(keys) ||
    binding.schemaVersion !== 1 ||
    keys
      .filter((key) => !['files', 'schemaVersion'].includes(key))
      .some((key) => binding[key] !== expected[key]) ||
    !Array.isArray(binding.files)
  ) {
    throw new Error('ci_evidence: job source binding mismatch');
  }
  const payloadPaths = archive.entries
    .filter((entry) => !entry.endsWith('/') && entry !== matches[0])
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left), Buffer.from(right)),
    );
  if (binding.files.length !== payloadPaths.length) {
    throw new Error('ci_evidence: job artifact set mismatch');
  }
  for (let index = 0; index < payloadPaths.length; index += 1) {
    const path = payloadPaths[index];
    const file = binding.files[index];
    const payload = archive.read(path);
    if (
      !file ||
      typeof file !== 'object' ||
      Array.isArray(file) ||
      JSON.stringify(Object.keys(file).sort()) !==
        JSON.stringify(['bytes', 'path', 'sha256']) ||
      file.path !== path ||
      file.bytes !== payload.length ||
      file.sha256 !== digest(payload)
    ) {
      throw new Error(
        `ci_evidence: job artifact binding mismatch path=${path}`,
      );
    }
  }
}

function canonicalArchivePath(path) {
  return (
    typeof path === 'string' &&
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !path.includes('\0') &&
    ![...path].some((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint < 32 || codePoint === 127;
    }) &&
    !path.startsWith('../') &&
    posix.normalize(path) === path &&
    path.normalize('NFC') === path
  );
}

function repositoryFromOrigin() {
  const output = execFileSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const remote = output.endsWith('\n') ? output.slice(0, -1) : output;
  const prefix = [
    'https://github.com/',
    'ssh://git@github.com/',
    'git@github.com:',
  ].find((candidate) => remote.startsWith(candidate));
  const path = prefix ? remote.slice(prefix.length) : '';
  const repositoryPath = path.endsWith('.git') ? path.slice(0, -4) : path;
  const match = repositoryPath.match(/^([^/]+)\/([^/]+)$/);
  const owner = match?.[1] ?? '';
  const repository = match?.[2] ?? '';
  if (
    !/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(owner) ||
    !/^[A-Za-z0-9._-]{1,100}$/.test(repository) ||
    ['.', '..'].includes(repository)
  ) {
    throw new Error('ci_evidence: unsupported repository origin');
  }
  return `${owner}/${repository}`;
}

function usage() {
  throw new Error(
    'usage: ci-evidence-check.mjs --run-id-file FILE --workflow NAME --job NAME --require-current-source',
  );
}
