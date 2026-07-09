import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  appendJsonlLine,
  latestResult,
  parseArgs,
  readIfExists,
  requireArgs,
} from './common.mjs';

const historyScript =
  process.env.AGMSG_HISTORY_SH ??
  `${process.env.HOME}/.agents/skills/agmsg/scripts/history.sh`;
const team = process.env.AGMSG_TEAM ?? 'flue-pi-productionization';
const agent = process.env.AGMSG_AGENT ?? 'orchestrator-fable5';
const leasesPath =
  process.env.ORCHESTRATOR_LEASES ?? '.orchestration/orchestrator/leases.json';
const eventsPath =
  process.env.ORCHESTRATOR_EVENTS ?? '.orchestration/orchestrator/events.jsonl';

export function accept(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  requireArgs(args, ['task-id', 'approver']);
  const historyText =
    options.historyText ??
    (args['history-file']
      ? readIfExists(args['history-file'])
      : execFileSync(historyScript, [team, agent], { encoding: 'utf8' }));
  const result = latestResult(historyText, args['task-id']);
  if (!result) throw new Error('no AGMSG-RESULT found');

  const tier = result.fields.acceptance_tier ?? 'review';
  if (tier === 'review') throw new Error('review tier requires human review');
  if (tier === 'confirm' && !args['user-confirmed']) {
    throw new Error('confirm tier requires --user-confirmed');
  }
  if (tier === 'auto') {
    const validation = readIfExists(
      args['validation-file'] ?? result.fields.validation,
    );
    if (!validationAllowsAuto(validation)) {
      throw new Error('auto tier requires passed validation evidence');
    }
  }

  mkdirSync(dirname(eventsPath), { recursive: true });
  writeFileSync(
    eventsPath,
    appendJsonlLine({
      ts: new Date().toISOString(),
      type: 'accept',
      task_id: args['task-id'],
      tier,
      approver: args.approver,
      acceptance_md_exists: existsSync(
        `.orchestration/acceptance/${args['task-id']}.acceptance.md`,
      ),
    }),
    { flag: 'a' },
  );
  releaseLease(args['task-id']);
  return `accepted task_id=${args['task-id']} tier=${tier}\n`;
}

export function validationAllowsAuto(text) {
  return (
    /(?:validate-release:passed|exit 0|all gates passed|passed)/i.test(text) &&
    !/(?:validate-release:failed|status=failed|failed gate|:\s*failed|\bfailed\b)/i.test(
      text,
    )
  );
}

function releaseLease(taskId) {
  let leases = [];
  try {
    leases = JSON.parse(readFileSync(leasesPath, 'utf8'));
  } catch {
    return;
  }
  for (const lease of leases) {
    if (lease.task_id === taskId && lease.status === 'active') {
      lease.status = 'released';
      lease.released_at = new Date().toISOString();
    }
  }
  writeFileSync(leasesPath, `${JSON.stringify(leases, null, 2)}\n`, 'utf8');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.stdout.write(accept());
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
