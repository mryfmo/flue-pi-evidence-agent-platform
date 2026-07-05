import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const cycle = process.argv[2];
if (!cycle || !/^[1-9]\d*$/.test(cycle)) {
  throw new Error('usage: node scripts/skill-cycle.mjs <cycle-number>');
}

const candidateDir = '.orchestration/skills/candidates/remediator';
const verdictPath = `${candidateDir}/cycle-${cycle}.verdict.json`;
const bestSkill = '.orchestration/skills/promoted/remediator/best_skill.md';
const candidateSkill = `${candidateDir}/candidate_skill.md`;

const runs = [
  runHeldout('best', bestSkill),
  runHeldout('candidate', candidateSkill),
];
const candidate = runs.find((run) => run.name === 'candidate');
const release = candidate?.passed
  ? runCommand('validate-release', 'npm', ['run', 'validate-release'])
  : { name: 'validate-release', exitCode: null, passed: false, skipped: true };
const outcome = candidate?.passed && release.passed ? 'validated' : 'rejected';

const verdict = {
  cycle: Number(cycle),
  generatedBy: 'scripts/skill-cycle.mjs',
  limitation:
    'Deterministic local gateway validates non-regression of the gated pipeline; semantic quality comparison activates on the production gateway path.',
  runs,
  criteria: {
    perRun: ['workflow exit 0', 'closure achieved', 'e2e artifact assertions'],
    candidateValidated: ['candidate run passes', 'validate-release passes'],
  },
  release,
  outcome,
  promotionAllowed: false,
};

mkdirSync(dirname(verdictPath), { recursive: true });
writeFileSync(verdictPath, `${JSON.stringify(verdict, null, 2)}\n`);
console.log(verdict.limitation);
console.log(`skill-cycle verdict: ${outcome}`);
console.log(`wrote ${verdictPath}`);

function runHeldout(name, skillPath) {
  const workflow = runCommand(
    `${name}:heldout`,
    'npm',
    ['run', 'flue:e2e:heldout'],
    { EAP_REMEDIATOR_SKILL: skillPath },
  );
  const artifacts = workflow.passed
    ? runCommand(`${name}:artifacts`, './node_modules/node/bin/node', [
        'scripts/assert-e2e-artifacts.mjs',
      ])
    : {
        name: `${name}:artifacts`,
        exitCode: null,
        passed: false,
        skipped: true,
      };
  const closureAchieved = workflow.passed ? latestClosureClosed() : false;
  return {
    name,
    skillPath,
    workflowExit0: workflow.passed,
    closureAchieved,
    artifactsPassed: artifacts.passed,
    passed: workflow.passed && closureAchieved && artifacts.passed,
    workflow,
    artifacts,
  };
}

function runCommand(name, command, args, env = {}) {
  try {
    execFileSync(command, args, {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });
    return { name, exitCode: 0, passed: true };
  } catch (error) {
    return {
      name,
      exitCode: typeof error.status === 'number' ? error.status : 1,
      passed: false,
      stderr: error.stderr?.toString?.() ?? String(error),
    };
  }
}

function latestClosureClosed() {
  const lines = readFileSync('artifacts/audit/remediation.jsonl', 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return (
    lines.findLast((line) => line.type === 'run_end')?.closure?.closed === true
  );
}
