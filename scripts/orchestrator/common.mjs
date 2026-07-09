import { existsSync, readFileSync } from 'node:fs';

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      args[key] = argv[i + 1];
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

export function requireArgs(args, names) {
  const missing = names.filter((name) => !args[name]);
  if (missing.length > 0) {
    throw new Error(`missing required argument(s): ${missing.join(', ')}`);
  }
}

export function appendJsonlLine(record) {
  return `${JSON.stringify(record)}\n`;
}

export function parseFields(text) {
  const fields = {};
  for (const match of text.matchAll(/(?:^|\s)([A-Za-z0-9_.-]+)=([^\s]+)/g)) {
    fields[match[1]] = match[2];
  }
  return fields;
}

export function latestResult(historyText, taskId) {
  const lines = historyText.split(/\r?\n/);
  let latest = null;
  for (const line of lines) {
    const marker = line.indexOf('AGMSG-RESULT v1');
    if (marker === -1) continue;
    const raw = line.slice(marker);
    const fields = parseFields(raw);
    if (fields.task_id === taskId) latest = { raw, fields };
  }
  return latest;
}

export function readIfExists(path) {
  return path && existsSync(path) ? readFileSync(path, 'utf8') : '';
}
