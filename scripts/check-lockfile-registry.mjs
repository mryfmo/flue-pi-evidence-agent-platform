import { readFileSync } from 'node:fs';

const allowedPrefix = 'https://registry.npmjs.org/';
const lockfile = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const offenders = Object.entries(lockfile.packages ?? {})
  .filter(
    ([, entry]) => entry?.resolved && !entry.resolved.startsWith(allowedPrefix),
  )
  .map(([name, entry]) => `${name || '<root>'}: ${entry.resolved}`);

if (offenders.length > 0) {
  console.error('lockfile-registry:offenders');
  console.error(offenders.join('\n'));
  process.exit(1);
}

console.log('lockfile-registry:ok');
