import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const planPath = '.orchestration/plan/PRODUCTION_WORK_PLAN.md';
const reportPath = '.orchestration/reports/P9-T01_production_readiness_audit.md';
const reportSha256 = 'dcdb079db2475bac366594df58e0a226faaae2ccba35ef4a6324decf882a9686';
const specificationPath = '.orchestration/acceptance/P9-T02.acceptance.md';
const specificationSha256 = 'f0c562d6532bda8d22b4eb78f18f15ea73239382d89249610d125aa49640e02a';
const revisionPath = '.orchestration/acceptance/P9-T02.rev2.acceptance.md';
const revisionSha256 = '8d05d48bf050acd2e987729e5788b23bf287f2d45f00cf76a24becba42df4764';
const plan = readFileSync(planPath, 'utf8');
const report = readFileSync(reportPath, 'utf8');
const specification = readFileSync(specificationPath, 'utf8');
const revision = readFileSync(revisionPath, 'utf8');
const failures = [];

equal(createHash('sha256').update(report).digest('hex'), reportSha256, 'source report SHA-256');
equal(
  createHash('sha256').update(specification).digest('hex'),
  specificationSha256,
  'specification source SHA-256',
);
equal(createHash('sha256').update(revision).digest('hex'), revisionSha256, 'revision source SHA-256');
if (!plan.includes(`- source: \`${reportPath}\` rev2`)) fail('canonical source path missing');
if (!plan.includes(`- source SHA-256: \`${reportSha256}\``)) fail('source digest binding missing');
if (!plan.includes(`- specification source: \`${specificationPath}\` rev1`)) {
  fail('specification source path missing');
}
if (!plan.includes(`- specification source SHA-256: \`${specificationSha256}\``)) {
  fail('specification source digest binding missing');
}
if (!plan.includes(`- revision source: \`${revisionPath}\``)) fail('revision source path missing');
if (!plan.includes(`- revision source SHA-256: \`${revisionSha256}\``)) {
  fail('revision source digest binding missing');
}
if (plan.includes('data.eap.routing.deny[')) fail('V-1 typo remains: routing.deny');
if (plan.includes('./node_modules/.bin/opa')) fail('direct OPA command uses nonexistent bin link');

const policyRefs = [...new Set(plan.match(/data\.eap\.[A-Za-z0-9_.]+/g) ?? [])].sort();
const knownPolicyRefs = [
  'data.eap.agent.allow',
  'data.eap.approval.allow_resume',
  'data.eap.closure.closed',
  'data.eap.conformance.satisfied',
  'data.eap.routing.allow',
  'data.eap.routing.deny_reason',
  'data.eap.sandbox.allow',
].sort();
sameSetWithMultiplicity(policyRefs, knownPolicyRefs, 'OPA field reference inventory');

for (const line of plan.split('\n').filter((item) => item.includes('"$OPA_BIN" eval'))) {
  if (!line.includes("import { opaBinary } from './src/lib/opa.ts'")) {
    fail(`opa eval does not use repository binary resolver: ${line}`);
  }
}

const plannedScripts = new Set([
  'scripts/audit-verify.mjs',
  'scripts/backup-evidence.mjs',
  'scripts/ci-evidence-check.mjs',
  'scripts/data-evidence-check.mjs',
  'scripts/litellm-install.sh',
  'scripts/litellm-issue-key.sh',
  'scripts/litellm-revoke-key.sh',
  'scripts/litellm-smoke.sh',
  'scripts/litellm-start.sh',
  'scripts/live-llm-smoke.mjs',
  'scripts/opensandbox-ci-assert.mjs',
  'scripts/production-install.sh',
  'scripts/production-start.sh',
  'scripts/production-status.sh',
  'scripts/production-stop.sh',
  'scripts/release-decision.mjs',
  'scripts/repair_ast.py',
  'scripts/restore-evidence.mjs',
  'scripts/runtime-preflight.mjs',
  'scripts/sbom-check.mjs',
  'scripts/slo-evaluate.mjs',
  'scripts/update-python-lock.mjs',
  'scripts/validation-manifest.mjs',
]);
const referencedScripts = new Set(
  plan.match(/scripts\/[A-Za-z0-9_./-]+\.(?:mjs|sh|py)/g) ?? [],
);
for (const script of referencedScripts) {
  if (!existsSync(script) && !plannedScripts.has(script)) fail(`unowned missing script: ${script}`);
}

const plannedSpecCheckFlags = new Set([
  '--check-analysis-status',
  '--check-current-gateway-design',
  '--check-decision',
  '--check-evidence-links',
  '--check-failure-matrix',
  '--check-id-bijection',
  '--check-ledger-schema',
  '--check-nfr-coverage',
  '--check-risk',
  '--check-spec',
  '--check-spec-register',
  '--check-telemetry-schema',
  '--check-threat-coverage',
  '--check-tool-contracts',
]);
for (const match of plan.matchAll(/scripts\/spec-check\.mjs\s+(--[a-z0-9-]+)/g)) {
  if (!plannedSpecCheckFlags.has(match[1])) fail(`unowned spec-check flag: ${match[1]}`);
}
if (
  plan.indexOf('## Phase A0 —') === -1 ||
  plan.indexOf('## Phase A0 —') > plan.indexOf('## Phase A —')
) {
  fail('Phase A0 does not precede Phase A');
}
if (!plan.includes('Phase Exit uses two stages:')) fail('phase evidence protocol is circular');

const forbidden = [
  '後で決める',
  '適宜',
  '必要に応じて',
  '可能なら',
  '任意',
  'TBD',
  'TODO',
  'as needed',
  'later',
  'optional',
  'may',
  'could',
  'should',
];

if (process.argv.includes('--check-discretion')) {
  const hits = forbidden.filter((word) =>
    new RegExp(`(^|[^A-Za-z])${escapeRegex(word)}([^A-Za-z]|$)`, 'imu').test(plan),
  );
  if (hits.length > 0) fail(`discretionary terms: ${hits.join(',')}`);
  finish({ check: 'discretion', hits });
}

const wuHeadings = [...plan.matchAll(/^### WU ([A-Z][0-9]-[0-9]{2}) —/gm)].map(
  (match) => match[1],
);
equal(wuHeadings.length, 39, 'WU heading count');
equal(new Set(wuHeadings).size, 39, 'unique WU heading count');

const fields = [
  'WU-ID',
  'Preconditions',
  '依存 WU',
  'allowed_files',
  'forbidden_actions',
  '実装内容',
  '決定を要する点',
  'DoD',
  'Verification',
  '証跡パス',
  '想定される逸脱と禁止事項',
];
for (const field of fields) {
  const count = [...plan.matchAll(new RegExp(`^- \\*\\*${escapeRegex(field)}\\*\\*:`, 'gm'))]
    .length;
  equal(count, 39, `${field} count`);
}

const checkboxLines = plan.split('\n').filter((line) => /^\s*- \[ \]/.test(line));
for (const line of checkboxLines) {
  if (!line.includes('command:') || !line.includes('expected exit code:')) {
    fail(`non-machine checkbox: ${line}`);
  }
}

const preconditions = plan
  .split('\n')
  .filter((line) => line.startsWith('- **Preconditions**:'));
for (const line of preconditions) {
  if (
    !line.includes('command:') ||
    !line.includes('expected exit code:') ||
    !line.includes('着手禁止')
  ) {
    fail(`invalid precondition: ${line}`);
  }
}

const verifications = plan
  .split('\n')
  .filter((line) => line.startsWith('- **Verification**:'));
for (const line of verifications) {
  if (!line.includes('expected exit code')) fail(`invalid verification: ${line}`);
}

const allowedFileLines = plan
  .split('\n')
  .filter((line) => line.startsWith('- **allowed_files**:'));
for (const line of allowedFileLines) {
  if (
    line.includes('.orchestration/acceptance') ||
    line.includes('{reports,validation,acceptance}')
  ) {
    fail(`worker may edit acceptance evidence: ${line}`);
  }
}

for (const line of checkboxLines) {
  if (line.includes('! rg ')) fail(`negative grep masks rg errors: ${line}`);
  if (line.includes('rg -n') && line.includes('no ') && !line.includes('test "$rc" -eq 1')) {
    fail(`negative grep does not require rg exit 1: ${line}`);
  }
}

for (const line of plan.split('\n').filter((item) => item.includes('gh run view'))) {
  for (const token of [
    'scripts/ci-evidence-check.mjs',
    '--workflow',
    '--job',
    '--require-current-source',
  ]) {
    if (!line.includes(token)) fail(`unbound CI run evidence (${token}): ${line}`);
  }
}

const metadataLines = plan
  .split('\n')
  .filter((line) => line.startsWith('- **WU-ID**:'));
const mappedGaps = metadataLines.flatMap((line) => line.match(/GAP-[0-9]{3}/g) ?? []);
const sourceGaps = [...report.matchAll(/^\| (GAP-[0-9]{3}) /gm)].map(
  (match) => match[1],
);
sameSetWithMultiplicity(mappedGaps, sourceGaps, 'source-to-WU gap mapping');

const mappedSpecs = metadataLines.flatMap((line) => line.match(/SPEC-[0-9]{2}/g) ?? []);
const sourceSpecs = [...specification.matchAll(/^\| (SPEC-[0-9]{2}) \|/gm)].map(
  (match) => match[1],
);
sameSetWithMultiplicity(mappedSpecs, sourceSpecs, 'source-to-WU specification mapping');

const primarySection = between(
  plan,
  '## Traceability: GAP-ID to primary WU-ID',
  'Coverage assertion:',
);
const reverseSection = between(
  plan,
  '## Reverse traceability: WU-ID to GAP-ID',
  '## Plan-level query items',
);
const specificationPrimarySection = between(
  plan,
  '## Specification traceability: SPEC-ID to primary WU-ID',
  'Specification coverage assertion:',
);
const specificationReverseSection = between(
  plan,
  '## Reverse specification traceability: WU-ID to SPEC-ID',
  '## Plan-level query items',
);
sameSetWithMultiplicity(
  primarySection.match(/GAP-[0-9]{3}/g) ?? [],
  sourceGaps,
  'primary traceability',
);
sameSetWithMultiplicity(
  specificationPrimarySection.match(/SPEC-[0-9]{2}/g) ?? [],
  sourceSpecs,
  'primary specification traceability',
);
sameSetWithMultiplicity(
  specificationReverseSection.match(/SPEC-[0-9]{2}/g) ?? [],
  sourceSpecs,
  'reverse specification traceability',
);
sameSetWithMultiplicity(
  reverseSection.match(/GAP-[0-9]{3}/g) ?? [],
  sourceGaps,
  'reverse traceability',
);

const reverseWus = [...reverseSection.matchAll(/^\| ([A-Z][0-9]-[0-9]{2}) \|/gm)].map(
  (match) => match[1],
);
sameSetWithMultiplicity(reverseWus, wuHeadings, 'reverse WU mapping');

const knownWus = new Set(wuHeadings);
for (const line of plan.split('\n').filter((item) => item.startsWith('- **依存 WU**:'))) {
  for (const id of line.match(/[A-Z][0-9]-[0-9]{2}/g) ?? []) {
    if (!knownWus.has(id)) fail(`unknown dependency: ${id}`);
  }
}

const wuSections = new Map(
  [...plan.matchAll(
    /^### WU ([A-Z][0-9]-[0-9]{2})[^\n]*\n([\s\S]*?)(?=^### WU |^## Phase Exit Criteria)/gm,
  )].map((match) => [match[1], match[2]]),
);
for (const id of wuHeadings.filter((item) => /^[BCDE]/.test(item))) {
  const precondition = wuSections
    .get(id)
    ?.split('\n')
    .find((line) => line.startsWith('- **Preconditions**:'));
  if (!precondition?.includes('PHASE-A0.md') || !precondition.includes('A0-')) {
    fail(`implementation WU is not bound to applicable A0 acceptance: ${id}`);
  }
}
for (const id of wuHeadings.filter((item) => item.startsWith('A0-'))) {
  const negativeEval = wuSections
    .get(id)
    ?.split('\n')
    .find(
      (line) =>
        /^\s+- \[ \]/.test(line) &&
        line.includes('"$OPA_BIN" eval') &&
        (line.includes("'not ") || line.includes('deny')),
    );
  if (!negativeEval) fail(`A0 WU lacks direct negative opa eval DoD: ${id}`);
}
const b204 = wuSections.get('B2-04') ?? '';
if (!b204.includes('--decision .orchestration/decisions/A0-03.yaml')) {
  fail('B2-04 outage behavior is not decision-bound to SPEC-05');
}
if (b204.includes('returns typed `llm_unavailable`') || b204.includes('produces no success event')) {
  fail('B2-04 preselects the SPEC-05 fallback outcome');
}

const parallel = new Map();
for (const match of plan.matchAll(
  /^### WU ([A-Z][0-9]-[0-9]{2})[^\n]*\n([\s\S]*?)(?=^### WU |^## Phase Exit Criteria)/gm,
)) {
  const dependencyLine = match[2]
    .split('\n')
    .find((line) => line.startsWith('- **依存 WU**:'));
  const parallelClause = dependencyLine?.split('**並行可否**:')[1] ?? '';
  const allowed = parallelClause.match(/parallel with (.*?) is allowed/)?.[1] ?? '';
  parallel.set(match[1], new Set(allowed.match(/[A-Z][0-9]-[0-9]{2}/g) ?? []));
}
for (const [wu, peers] of parallel) {
  for (const peer of peers) {
    if (!parallel.get(peer)?.has(wu)) fail(`asymmetric parallel pair: ${wu}<->${peer}`);
  }
}

const decisionSection = between(plan, '## Decision records', 'Workers are forbidden');
const decisions = decisionSection.match(/\.orchestration\/decisions\/[A-Z0-9-]+\.yaml/g) ?? [];
equal(decisions.length, 12, 'decision record count');
for (const decision of decisions) {
  const occurrences = plan.split(decision).length - 1;
  if (occurrences < 2) fail(`decision not consumed by precondition: ${decision}`);
}

const p0Map = {
  'GAP-008': 'B1-01',
  'GAP-009': 'B1-02',
  'GAP-016': 'B2-01',
  'GAP-017': 'C1-01',
  'GAP-018': 'E1-01',
  'GAP-021': 'D1-01',
  'SPEC-01': 'A0-01',
  'SPEC-02': 'A0-01',
  'SPEC-03': 'A0-01',
  'SPEC-04': 'A0-02',
  'SPEC-05': 'A0-03',
  'SPEC-06': 'A0-04',
};
for (const [gap, wu] of Object.entries(p0Map)) {
  if (!plan.includes(`| ${gap} | ${wu} |`)) fail(`missing P0 closure: ${gap}->${wu}`);
}
if (!plan.includes('| `.orchestration/decisions/A0-03.yaml` | user |')) {
  fail('SPEC-05 decision is not user-owned');
}
if (!plan.includes('| `.orchestration/decisions/A0-08.yaml` | user |')) {
  fail('SPEC-20 decision is not user-owned');
}

for (const word of forbidden) {
  if (new RegExp(`(^|[^A-Za-z])${escapeRegex(word)}([^A-Za-z]|$)`, 'imu').test(plan)) {
    fail(`discretionary term: ${word}`);
  }
}

finish({
  check: 'all',
  wu_count: wuHeadings.length,
  checkbox_count: checkboxLines.length,
  gap_count: sourceGaps.length,
  spec_count: sourceSpecs.length,
  decision_count: decisions.length,
});

function between(text, start, end) {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  if (from === -1 || to === -1) {
    fail(`missing section boundary: ${start} -> ${end}`);
    return '';
  }
  return text.slice(from, to);
}

function sameSetWithMultiplicity(actual, expected, label) {
  const left = [...actual].sort();
  const right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) {
    fail(`${label} mismatch: actual=${left.length} expected=${right.length}`);
  }
}

function equal(actual, expected, label) {
  if (actual !== expected) fail(`${label}: actual=${actual} expected=${expected}`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fail(message) {
  failures.push(message);
}

function finish(summary) {
  if (failures.length > 0) {
    console.error(JSON.stringify({ status: 'failed', failures }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ status: 'passed', ...summary }, null, 2));
  process.exit(0);
}
