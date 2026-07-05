/** OPA-backed policy decision adapter using a real bundled OPA binary. */
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { PolicyDecision, PolicyInput } from './types.ts';

const execFileAsync = promisify(execFile);
const opaPackages: Record<string, string> = {
  'darwin-arm64': 'agent-control-specification-opa-darwin-arm64',
  'darwin-x64': 'agent-control-specification-opa-darwin-x64',
  'linux-arm64': 'agent-control-specification-opa-linux-arm64',
  'linux-x64': 'agent-control-specification-opa-linux-x64',
};

export function opaBinary(): string {
  if (process.env.EAP_OPA_BINARY) return process.env.EAP_OPA_BINARY;
  const platformKey = `${process.platform}-${process.arch}`;
  const packageName = opaPackages[platformKey];
  if (!packageName) {
    throw new Error(
      `No bundled OPA binary for ${platformKey}; supported: ${Object.keys(opaPackages).join(', ')}. Set EAP_OPA_BINARY to override.`,
    );
  }
  const binary = resolve('node_modules', packageName, 'bin', 'opa');
  if (!existsSync(binary)) {
    throw new Error(
      `Bundled OPA binary is not installed at ${binary}. Run npm ci without omitting optional dependencies, or set EAP_OPA_BINARY.`,
    );
  }
  return binary;
}

export async function evaluatePolicy(
  input: PolicyInput | unknown,
  policyPath = 'policy/agent.rego',
  query = 'data.eap.agent',
  dataPath = 'policy/tenants.json',
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
    '--data',
    dataPath,
    '--input',
    inputPath,
    query,
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
