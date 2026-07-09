import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { appendJsonlLine, parseArgs, requireArgs } from './common.mjs';

const sendScript =
  process.env.AGMSG_SEND_SH ??
  `${process.env.HOME}/.agents/skills/agmsg/scripts/send.sh`;
const team = process.env.AGMSG_TEAM ?? 'flue-pi-productionization';
const from = process.env.AGMSG_FROM ?? 'orchestrator-fable5';
const leasesPath =
  process.env.ORCHESTRATOR_LEASES ?? '.orchestration/orchestrator/leases.json';
const eventsPath =
  process.env.ORCHESTRATOR_EVENTS ?? '.orchestration/orchestrator/events.jsonl';

export function delegate(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  requireArgs(args, ['task-id', 'task-file', 'to', 'lease']);
  const taskId = args['task-id'];
  const maxTurns = args['max-turns'] ?? '3';
  const paths = String(args.lease)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const expiresAt = new Date(
    Date.now() + Number(process.env.ORCHESTRATOR_LEASE_TTL_MS ?? 3600000),
  ).toISOString();
  const message = [
    'AGMSG-TASK v1',
    `task_id=${taskId}`,
    `repo=${process.cwd()}`,
    `task_file=${args['task-file']}`,
    'allowed_files=see-task-file-section-4',
    'forbidden_actions=see-task-file',
    `expected_result_file=.orchestration/reports/${taskId}.report.md`,
    `expected_validation_file=.orchestration/validation/${taskId}.validation.log`,
    `expected_sandbox_file=.orchestration/sandboxes/${taskId}.sandbox.md`,
    `expected_learning_file=.orchestration/learning/${taskId}.learning.md`,
    `expected_autoskill_file=.orchestration/autoskill/runs/${taskId}.autoskill.md`,
    'done_signal=AGMSG-RESULT',
    `max_turns=${maxTurns}`,
  ].join(' ');
  execFileSync(sendScript, [team, from, args.to, message], {
    stdio: 'inherit',
  });

  mkdirSync(dirname(leasesPath), { recursive: true });
  const leases = readJson(leasesPath, []);
  leases.push({
    task_id: taskId,
    paths,
    expires_at: expiresAt,
    status: 'active',
  });
  writeFileSync(leasesPath, `${JSON.stringify(leases, null, 2)}\n`, 'utf8');

  mkdirSync(dirname(eventsPath), { recursive: true });
  writeFileSync(
    eventsPath,
    appendJsonlLine({
      ts: new Date().toISOString(),
      type: 'delegate',
      task_id: taskId,
      task_file: args['task-file'],
      to: args.to,
    }),
    { flag: 'a' },
  );
  return taskId;
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    console.log(delegate());
  } catch (error) {
    console.error(`task_not_delegated reason=${error.message}`);
    process.exit(1);
  }
}
