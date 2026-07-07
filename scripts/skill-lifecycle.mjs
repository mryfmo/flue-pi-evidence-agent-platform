import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path';

const root = process.cwd();
const triggers = new Set([
  'task-completion',
  'error-recovery',
  'user-correction',
]);

const [command, ...args] = process.argv.slice(2);
const options = parseArgs(args);

if (command === 'observe') observe();
else if (command === 'decide') decide();
else if (command === 'apply') applyDecision();
else usage();

function observe() {
  const trigger = required('trigger');
  const task = safeTaskId(required('task'));
  if (!triggers.has(trigger)) throw new Error(`unknown trigger: ${trigger}`);

  const runDir = path('.orchestration/autoskill/inputs', task);
  const manifestPath = path(
    '.orchestration/autoskill/inputs',
    `${task}.manifest.json`,
  );
  mkdirSync(runDir, { recursive: true });

  const sourcesByGroup = evidenceSourcesByGroup(task);
  const missingGroups = Object.entries(sourcesByGroup)
    .filter(([, files]) => files.length === 0)
    .map(([group]) => group);
  if (missingGroups.length > 0) {
    throw new Error(
      `missing evidence for ${task}: ${missingGroups.join(', ')}`,
    );
  }
  const sources = Object.values(sourcesByGroup).flat().sort();
  const inputs = [];
  const conversations = [];
  for (const source of sources) {
    const original = readFileSync(source, 'utf8');
    const result = redact(original);
    const redacted = String(result.redacted_text ?? '');
    const output = join(runDir, relative(root, source));
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, redacted, 'utf8');
    conversations.push({
      messages: [
        {
          role: 'user',
          content: `Source: ${relative(root, source)}\n\n${redacted}`,
        },
      ],
      metadata: { source_path: relative(root, source) },
    });
    inputs.push({
      source_path: relative(root, source),
      redacted_path: relative(root, output),
      sha256_before: sha256(original),
      sha256_after: sha256(redacted),
      entities_found: Number(result.entities_found ?? 0),
      redaction_passed: true,
    });
  }

  const datasetPath = join(runDir, 'openai_conversations.jsonl');
  writeFileSync(
    datasetPath,
    conversations.map((item) => `${JSON.stringify(item)}\n`).join(''),
    'utf8',
  );
  const manifest = {
    run_id: task,
    trigger,
    source_groups: ['reports', 'validation', 'acceptance'],
    openai_dataset_path: relative(root, datasetPath),
    inputs,
  };
  writeJson(manifestPath, manifest);
  console.log(
    `observed ${inputs.length} file(s); wrote ${relative(root, manifestPath)}`,
  );
}

function decide() {
  const task = safeTaskId(required('task'));
  const manifest = requireManifest(task);
  const skills = registrySkills();
  const evidenceText = manifest.inputs
    .map((item) => readFileSync(path(item.redacted_path), 'utf8'))
    .join('\n');
  const ranked = rankSkills(evidenceText, skills);
  const best = ranked[0];
  const recommendation =
    best?.score >= 4 ? 'patch' : best?.score >= 2 ? 'merge' : 'create';
  const rationale = best
    ? `highest overlap ${best.name} score=${best.score}`
    : 'no registry skills available for comparison';
  const log = {
    task,
    decision: recommendation,
    decided_by: 'scripts/skill-lifecycle.mjs',
    redaction_passed: manifest.inputs.every(
      (item) => item.redaction_passed === true,
    ),
    promotion_allowed: false,
    rationale,
    overlap: ranked.slice(0, 5).map(({ name, path: skillPath, score }) => ({
      name,
      path: skillPath,
      score,
    })),
  };
  const logPath = lifecycleLogPath(task);
  writeLifecycleLog(logPath, log);
  console.log(`${recommendation}: ${rationale}`);
  console.log(`wrote ${relative(root, logPath)}`);
}

function applyDecision() {
  const task = safeTaskId(required('task'));
  const decision = required('decision');
  const overwrite = Boolean(options.overwrite);
  if (!new Set(['create', 'patch', 'merge', 'discard']).has(decision)) {
    throw new Error(`unknown decision: ${decision}`);
  }
  const manifest = requireManifest(task);
  const logPath = lifecycleLogPath(task);
  const log = {
    task,
    decision,
    decided_by: 'scripts/skill-lifecycle.mjs',
    redaction_passed:
      manifest.inputs?.every((item) => item.redaction_passed === true) ?? false,
    promotion_allowed: false,
    rationale: `${decision} applied by explicit caller decision`,
  };
  writeLifecycleLog(logPath, log);

  let candidatePath = '';
  if (decision === 'create') {
    candidatePath = path(
      '.orchestration/skills/candidates',
      `${task}.SKILL.md`,
    );
    if (existsSync(candidatePath) && !overwrite) {
      throw new Error(`candidate already exists for ${task}; pass --overwrite`);
    }
    writeFileSync(candidatePath, candidateMarkdown(task), 'utf8');
  }
  appendTriageRow(task, decision, candidatePath || logPath);
  console.log(`applied ${decision}; promotion_allowed=false`);
  if (candidatePath) console.log(`wrote ${relative(root, candidatePath)}`);
}

function evidenceSources(task) {
  return Object.values(evidenceSourcesByGroup(task)).flat().sort();
}

function evidenceSourcesByGroup(task) {
  const groups = ['reports', 'validation', 'acceptance'];
  return Object.fromEntries(
    groups.map((group) => [
      group,
      listFiles(path('.orchestration', group))
        .filter((file) => basename(file).startsWith(task))
        .sort(),
    ]),
  );
}

function redact(text) {
  const child = spawnSync(
    '.venv/bin/python',
    ['scripts/data_guard.py', 'redact_text'],
    {
      cwd: root,
      input: JSON.stringify({ text }),
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  );
  if (child.status !== 0) {
    throw new Error(
      child.stderr?.trim() || `redaction failed with exit ${child.status ?? 1}`,
    );
  }
  return JSON.parse(child.stdout);
}

function registrySkills() {
  const base = path('.orchestration/skills');
  return ['candidates', 'promoted']
    .flatMap((state) => listFiles(join(base, state)))
    .filter(isSkillFile)
    .map((file) => {
      const text = readFileSync(file, 'utf8');
      const frontmatter = parseFrontmatter(text);
      return {
        path: relative(root, file),
        name: frontmatter.name ?? basename(file),
        description: frontmatter.description ?? '',
        haystack:
          `${frontmatter.name ?? ''} ${frontmatter.description ?? ''} ${text}`.toLowerCase(),
      };
    });
}

function rankSkills(text, skills) {
  const terms = [
    ...new Set(
      text.toLowerCase().match(/[a-z0-9_-]{4,}|[一-龯ぁ-んァ-ヶ]{2,}/g) ?? [],
    ),
  ];
  return skills
    .map((skill) => ({
      ...skill,
      score: terms.filter((term) => skill.haystack.includes(term)).length,
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.name.localeCompare(right.name),
    );
}

function isSkillFile(file) {
  const lower = basename(file).toLowerCase();
  return lower.endsWith('.skill.md') || lower.includes('skill');
}

function candidateMarkdown(task) {
  return `---\nname: ${task}\ndescription: Candidate generated by native skill lifecycle for ${task}.\nversion: \"0.1.0\"\nprovenance:\n  source: \"native skill lifecycle\"\n  task: \"${task}\"\n  generated_by: \"scripts/skill-lifecycle.mjs\"\n  promotion_allowed: false\n---\n\n# ${task}\n\n## Purpose\n\nCapture reusable guidance observed from ${task}.\n\n## Activation Hint\n\nUse when a similar task repeats and an orchestrator asks for this candidate.\n\n## Steps\n\n1. Read the task evidence and acceptance record.\n2. Follow the allowed-file and forbidden-action constraints.\n3. Report validation evidence before requesting promotion.\n\n## Validation\n\nRun repository gates relevant to the task before promotion review.\n\n## Pitfalls\n\n- Do not treat this candidate as promoted.\n- Do not include secrets or raw credentials.\n\n## Non-goals\n\n- No Hermes Agents runtime.\n- No automated promotion.\n\n## Rollback\n\nDelete this candidate or move it to rejected/merged by orchestrator decision.\n`;
}

function appendTriageRow(task, decision, artifactPath) {
  const triagePath = path('.orchestration/skills/TRIAGE.md');
  const triage = readFileSync(triagePath, 'utf8');
  if (triage.includes(`### ${task} lifecycle recommendation`)) {
    throw new Error(
      `triage already has a lifecycle recommendation for ${task}`,
    );
  }
  const row = `\n### ${task} lifecycle recommendation\n\n\`\`\`yaml\ncandidate: ${relative(root, artifactPath)}\nsummary: Native skill lifecycle ${decision} recommendation for ${task}.\noverlap: Deterministic registry comparison; see .orchestration/autoskill/runs/${task}.lifecycle.md\nrecommendation: ${decision === 'discard' ? 'rejected' : decision === 'create' ? 'validated' : decision === 'patch' ? 'improve' : 'merge_required'}\nrationale: Generated by scripts/skill-lifecycle.mjs; promotion_allowed=false and final authority stays with the orchestrator.\ndecision_owner: orchestrator\n\`\`\`\n`;
  writeFileSync(triagePath, `${triage.trimEnd()}\n${row}`, 'utf8');
}

function writeLifecycleLog(logPath, log) {
  const lines = [
    `# Skill lifecycle run: ${log.task}`,
    '',
    `decision: ${log.decision}`,
    `decided_by: ${log.decided_by}`,
    `redaction_passed: ${log.redaction_passed}`,
    `promotion_allowed: ${log.promotion_allowed}`,
    '',
    `rationale: ${log.rationale}`,
    '',
  ];
  if (log.overlap) {
    lines.push(
      '## Overlap',
      '',
      ...log.overlap.map(
        (item) => `- ${item.name}: score=${item.score} (${item.path})`,
      ),
      '',
    );
  }
  mkdirSync(dirname(logPath), { recursive: true });
  writeFileSync(logPath, `${lines.join('\n')}\n`, 'utf8');
}

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return {};
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return {};
  const out = {};
  for (const line of text.slice(4, end).split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*"?([^"]*)"?\s*$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function lifecycleLogPath(task) {
  return path('.orchestration/autoskill/runs', `${task}.lifecycle.md`);
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(file);
    return statSync(file).isFile() ? [file] : [];
  });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function requireManifest(task) {
  const manifestPath = path(
    '.orchestration/autoskill/inputs',
    `${task}.manifest.json`,
  );
  if (!existsSync(manifestPath)) {
    throw new Error(`manifest not found for ${task}`);
  }
  const manifest = readJson(manifestPath);
  if (!Array.isArray(manifest.inputs) || manifest.inputs.length === 0) {
    throw new Error(`manifest has no inputs for ${task}`);
  }
  const inputRoot = path('.orchestration/autoskill/inputs', task);
  for (const item of manifest.inputs) {
    if (typeof item.redacted_path !== 'string') {
      throw new Error(`manifest input missing redacted_path for ${task}`);
    }
    const redactedPath = path(item.redacted_path);
    if (!isWithin(inputRoot, redactedPath)) {
      throw new Error(
        `redacted_path escapes input directory: ${item.redacted_path}`,
      );
    }
    if (!existsSync(redactedPath)) {
      throw new Error(`redacted input missing: ${item.redacted_path}`);
    }
  }
  return manifest;
}

function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

function path(...parts) {
  return join(root, ...parts);
}

function parseArgs(values) {
  const out = {};
  for (let index = 0; index < values.length; index += 1) {
    if (!values[index].startsWith('--')) continue;
    const next = values[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[values[index].slice(2)] = next;
      index += 1;
    } else {
      out[values[index].slice(2)] = true;
    }
  }
  return out;
}

function required(name) {
  if (!options[name]) throw new Error(`--${name} is required`);
  return options[name];
}

function safeTaskId(task) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(task)) {
    throw new Error(`invalid task id: ${task}`);
  }
  if (task === '.' || task === '..')
    throw new Error(`invalid task id: ${task}`);
  return task;
}

function isWithin(parent, child) {
  const rel = relative(resolve(parent), resolve(child));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function usage() {
  throw new Error('usage: skill-lifecycle.mjs observe|decide|apply ...');
}
