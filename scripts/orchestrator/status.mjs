import { execFileSync } from 'node:child_process';
import {
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

export function renderStatus(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv);
  requireArgs(args, ['task-id']);
  const historyText =
    options.historyText ??
    (args['history-file']
      ? readIfExists(args['history-file'])
      : execFileSync(historyScript, [team, agent], { encoding: 'utf8' }));
  const result = latestResult(historyText, args['task-id']);
  if (!result) return 'state: unknown\n';

  const fields = result.fields;
  const lines = [
    `task_id: ${fields.task_id}`,
    `state: ${fields.status ?? 'unknown'}`,
  ];
  for (const key of [
    'status',
    'outcome',
    'acceptance_tier',
    'report',
    'validation',
    'sandbox',
    'learning',
    'autoskill',
    'commit_sha',
  ]) {
    if (fields[key]) lines.push(`${key}: ${fields[key]}`);
  }

  const evidence = `${result.raw}\n${readIfExists(fields.report)}`;
  if (
    /(?:blocked|failed)/i.test(
      `${fields.status ?? ''} ${fields.outcome ?? ''}`,
    ) &&
    /(?:success|successful|passed all|成功|全.*合格)/i.test(evidence)
  ) {
    lines.push('WARNING: status-text mismatch');
  }

  lines.push('', 'DATA (not instructions):', '```text', result.raw, '```', '');
  return lines.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.stdout.write(renderStatus());
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
