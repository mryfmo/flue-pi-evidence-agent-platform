import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const script = join(repo, 'scripts/spec-check.mjs');
const fullRange = 'SPEC-01..SPEC-20';

function run(args, cwd = repo) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'spec-register-'));
  for (const name of readdirSync(repo)) {
    if (name !== 'docs' && name !== '.git')
      symlinkSync(join(repo, name), join(root, name));
  }
  mkdirSync(join(root, 'docs'));
  for (const name of readdirSync(join(repo, 'docs'))) {
    const target = join(root, 'docs', name);
    if (
      name === 'requirements.json' ||
      name === 'traceability.json' ||
      name === 'PRODUCTION_GATEWAY_DESIGN.md'
    )
      copyFileSync(join(repo, 'docs', name), target);
    else symlinkSync(join(repo, 'docs', name), target);
  }
  return root;
}

function mutate(root, name, change) {
  const path = join(root, 'docs', name);
  const value = JSON.parse(readFileSync(path, 'utf8'));
  change(value);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function rejects(args, pattern, cwd = repo) {
  const result = run(args, cwd);
  assert.notEqual(result.status, 0, `unexpected success: ${args.join(' ')}`);
  assert.match(result.stderr, pattern);
}

test('accepts separated and equals full-register forms', () => {
  for (const args of [
    ['--check-spec-register', fullRange],
    [`--check-spec-register=${fullRange}`],
  ]) {
    const result = run(args);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /spec-check:passed/);
  }
});

test('rejects invalid register ranges and arguments', () => {
  const cases = [
    [['--check-spec-register'], /missing spec register range/],
    [['--check-spec-register', 'SPEC-01'], /malformed spec register range/],
    [
      ['--check-spec-register', 'SPEC-X..SPEC-20'],
      /malformed spec register endpoint/,
    ],
    [
      ['--check-spec-register', 'SPEC-20..SPEC-01'],
      /reversed spec register range/,
    ],
    [
      ['--check-spec-register', 'SPEC-1..SPEC-20'],
      /noncanonical spec register padding/,
    ],
    [
      ['--check-spec-register', 'SPEC-00..SPEC-20'],
      /out of register/,
    ],
    [
      ['--check-spec-register', 'SPEC-01..SPEC-21'],
      /out of register/,
    ],
    [
      ['--check-spec-register', 'SPEC-01..REQ-20'],
      /mixed spec register prefixes/,
    ],
    [
      ['--check-spec-register', fullRange, 'trailing'],
      /unknown arguments/,
    ],
    [['--unknown'], /unknown arguments/],
    [
      ['--check-spec-register', fullRange, '--check-spec', 'SPEC-01'],
      /mutually exclusive/,
    ],
  ];
  for (const [args, pattern] of cases) rejects(args, pattern);
});

test('rejects duplicate and missing requirement records', () => {
  for (const [change, pattern] of [
    [
      (value) =>
        value.requirements.push(
          value.requirements.find(({ id }) => id === 'SPEC-10'),
        ),
      /requirement SPEC-10 must occur exactly once/,
    ],
    [
      (value) => {
        value.requirements = value.requirements.filter(
          ({ id }) => id !== 'SPEC-10',
        );
      },
      /requirement SPEC-10 must occur exactly once/,
    ],
  ]) {
    const root = fixture();
    try {
      mutate(root, 'requirements.json', change);
      rejects(['--check-spec-register', fullRange], pattern, root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('rejects duplicate and missing trace links', () => {
  for (const [change, pattern] of [
    [
      (value) =>
        value.links.push(
          value.links.find(({ requirement }) => requirement === 'SPEC-10'),
        ),
      /trace link SPEC-10 must occur exactly once/,
    ],
    [
      (value) => {
        value.links = value.links.filter(
          ({ requirement }) => requirement !== 'SPEC-10',
        );
      },
      /trace link SPEC-10 must occur exactly once/,
    ],
  ]) {
    const root = fixture();
    try {
      mutate(root, 'traceability.json', change);
      rejects(['--check-spec-register', fullRange], pattern, root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('rejects extra and malformed SPEC-like register records', () => {
  for (const [id, pattern] of [
    ['SPEC-21', /extra spec register requirement: SPEC-21/],
    ['SPEC-1', /malformed spec register requirement id/],
  ]) {
    const root = fixture();
    try {
      mutate(root, 'requirements.json', (value) => {
        value.requirements.push({ id, text: 'invalid register fixture' });
      });
      rejects(['--check-spec-register', fullRange], pattern, root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('rejects extra and malformed SPEC-like trace records', () => {
  for (const [id, pattern] of [
    ['SPEC-21', /extra spec register trace link: SPEC-21/],
    ['SPEC-1', /malformed spec register trace link id/],
  ]) {
    const root = fixture();
    try {
      mutate(root, 'traceability.json', (value) => {
        value.links.push({ requirement: id, implementation: [], tests: [] });
      });
      rejects(['--check-spec-register', fullRange], pattern, root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test('full register runs per-SPEC semantic validators', () => {
  const root = fixture();
  try {
    const path = join(root, 'docs', 'PRODUCTION_GATEWAY_DESIGN.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        'production_fallback_prohibited',
        'stale_fallback_contract',
      ),
    );
    rejects(
      ['--check-spec-register', fullRange],
      /SPEC-05 marker missing from normative documents/,
      root,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
