import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import {
  GATES,
  collectSourceIdentity,
  createGateRecord,
  createValidationReport,
  digest,
  gateOuterWatchdogMs,
  validateGateManifest,
  writeGateRecord,
  writeValidationReport,
} from './validation-manifest.mjs';

const validationDir = 'artifacts/validation';
const runId = randomUUID();
let identity;
try {
  validateGateManifest();
  identity = collectSourceIdentity();
  if (identity.dirty) throw new Error('dirty state rejected');
} catch (error) {
  if (identity) {
    mkdirSync(validationDir, { recursive: true });
    writeReport('failed', [], identity);
  }
  console.error(
    `validate-release:failed binding=${error instanceof Error ? error.message : 'source identity'}`,
  );
  process.exit(1);
}

rmSync(validationDir, { recursive: true, force: true });
mkdirSync(validationDir, { recursive: true });
mkdirSync('artifacts/sbom', { recursive: true });

const results = [];
for (let sequence = 0; sequence < GATES.length; sequence += 1) {
  const gate = GATES[sequence];
  const start = Date.now();
  const outerTimeout = gateOuterWatchdogMs(gate);
  const completed = spawnSync(gate.executable, gate.args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    ...(outerTimeout === undefined ? {} : { timeout: outerTimeout }),
  });
  const rawStdout = completed.stdout ?? '';
  const stderr = completed.stderr ?? '';
  let stdout = rawStdout;
  const artifactDigests = {};
  if (gate.stdoutArtifact) {
    writeFileSync(gate.stdoutArtifact, rawStdout, 'utf8');
    artifactDigests[gate.stdoutArtifact] = digest(
      readFileSync(gate.stdoutArtifact),
    );
    stdout = `wrote ${gate.stdoutArtifact}\n${rawStdout.slice(0, 500)}`;
  }
  writeFileSync(`${validationDir}/${gate.name}.stdout.log`, stdout, 'utf8');
  writeFileSync(`${validationDir}/${gate.name}.stderr.log`, stderr, 'utf8');
  const result = {
    name: gate.name,
    executable: gate.executable,
    args: gate.args,
    status: completed.status === 0 ? 'passed' : 'failed',
    returnCode: completed.status ?? 1,
    durationMs: Date.now() - start,
  };
  const record = createGateRecord({
    gate,
    result,
    identity,
    runId,
    sequence,
    stdoutDigest: digest(
      readFileSync(`${validationDir}/${gate.name}.stdout.log`),
    ),
    stderrDigest: digest(
      readFileSync(`${validationDir}/${gate.name}.stderr.log`),
    ),
    artifactDigests,
  });
  result.recordDigest = writeGateRecord(record);
  results.push(result);
  if (completed.status !== 0) {
    console.error(
      `validate-release:failed gate=${gate.name} returnCode=${completed.status ?? 1} logs=${validationDir}/${gate.name}.{stdout,stderr}.log`,
    );
    writeReport('failed', results, identity);
    process.exit(completed.status ?? 1);
  }
}

try {
  const current = collectSourceIdentity();
  if (
    current.dirty ||
    current.revision !== identity.revision ||
    current.treeDigest !== identity.treeDigest ||
    current.dirtyDigest !== identity.dirtyDigest ||
    current.validationScriptDigest !== identity.validationScriptDigest ||
    current.gateManifestDigest !== identity.gateManifestDigest ||
    current.releaseFileManifestDigest !== identity.releaseFileManifestDigest
  ) {
    throw new Error('source identity changed during validation');
  }
} catch (error) {
  console.error(
    `validate-release:failed binding=${error instanceof Error ? error.message : 'source identity'}`,
  );
  writeReport('failed', results, identity);
  process.exit(1);
}

writeReport('passed', results, identity);
console.log('validate-release:passed');

function writeReport(status, gateResults, sourceIdentity) {
  const report = createValidationReport({
    status,
    results: gateResults,
    identity: sourceIdentity,
    runId,
  });
  writeValidationReport(report);
  const markdown = [
    '# Final verification report',
    '',
    `overall: ${status}`,
    `run_id: ${report.runId}`,
    `source_revision: ${report.source.revision}`,
    `source_tree_digest: ${report.source.treeDigest}`,
    '',
    ...gateResults.map(
      (item) => `- ${item.name}: ${item.status} (${item.durationMs}ms)`,
    ),
    '',
  ].join('\n');
  writeFileSync(
    `${validationDir}/final_verification_report.md`,
    markdown,
    'utf8',
  );
}
