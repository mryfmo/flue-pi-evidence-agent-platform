import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const taskId = process.argv[2];
const format = process.argv.includes('--json') ? 'json' : 'md';

if (!taskId || taskId.startsWith('--')) {
  console.error('usage: node scripts/audit-trace.mjs <task_id> [--json|--md]');
  process.exit(2);
}

const trace = buildTrace(taskId);
if (format === 'json') {
  console.log(JSON.stringify(trace, null, 2));
} else {
  console.log(renderMarkdown(trace));
}

if (trace.record_count === 0) process.exit(1);

export function buildTrace(id, cwd = process.cwd()) {
  const taskPath = join(cwd, '.orchestration/tasks', `${id}.md`);
  const reports = artifactFiles(cwd, 'reports', id);
  const validation = artifactFiles(cwd, 'validation', id);
  const sandbox = artifactFiles(cwd, 'sandboxes', id);
  const acceptance = artifactFiles(cwd, 'acceptance', id);
  const events = readJsonl(
    join(cwd, '.orchestration/orchestrator/events.jsonl'),
  )
    .filter((event) => event.task_id === id)
    .map(sanitize);
  const leases = readJson(
    join(cwd, '.orchestration/orchestrator/leases.json'),
    [],
  )
    .filter((lease) => lease.task_id === id)
    .map(sanitize);
  const auditEvents = filesIn(join(cwd, 'artifacts/audit'), '.jsonl').flatMap(
    (path) =>
      readJsonl(path)
        .filter((event) => eventMatchesTask(event, id))
        .map((event) => ({ file: rel(cwd, path), event: sanitize(event) })),
  );
  const telemetry = readJsonl(join(cwd, 'artifacts/telemetry/traces.jsonl'))
    .filter((span) => span?.attributes?.['gateway.task_id'] === id)
    .map(sanitize);

  const sections = {
    delegation: {
      status:
        existsSync(taskPath) ||
        events.some((event) => event.type === 'delegate')
          ? 'present'
          : 'missing',
      task_file: existsSync(taskPath) ? rel(cwd, taskPath) : null,
      events: events.filter((event) => event.type === 'delegate'),
    },
    policy_decisions: {
      status: auditEvents.some(({ event }) => event.type === 'policy_decision')
        ? 'present'
        : 'missing',
      events: auditEvents.filter(
        ({ event }) => event.type === 'policy_decision',
      ),
    },
    sandbox: {
      status: sandbox.length > 0 ? 'present' : 'missing',
      files: sandbox,
    },
    llm_events: {
      status:
        auditEvents.some(({ event }) => event.type === 'llm_gateway_call') ||
        telemetry.length > 0
          ? 'present'
          : 'missing',
      audit: auditEvents.filter(
        ({ event }) => event.type === 'llm_gateway_call',
      ),
      telemetry,
    },
    validation: {
      status: validation.length > 0 ? 'present' : 'missing',
      files: validation,
    },
    acceptance: {
      status:
        acceptance.length > 0 || events.some((event) => event.type === 'accept')
          ? 'present'
          : 'missing',
      files: acceptance,
      events: events.filter((event) => event.type === 'accept'),
    },
    leases: {
      status: leases.length > 0 ? 'present' : 'missing',
      entries: leases,
    },
    reports: {
      status: reports.length > 0 ? 'present' : 'missing',
      files: reports,
    },
  };
  return {
    task_id: id,
    record_count: countRecords(sections),
    sections,
  };
}

function countRecords(sections) {
  return (
    Number(Boolean(sections.delegation.task_file)) +
    sections.delegation.events.length +
    sections.policy_decisions.events.length +
    sections.sandbox.files.length +
    sections.llm_events.audit.length +
    sections.llm_events.telemetry.length +
    sections.validation.files.length +
    sections.acceptance.files.length +
    sections.acceptance.events.length +
    sections.leases.entries.length +
    sections.reports.files.length
  );
}

function artifactFiles(cwd, name, id) {
  return filesIn(join(cwd, '.orchestration', name))
    .filter((path) => basename(path).startsWith(id))
    .map((path) => {
      const text = safeRead(path);
      return {
        path: rel(cwd, path),
        status: extractStatus(text),
      };
    });
}

function extractStatus(text) {
  return (
    text.match(/^status:\s*([^\n]+)/m)?.[1]?.trim() ??
    text.match(/\bstatus=([^\s]+)/)?.[1]?.trim() ??
    text.match(/\boverall:\s*([^\n]+)/)?.[1]?.trim() ??
    'unknown'
  );
}

function eventMatchesTask(event, id) {
  return (
    event?.task_id === id ||
    event?.taskId === id ||
    event?.payload?.task_id === id ||
    event?.metadata?.task_id === id
  );
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function readJsonl(path) {
  return safeRead(path)
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
}

function filesIn(dir, suffix = '') {
  try {
    return readdirSync(dir)
      .map((name) => join(dir, name))
      .filter((path) => statSync(path).isFile())
      .filter((path) => !suffix || path.endsWith(suffix));
  } catch {
    return [];
  }
}

function safeRead(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (
      /^(?:content|text|body|prompt|response|messages|stdout|stderr|raw)$/i.test(
        key,
      )
    ) {
      out[key] = {
        redacted: true,
        sha256: digest(item),
      };
    } else {
      out[key] = sanitize(item);
    }
  }
  return out;
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function renderMarkdown(trace) {
  const lines = [
    `# Audit Trace: ${trace.task_id}`,
    '',
    `record_count: ${trace.record_count}`,
    '',
  ];
  for (const [name, section] of Object.entries(trace.sections)) {
    lines.push(`## ${title(name)}`, '', `status: ${section.status}`, '');
    const body = { ...section };
    delete body.status;
    if (section.status === 'missing') {
      lines.push('missing', '');
      continue;
    }
    lines.push('```json', JSON.stringify(body, null, 2), '```', '');
  }
  return lines.join('\n');
}

function title(value) {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function rel(cwd, path) {
  return path.startsWith(cwd) ? path.slice(cwd.length + 1) : path;
}
