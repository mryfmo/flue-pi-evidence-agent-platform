import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const repo = resolve(new URL('../..', import.meta.url).pathname);
const lifecycle = join(repo, 'scripts/skill-lifecycle.mjs');
const activate = join(repo, 'scripts/skill-activate.mjs');

test('observe decide and apply create produce lifecycle artifacts', () => {
  const root = fixtureRoot();
  try {
    writeFixtureEvidence(root, 'T1');
    writePromotedSkill(root);

    run(lifecycle, ['observe', '--trigger', 'task-completion', '--task', 'T1'], root);
    const manifest = JSON.parse(
      readFileSync(join(root, '.orchestration/autoskill/inputs/T1.manifest.json'), 'utf8'),
    );
    assert.equal(manifest.run_id, 'T1');
    assert.equal(manifest.inputs.length, 3);
    assert.equal(manifest.inputs.every((item) => item.redaction_passed), true);

    run(lifecycle, ['decide', '--task', 'T1'], root);
    const decisionLog = readFileSync(join(root, '.orchestration/autoskill/runs/T1.lifecycle.md'), 'utf8');
    assert.match(decisionLog, /promotion_allowed: false/);

    run(lifecycle, ['apply', '--task', 'T1', '--decision', 'create'], root);
    const candidate = readFileSync(join(root, '.orchestration/skills/candidates/T1.SKILL.md'), 'utf8');
    assert.match(candidate, /promotion_allowed: false/);
    const triage = readFileSync(join(root, '.orchestration/skills/TRIAGE.md'), 'utf8');
    assert.match(triage, /T1 lifecycle recommendation/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects unsafe task ids before writing artifacts', () => {
  for (const task of ['../x', 'x/y', '', 'T'.repeat(81)]) {
    const root = fixtureRoot();
    try {
      assert.throws(
        () => run(lifecycle, ['observe', '--trigger', 'task-completion', '--task', task], root),
        /invalid task id|--task is required/,
      );
      assert.equal(existsSync(join(root, '.orchestration/autoskill/inputs', task)), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('observe requires reports validation and acceptance evidence', () => {
  const root = fixtureRoot();
  try {
    assert.throws(
      () => run(lifecycle, ['observe', '--trigger', 'task-completion', '--task', 'T2'], root),
      /missing evidence for T2: reports, validation, acceptance/,
    );
    writeFixtureEvidence(root, 'T2', ['reports', 'validation']);
    assert.throws(
      () => run(lifecycle, ['observe', '--trigger', 'task-completion', '--task', 'T2'], root),
      /missing evidence for T2: acceptance/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('decide and apply require a valid manifest with redacted inputs', () => {
  const root = fixtureRoot();
  try {
    assert.throws(() => run(lifecycle, ['decide', '--task', 'T3'], root), /manifest not found/);
    assert.throws(
      () => run(lifecycle, ['apply', '--task', 'T3', '--decision', 'discard'], root),
      /manifest not found/,
    );

    mkdirSync(join(root, '.orchestration/autoskill/inputs'), { recursive: true });
    writeFileSync(
      join(root, '.orchestration/autoskill/inputs/T3.manifest.json'),
      JSON.stringify({ inputs: [] }),
    );
    assert.throws(() => run(lifecycle, ['decide', '--task', 'T3'], root), /manifest has no inputs/);

    writeFileSync(
      join(root, '.orchestration/autoskill/inputs/T3.manifest.json'),
      JSON.stringify({ inputs: [{ redacted_path: '../escape.md' }] }),
    );
    assert.throws(
      () => run(lifecycle, ['decide', '--task', 'T3'], root),
      /redacted_path escapes input directory/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('apply create rejects duplicate candidates and triage rows', () => {
  const root = fixtureRoot();
  try {
    writeFixtureEvidence(root, 'T4');
    writePromotedSkill(root);
    run(lifecycle, ['observe', '--trigger', 'task-completion', '--task', 'T4'], root);
    run(lifecycle, ['apply', '--task', 'T4', '--decision', 'create'], root);

    assert.throws(
      () => run(lifecycle, ['apply', '--task', 'T4', '--decision', 'create'], root),
      /candidate already exists/,
    );
    assert.throws(
      () => run(lifecycle, ['apply', '--task', 'T4', '--decision', 'create', '--overwrite'], root),
      /triage already has a lifecycle recommendation/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('skill activate ranks and prints promoted skill bodies', () => {
  const root = fixtureRoot();
  try {
    writePromotedSkill(root);
    const ranked = run(activate, ['--query', 'AGMSG task allowed files'], root);
    assert.match(ranked, /agmsg-task-protocol/);

    const full = run(activate, ['--query', 'unused', '--full', 'agmsg-task-protocol'], root);
    assert.match(full, /Use AGMSG task constraints/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixtureRoot() {
  const root = mkdtempSync(join(tmpdir(), 'skill-lifecycle-'));
  mkdirSync(join(root, '.venv/bin'), { recursive: true });
  writeFileSync(
    join(root, '.venv/bin/python'),
    `#!/usr/bin/env node
let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const payload = JSON.parse(input || '{}');
  const text = String(payload.text || '').replace(/alice@example\\.com/g, '<EMAIL_ADDRESS>');
  process.stdout.write(JSON.stringify({ redacted_text: text, entities_found: text.includes('<EMAIL_ADDRESS>') ? 1 : 0 }));
});
`,
    { mode: 0o755 },
  );
  mkdirSync(join(root, '.orchestration/skills/candidates'), { recursive: true });
  mkdirSync(join(root, '.orchestration/skills/promoted'), { recursive: true });
  writeFileSync(
    join(root, '.orchestration/skills/TRIAGE.md'),
    '# Skill Candidate Triage\n\n## Record Format\n',
  );
  return root;
}

function writeFixtureEvidence(root, task, dirs = ['reports', 'validation', 'acceptance']) {
  for (const dir of dirs) {
    mkdirSync(join(root, '.orchestration', dir), { recursive: true });
    writeFileSync(
      join(root, '.orchestration', dir, `${task}.${dir}.md`),
      `# ${task} ${dir}\n\nAGMSG task used allowed files. Contact alice@example.com.\n`,
    );
  }
}

function writePromotedSkill(root) {
  const dir = join(root, '.orchestration/skills/promoted/agmsg-task-protocol');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'SKILL.md'),
    `---
name: agmsg-task-protocol
description: Use AGMSG task constraints and allowed files.
version: "0.1.0"
provenance:
  source: fixture
---

# AGMSG task protocol

Use AGMSG task constraints and allowed files.
`,
  );
}

function run(script, args, cwd) {
  return execFileSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
  });
}
