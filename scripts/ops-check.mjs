import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const rows = [
  checkGitRemote(),
  checkFinalVerification(),
  checkBundleRevision(),
  checkPromotedSkill(),
];

const widths = [12, 24, 70];
console.log(`| ${pad('status', 12)} | ${pad('check', 24)} | details |`);
console.log(`| ${'-'.repeat(12)} | ${'-'.repeat(24)} | ${'-'.repeat(70)} |`);
for (const row of rows) {
  console.log(
    `| ${pad(row.status, 12)} | ${pad(row.check, 24)} | ${row.details} |`,
  );
}

if (rows.some((row) => row.status === 'fail')) {
  process.exit(1);
}

function checkGitRemote() {
  try {
    const remote = execFileSync('git', ['remote', 'get-url', 'origin'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    try {
      execFileSync('git', ['ls-remote', '--exit-code', 'origin', 'HEAD'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      });
      return ok('git remote', `origin reachable: ${remote}`);
    } catch {
      return warn(
        'git remote',
        `origin configured but reachability offline: ${remote}`,
      );
    }
  } catch {
    return fail('git remote', 'origin remote is not configured');
  }
}

function checkFinalVerification() {
  const path = 'artifacts/validation/final_verification_report.json';
  if (!existsSync(path)) return fail('final report', `${path} missing`);
  const report = JSON.parse(readFileSync(path, 'utf8'));
  if (report.status !== 'passed') {
    return fail('final report', `latest status=${report.status ?? 'missing'}`);
  }
  return ok('final report', `status=passed generatedAt=${report.generatedAt}`);
}

function checkBundleRevision() {
  try {
    const manifest = execFileSync(
      'tar',
      ['-xOzf', 'artifacts/policy/bundle.tar.gz', '/.manifest'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    const revision = JSON.parse(manifest).revision;
    if (!revision) return fail('opa bundle', 'manifest revision missing');
    return ok('opa bundle', `revision=${revision}`);
  } catch {
    return fail(
      'opa bundle',
      'artifacts/policy/bundle.tar.gz manifest unreadable',
    );
  }
}

function checkPromotedSkill() {
  const path = '.orchestration/skills/promoted/remediator/best_skill.md';
  if (!existsSync(path)) return fail('promoted skill', `${path} missing`);
  const frontmatter = parseFrontmatter(readFileSync(path, 'utf8'));
  if (!frontmatter.has('version'))
    return fail('promoted skill', 'version missing');
  if (!frontmatter.has('provenance')) {
    return fail('promoted skill', 'provenance missing');
  }
  const evidence = frontmatter.get('validation_evidence');
  if (!evidence || !existsSync(evidence)) {
    return fail(
      'promoted skill',
      `validation evidence missing: ${evidence ?? 'none'}`,
    );
  }
  return ok(
    'promoted skill',
    `version=${frontmatter.get('version')} evidence=${evidence}`,
  );
}

function parseFrontmatter(markdown) {
  const values = new Map();
  if (!markdown.startsWith('---\n')) return values;
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return values;
  for (const line of markdown.slice(4, end).split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (match) values.set(match[1], match[2].trim());
  }
  return values;
}

function ok(check, details) {
  return { status: 'ok', check, details };
}

function warn(check, details) {
  return { status: 'warn', check, details };
}

function fail(check, details) {
  return { status: 'fail', check, details };
}

function pad(value, width) {
  return value.padEnd(width).slice(0, width);
}
