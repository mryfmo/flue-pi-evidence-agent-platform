import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const path = 'plans/001-production-work-plan.md';
const plan = readFileSync(path, 'utf8');
const addendum = readFileSync('plans/000-gap-register-addendum.md', 'utf8');
const failures = [];
const wuIds = [...plan.matchAll(/^### WU ([A-Z][0-9]-[0-9]{2}) —/gm)].map((m) => m[1]);

equal(wuIds.length, 44, 'WU count');
equal(new Set(wuIds).size, 44, 'unique WU count');

for (const field of [
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
]) {
  equal(count(new RegExp(`^- \\*\\*${escape(field)}\\*\\*:`, 'gm')), 44, `${field} count`);
}

for (const line of plan.split('\n').filter((line) => /^  - \[ \]/.test(line))) {
  if (!line.includes('command:') || !line.includes('expected exit code:')) {
    failures.push(`non-machine DoD: ${line}`);
  }
}

const metadataGaps = plan
  .split('\n')
  .filter((line) => line.startsWith('- **WU-ID**:'))
  .flatMap((line) => line.match(/GAP-[0-9]{3}/g) ?? []);
const expectedGaps = Array.from({ length: 61 }, (_, index) =>
  `GAP-${String(index + 1).padStart(3, '0')}`,
);
sameSet(metadataGaps, expectedGaps, 'WU GAP ownership');

const primary = between('## Traceability: GAP-ID to primary WU-ID', 'Coverage assertion:');
const primaryGaps = primary.match(/GAP-[0-9]{3}/g) ?? [];
sameSet(primaryGaps, expectedGaps, 'primary GAP traceability');

const reverse = between('## Reverse traceability: WU-ID to GAP-ID', '## Specification traceability');
const reverseGaps = reverse.match(/GAP-[0-9]{3}/g) ?? [];
sameSet(reverseGaps, expectedGaps, 'reverse GAP traceability');

for (const word of ['適宜', '必要に応じて', '可能なら', 'TBD', 'TODO', 'as needed']) {
  if (plan.includes(word)) failures.push(`discretionary placeholder: ${word}`);
}

if (!plan.includes('Phase Exit uses two stages:')) failures.push('two-stage phase exit missing');
if (!plan.includes('All 44 WUs are accepted')) failures.push('Production Ready WU gate missing');
equal(
  new Set(
    between('## Decision records', 'Workers are forbidden')
      .match(/\.orchestration\/decisions\/[A-Z0-9-]+\.yaml/g) ?? [],
  ).size,
  16,
  'decision record count',
);
for (const id of ['B1-01', 'B2-02', 'C1-01', 'D1-01']) {
  const section =
    plan.match(new RegExp('^### WU ' + id + ' —[\\s\\S]*?(?=^### WU |^## Phase Exit)', 'm'))?.[0] ?? '';
  if (!section.match(/\*\*Preconditions\*\*:.*PHASE-A\.md/)) {
    failures.push(id + ' does not machine-require Phase A exit');
  }
}
if (!plan.includes('artifacts/policy/bundle.tar.gz')) {
  failures.push('G2-02 policy bundle output allowlist missing');
}
if (!plan.includes('F1-05-backup.tar.gz') || !plan.includes('F1-05-restore/**')) {
  failures.push('F1-05 exact backup/restore paths missing');
}
if (!plan.includes('for phase in A0 A B C D E F G')) {
  failures.push('Production Ready phase evidence gate missing');
}
if (plan.includes('policy/tests/cc_guard_test.rego')) {
  failures.push('inconsistent cc_guard test path');
}
const c101 =
  plan.match(/^### WU C1-01 —[\s\S]*?(?=^### WU |^## Phase Exit)/m)?.[0] ?? '';
for (const token of [
  'scripts/ci-evidence-check.mjs',
  '--workflow validate-release',
  '--job opensandbox-integration',
  '--require-current-source',
  'gh run view',
]) {
  if (!c101.includes(token)) failures.push('C1-01 CI evidence binding missing: ' + token);
}
const addendumHash = createHash('sha256').update(addendum).digest('hex');
if (!plan.includes(`gap addendum SHA-256: \`${addendumHash}\``)) {
  failures.push('gap addendum digest binding missing or stale');
}

if (failures.length) {
  for (const failure of failures) console.error(`plan-quality:error ${failure}`);
  process.exit(1);
}
console.log('plan-quality:passed wus=44 gaps=61 specs=20');

function count(pattern) {
  return [...plan.matchAll(pattern)].length;
}

function between(start, end) {
  const from = plan.indexOf(start);
  const to = plan.indexOf(end, from);
  if (from < 0 || to < 0) {
    failures.push(`missing section: ${start}`);
    return '';
  }
  return plan.slice(from, to);
}

function equal(actual, expected, label) {
  if (actual !== expected) failures.push(`${label}: expected ${expected}, got ${actual}`);
}

function sameSet(actual, expected, label) {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (a.length !== e.length || a.some((value, index) => value !== e[index])) {
    failures.push(`${label}: expected ${e.length} exact IDs, got ${a.length}`);
  }
}

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
