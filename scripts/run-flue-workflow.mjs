import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [workflow, payload, stdoutPath, stderrPath, expected] =
  process.argv.slice(2);
if (!workflow || !payload || !stdoutPath || !stderrPath || !expected) {
  throw new Error(
    'usage: run-flue-workflow <workflow> <payload> <stdout> <stderr> <expected>',
  );
}
try {
  const stdout = execFileSync(
    './node_modules/node/bin/node',
    [
      './node_modules/@flue/cli/bin/flue.mjs',
      'run',
      workflow,
      '--target',
      'node',
      '--payload',
      payload,
    ],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
  );
  writeFileSync(stdoutPath, stdout);
  writeFileSync(stderrPath, '');
  if (!stdout.includes(expected)) {
    throw new Error(`expected marker not found: ${expected}`);
  }
  console.log('workflow-result:matched');
} catch (error) {
  const err = error;
  writeFileSync(stdoutPath, err.stdout?.toString?.() ?? '');
  writeFileSync(stderrPath, err.stderr?.toString?.() ?? String(error));
  throw error;
}
