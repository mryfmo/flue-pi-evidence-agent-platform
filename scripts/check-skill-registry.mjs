import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const root = '.orchestration/skills';
const forbidden = [
  'personality:',
  'toolsets:',
  'plugins:',
  'messaging:',
  'mixture_of_agents:',
];

if (!existsSync(root)) {
  console.log('skill-registry:ok registry_absent=true checked=0');
  process.exit(0);
}

const files = walk(root);
const violations = [];
const skillFiles = files.filter(shouldCheckSchema);

for (const file of files) {
  const rel = relative(root, file);
  const content = readFileSync(file, 'utf8');
  if (basename(file) === 'SOUL.md') {
    violations.push(`${rel}: forbidden Hermes runtime artifact SOUL.md`);
  }
  for (const marker of forbidden) {
    if (content.includes(marker)) {
      violations.push(`${rel}: forbidden Hermes runtime marker ${marker}`);
    }
  }
}

for (const file of skillFiles) {
  const rel = relative(root, file);
  const frontmatter = parseFrontmatter(readFileSync(file, 'utf8'));
  if (!frontmatter) {
    violations.push(`${rel}: missing YAML frontmatter`);
    continue;
  }
  if (!frontmatter.has('name')) {
    violations.push(`${rel}: missing frontmatter name`);
  }
  if (!frontmatter.has('description') && !frontmatter.has('version')) {
    violations.push(`${rel}: missing frontmatter description or version`);
  }
  if (rel.startsWith('promoted/')) {
    if (!frontmatter.has('version')) {
      violations.push(`${rel}: promoted skill missing version`);
    }
    if (!frontmatter.has('provenance')) {
      violations.push(`${rel}: promoted skill missing provenance`);
    }
  }
}

if (violations.length > 0) {
  console.error('skill-registry:failed');
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}

console.log(
  `skill-registry:ok checked=${skillFiles.length} files=${files.length}`,
);

function shouldCheckSchema(file) {
  const rel = relative(root, file);
  if (!(rel.startsWith('candidates/') || rel.startsWith('promoted/'))) {
    return false;
  }
  const lower = basename(file).toLowerCase();
  return lower.endsWith('.skill.md') || lower.includes('skill');
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) return undefined;
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) return undefined;
  const keys = new Set();
  for (const line of markdown.slice(4, end).split('\n')) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):/);
    if (match) keys.add(match[1]);
  }
  return keys;
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const entry = statSync(path);
    if (entry.isDirectory()) out.push(...walk(path));
    if (entry.isFile()) out.push(path);
  }
  return out;
}
