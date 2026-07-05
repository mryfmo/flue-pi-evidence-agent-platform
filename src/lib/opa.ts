/** OPA-backed policy decision adapter using a real bundled OPA binary. */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { PolicyDecision, PolicyInput } from './types.ts';

const execFileAsync = promisify(execFile);

export function opaBinary(): string {
  return (
    process.env.EAP_OPA_BINARY ??
    resolve('node_modules/agent-control-specification-opa-linux-x64/bin/opa')
  );
}

export async function evaluatePolicy(
  input: PolicyInput,
  policyPath = 'policy/agent.rego',
): Promise<PolicyDecision> {
  const tmp = await mkdtemp(join(tmpdir(), 'eap-opa-'));
  const inputPath = join(tmp, 'input.json');
  await writeFile(inputPath, JSON.stringify(input), 'utf8');
  const args = [
    'eval',
    '--format',
    'json',
    '--data',
    policyPath,
    '--input',
    inputPath,
    'data.eap.agent',
  ];
  try {
    const { stdout } = await execFileAsync(opaBinary(), args, {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as {
      result?: Array<{
        expressions?: Array<{
          value?: {
            allow?: boolean;
            requires_approval?: boolean;
            deny_reason?: string[];
          };
        }>;
      }>;
    };
    const value = parsed.result?.[0]?.expressions?.[0]?.value;
    if (!value) throw new Error('OPA returned no decision');
    const denyReasons = Array.isArray(value.deny_reason)
      ? value.deny_reason
      : [];
    return {
      allow: value.allow === true,
      requires_approval: value.requires_approval === true,
      reasons: denyReasons.length > 0 ? denyReasons : ['ok'],
    };
  } catch (error) {
    return {
      allow: false,
      requires_approval: true,
      reasons: [`policy_unavailable:${String(error)}`],
    };
  }
}

export async function readPolicy(): Promise<string> {
  return readFile('policy/agent.rego', 'utf8');
}
