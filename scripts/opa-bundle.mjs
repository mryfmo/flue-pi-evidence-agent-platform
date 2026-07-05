import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from 'node:fs';
import { join } from 'node:path';
import { opaBinary } from '../src/lib/opa.ts';

const out = 'artifacts/policy/bundle.tar.gz';
const revision = bundleRevision();

function bundleRevision() {
  if (process.env.EAP_BUNDLE_REVISION) return process.env.EAP_BUNDLE_REVISION;
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    const files = [
      ...readdirSync('policy')
        .filter((file) => file.endsWith('.rego'))
        .sort()
        .map((file) => join('policy', file)),
      join('policy', 'tenants.json'),
    ];
    const hash = createHash('sha256');
    for (const file of files) {
      hash.update(file);
      hash.update('\0');
      hash.update(readFileSync(file));
      hash.update('\0');
    }
    return `policyhash-${hash.digest('hex').slice(0, 12)}`;
  }
}

mkdirSync('artifacts/policy', { recursive: true });
execFileSync(
  opaBinary(),
  ['build', '-b', 'policy', '-o', out, '--revision', revision],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
  },
);

if (!existsSync(out) || statSync(out).size === 0) {
  throw new Error(`OPA bundle was not written: ${out}`);
}

console.log(`opa-bundle:ok revision=${revision} path=${out}`);
