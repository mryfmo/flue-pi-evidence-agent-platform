import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const configPath = process.argv[2] ?? 'config/litellm/config.yaml';
const text = readFileSync(configPath, 'utf8');
const lines = text.split(/\r?\n/);
const errors = [];
const unsafeBodyLogPatterns = [
  /["']messages["']\s*:/,
  /\.get\(["']messages["']\)/,
  /["']prompt["']\s*:/,
  /\.get\(["']prompt["']\)/,
  /["']content["']\s*:/,
  /\.get\(["']content["']\)/,
  /["']response["']\s*:/,
  /\.get\(["']response["']\)/,
];

// ponytail: deliberately validates the fixed LiteLLM config shape without a YAML dependency.
const modelNames = new Set();
for (const match of text.matchAll(/^\s*-\s*model_name:\s*([^\s#]+)/gm)) {
  modelNames.add(unquote(match[1]));
}

for (const name of ['worker-fast', 'worker-main', 'worker-heavy']) {
  if (!modelNames.has(name)) errors.push(`missing model alias: ${name}`);
}

for (const match of text.matchAll(/^\s*model:\s*([^\s#]+)/gm)) {
  const model = unquote(match[1]);
  if (!model.startsWith('anthropic/')) {
    errors.push(`non-anthropic model reference: ${model}`);
  }
}

if (!/^\s*turn_off_message_logging:\s*true\s*(?:#.*)?$/m.test(text)) {
  errors.push('litellm_settings.turn_off_message_logging must be true');
}

for (const match of text.matchAll(/os\.environ\/([A-Z0-9_]+)/g)) {
  const key = match[1];
  if (!['ANTHROPIC_API_KEY', 'LITELLM_MASTER_KEY'].includes(key)) {
    errors.push(`disallowed environment key reference: ${key}`);
  }
}

for (const line of lines) {
  const match = line.match(/^\s*-\s*([^:\s]+):\s*\[(.*)\]\s*(?:#.*)?$/);
  if (!match) continue;
  const source = unquote(match[1]);
  if (!modelNames.has(source))
    errors.push(`fallback source outside model_list: ${source}`);
  for (const target of match[2]
    .split(',')
    .map((item) => unquote(item.trim()))) {
    if (target && !modelNames.has(target)) {
      errors.push(`fallback target outside model_list: ${target}`);
    }
  }
}

let bindSeen = false;
for (const line of lines) {
  const match = line.match(/^\s*(host|bind|address):\s*([^\s#]+)\s*(?:#.*)?$/i);
  if (!match) continue;
  bindSeen = true;
  const value = unquote(match[2]);
  if (value !== '127.0.0.1') errors.push(`non-local bind address: ${value}`);
}
if (!bindSeen) errors.push('missing bind host/address');

for (const callback of callbackRefs(text)) {
  const [moduleName, instanceName] = callback.split('.');
  if (!moduleName || !instanceName) {
    errors.push(`callback must use module.instance form: ${callback}`);
    continue;
  }
  const modulePath = join(dirname(configPath), `${moduleName}.py`);
  if (!existsSync(modulePath)) {
    errors.push(`missing callback module: ${modulePath}`);
    continue;
  }
  const moduleText = readFileSync(modulePath, 'utf8');
  for (const pattern of unsafeBodyLogPatterns) {
    if (pattern.test(moduleText)) {
      errors.push(`callback appears to reference body field: ${modulePath}`);
      break;
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`litellm_config:passed ${configPath}`);

function unquote(value) {
  return value.replace(/^["']|["']$/g, '');
}

function callbackRefs(configText) {
  const refs = [];
  for (const match of configText.matchAll(
    /^\s*(?:success_callback|failure_callback):\s*\[(.*)\]\s*(?:#.*)?$/gm,
  )) {
    refs.push(
      ...match[1]
        .split(',')
        .map((item) => unquote(item.trim()))
        .filter(Boolean),
    );
  }
  return refs;
}
