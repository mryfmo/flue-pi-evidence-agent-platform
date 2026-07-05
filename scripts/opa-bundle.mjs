import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { opaBinary } from '../src/lib/opa.ts';

const out = 'artifacts/policy/bundle.tar.gz';
const revision =
  process.env.POLICY_BUNDLE_REVISION ??
  process.argv[2] ??
  execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
    encoding: 'utf8',
  }).trim();

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
