import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const checks = [];

async function main() {
  checkSqlite();
  checkWritableDirs();
  checkPolicyJson();
  checkLiteLlmConfig();
  await checkLive();

  for (const check of checks) {
    console.log(
      `${check.name}: ${check.status}${check.detail ? ` ${check.detail}` : ''}`,
    );
  }
  if (checks.some((check) => check.status === 'fail')) process.exit(1);
}

function record(name, status, detail = '') {
  checks.push({ name, status, detail });
}

function checkSqlite() {
  const db =
    process.env.AGMSG_DB ??
    `${process.env.HOME}/.agents/skills/agmsg/db/agmsg.sqlite`;
  const result = spawnSync('sqlite3', [db, 'SELECT 1;'], { encoding: 'utf8' });
  record('agmsg_db', result.status === 0 ? 'ok' : 'fail', db);
}

function checkWritableDirs() {
  for (const dir of [
    '.orchestration/tasks',
    '.orchestration/reports',
    '.orchestration/validation',
    '.orchestration/acceptance',
  ]) {
    try {
      mkdirSync(dir, { recursive: true });
      const path = join(dir, '.platform-health.tmp');
      writeFileSync(path, 'ok', 'utf8');
      rmSync(path, { force: true });
      record(`writable:${dir}`, 'ok');
    } catch (error) {
      record(`writable:${dir}`, 'fail', error.message);
    }
  }
}

function checkPolicyJson() {
  for (const path of ['policy/routing.json', 'policy/routing.prod.json']) {
    try {
      JSON.parse(readFileSync(path, 'utf8'));
      record(`parse:${path}`, 'ok');
    } catch (error) {
      record(`parse:${path}`, 'fail', error.message);
    }
  }
}

function checkLiteLlmConfig() {
  try {
    const output = execFileSync('node', ['scripts/check-litellm-config.mjs'], {
      encoding: 'utf8',
    }).trim();
    record('litellm_config', 'ok', output);
  } catch (error) {
    record('litellm_config', 'fail', error.message);
  }
}

async function checkLive() {
  if (!process.argv.includes('--live')) {
    record('litellm_live', 'skip', 'use --live to enable HTTP check');
    return;
  }
  try {
    const response = await fetch(process.env.LITELLM_BASE_URL);
    record(
      'litellm_live',
      response.ok ? 'ok' : 'fail',
      `status=${response.status}`,
    );
  } catch (error) {
    record('litellm_live', 'fail', error.message);
  }
}

main();
