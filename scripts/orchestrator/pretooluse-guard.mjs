import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

export function decideGuard(input, cwd = process.cwd()) {
  const paths = extractPaths(input).map((path) => normalizePath(path, cwd));
  const command =
    input?.tool_name === 'Bash' ? (input.tool_input?.command ?? '') : '';
  const activeLeases = readActiveLeases();
  const guardInput = { paths, command, active_leases: activeLeases };
  const opaReasons = opaDenyReasons(guardInput);
  const denyReasons = opaReasons ?? builtinDenyReasons(guardInput);
  return { allow: denyReasons.length === 0, denyReasons, input: guardInput };
}

export function extractPaths(input) {
  const toolInput = input?.tool_input ?? {};
  if (typeof toolInput.file_path === 'string') return [toolInput.file_path];
  if (Array.isArray(toolInput.edits) && typeof toolInput.path === 'string') {
    return [toolInput.path];
  }
  if (typeof toolInput.command === 'string')
    return extractCommandPaths(toolInput.command);
  return [];
}

function extractCommandPaths(command) {
  const paths = [];
  for (const match of command.matchAll(
    /(?:^|\s)(\.?\.?\/?[A-Za-z0-9_.@/-]+)/g,
  )) {
    const token = match[1];
    if (
      token.startsWith('policy/') ||
      token.startsWith('artifacts/audit/') ||
      token.startsWith('.env')
    ) {
      paths.push(token);
    }
  }
  return paths;
}

function normalizePath(path, cwd) {
  if (path.startsWith(cwd)) return relative(cwd, path) || '.';
  return path.replace(/^\.\//, '');
}

function readActiveLeases() {
  try {
    const leases = JSON.parse(
      readFileSync('.orchestration/orchestrator/leases.json', 'utf8'),
    );
    return leases
      .filter((lease) => lease.status === 'active')
      .flatMap((lease) => lease.paths ?? [])
      .map((path) => path.replace(/^\.\//, ''));
  } catch {
    return [];
  }
}

function opaDenyReasons(input) {
  const opa = process.env.EAP_OPA_BINARY ?? 'opa';
  const dir = mkdtempSync(join(tmpdir(), 'cc-guard-'));
  const inputPath = join(dir, 'input.json');
  try {
    writeFileSync(inputPath, JSON.stringify(input), 'utf8');
    const stdout = execFileSync(
      opa,
      [
        'eval',
        '-f',
        'json',
        '-d',
        'policy/cc_guard.rego',
        '-i',
        inputPath,
        'data.eap.cc_guard.deny_reason',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const parsed = JSON.parse(stdout);
    const value = parsed.result?.[0]?.expressions?.[0]?.value;
    return Array.isArray(value)
      ? value.sort()
      : Object.keys(value ?? {}).sort();
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function builtinDenyReasons(input) {
  const reasons = [];
  for (const path of input.paths) {
    if (isControlledPath(path)) reasons.push(`controlled_path:${path}`);
    for (const lease of input.active_leases) {
      if (
        path === lease ||
        path.startsWith(`${lease}/`) ||
        lease.startsWith(`${path}/`)
      ) {
        reasons.push(`active_lease:${path}`);
      }
    }
  }
  if (
    /\bgit\s+(?:checkout|switch|push|merge|rebase)\b.*\brelease\b/i.test(
      input.command,
    )
  ) {
    reasons.push('release_branch_operation');
  }
  return reasons;
}

function isControlledPath(path) {
  return (
    path.startsWith('policy/') ||
    path.startsWith('artifacts/audit/') ||
    /^\.env(?:$|\.)/.test(path)
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let text = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    text += chunk;
  });
  process.stdin.on('end', () => {
    const result = decideGuard(JSON.parse(text || '{}'));
    if (result.allow) process.exit(0);
    console.error(result.denyReasons.join('\n'));
    process.exit(2);
  });
}
