import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const query = option('query');
const full = option('full');

if (full) {
  const skill = skills().find(
    (item) => item.name === full || basename(item.path) === full,
  );
  if (!skill) throw new Error(`skill not found: ${full}`);
  console.log(skill.body.trim());
} else {
  if (!query)
    throw new Error(
      'usage: skill-activate.mjs --query "<task text>" [--full <name>]',
    );
  for (const skill of rank(query, skills()).slice(0, 5)) {
    console.log(`${skill.name}\t${skill.description}\t${skill.path}`);
  }
}

function skills() {
  return listFiles(join(root, '.orchestration/skills/promoted'))
    .filter(isSkillFile)
    .map((file) => {
      const text = readFileSync(file, 'utf8');
      const frontmatter = parseFrontmatter(text);
      return {
        path: relative(root, file),
        name: frontmatter.name ?? basename(file),
        description: frontmatter.description ?? '',
        body: body(text),
        haystack:
          `${frontmatter.name ?? ''} ${frontmatter.description ?? ''} ${text}`.toLowerCase(),
      };
    });
}

function isSkillFile(file) {
  const lower = basename(file).toLowerCase();
  return lower.endsWith('.skill.md') || lower.includes('skill');
}

function rank(text, items) {
  const terms = [
    ...new Set(
      text.toLowerCase().match(/[a-z0-9_-]{4,}|[一-龯ぁ-んァ-ヶ]{2,}/g) ?? [],
    ),
  ];
  return items
    .map((item) => ({
      ...item,
      score: terms.filter((term) => item.haystack.includes(term)).length,
    }))
    .sort(
      (left, right) =>
        right.score - left.score || left.name.localeCompare(right.name),
    );
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

function body(text) {
  if (!text.startsWith('---\n')) return text;
  const end = text.indexOf('\n---\n', 4);
  return end === -1 ? text : text.slice(end + 5);
}

function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(file);
    return statSync(file).isFile() ? [file] : [];
  });
}

function option(name) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}
