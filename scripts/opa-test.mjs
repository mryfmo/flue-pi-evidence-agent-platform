import { execFileSync } from 'node:child_process';
import { opaBinary } from '../src/lib/opa.ts';

execFileSync(
  opaBinary(),
  ['test', 'policy', '--ignore', 'routing*.json', '-v'],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
  },
);
