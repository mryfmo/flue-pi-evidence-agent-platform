import { readFileSync } from 'node:fs';

const requiredFiles = [
  'artifacts/demo/hypothesis-ledger.json',
  'artifacts/audit/remediation.jsonl',
  'artifacts/telemetry/traces.jsonl',
];

for (const file of requiredFiles) {
  readFileSync(file, 'utf8');
}

const ledger = JSON.parse(
  readFileSync('artifacts/demo/hypothesis-ledger.json', 'utf8'),
);
const auditLines = readFileSync('artifacts/audit/remediation.jsonl', 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const traceLines = readFileSync('artifacts/telemetry/traces.jsonl', 'utf8')
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

assert(Array.isArray(ledger.hypotheses), 'ledger.hypotheses must be an array');
assert(
  ledger.hypotheses.length >= 2,
  'ledger must contain at least two hypotheses',
);
assert(
  ledger.hypotheses.every((hypothesis) => hypothesis.status === 'verified'),
  'all hypotheses must be verified',
);
assert(Array.isArray(ledger.patches), 'ledger.patches must be an array');
assert(
  ledger.patches.length >= ledger.hypotheses.length,
  'patch fan-out must produce at least one candidate per hypothesis',
);
assert(
  ledger.patches.some((patch) => patch.status === 'applied'),
  'at least one patch candidate must be applied',
);
assert(
  Array.isArray(ledger.verifications) &&
    ledger.verifications.some((verification) => verification.passed === true),
  'ledger must contain a passing verification result',
);

const evidenceKinds = new Set((ledger.evidence ?? []).map((item) => item.kind));
for (const expected of [
  'source',
  'policy',
  'agent',
  'verification',
  'data',
  'impact',
]) {
  assert(evidenceKinds.has(expected), `missing evidence kind: ${expected}`);
}

const runEnd = auditLines.filter((line) => line.type === 'run_end').at(-1);
assert(runEnd, 'audit log must contain run_end');
assert(runEnd?.status === 'passed', 'run_end status must be passed');
assert(runEnd?.closure?.closed === true, 'closure gate must be closed');
assert(
  Array.isArray(runEnd?.remaining) && runEnd.remaining.length === 0,
  'remaining hypotheses must be empty',
);
assert(
  runEnd?.dataQuery?.rejectedUnsafeSql === true,
  'unsafe SQL must be rejected',
);
assert(
  runEnd?.dataQuery?.rejectedMutationSql === true,
  'mutation SQL must be rejected',
);
assert(
  runEnd?.dataQuery?.rejectedMultiStatementSql === true,
  'multi-statement SQL must be rejected',
);
assert(runEnd?.dataQuery?.piiDetected === true, 'PII must be detected');

const traceNames = new Set(traceLines.map((line) => line.name));
for (const expected of [
  'workspace.prepare',
  'code.localize',
  'policy.opa.evaluate',
  'code.patch.apply',
  'verification.pytest',
  'code.rescan',
  'data.guard.metric_query',
]) {
  assert(traceNames.has(expected), `missing telemetry span: ${expected}`);
}

if (failures.length > 0) {
  console.error(JSON.stringify({ status: 'failed', failures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      status: 'passed',
      hypotheses: ledger.hypotheses.length,
      patches: ledger.patches.length,
      evidenceKinds: [...evidenceKinds].sort(),
      auditRunStatus: runEnd.status,
      traceSpanCount: traceLines.length,
    },
    null,
    2,
  ),
);
