import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error Production validation is an executable ESM script.
import * as validationManifest from '../../scripts/validation-manifest.mjs';

const {
  GATES,
  canonicalJson,
  collectSourceIdentity,
  createGateRecord,
  createValidationReport,
  digest,
  writeGateRecord,
  writeReleaseFileManifest,
  writeValidationReport,
} = validationManifest;

const repo = resolve('.');
const checker = join(repo, 'scripts/spec-check.mjs');
const roots: string[] = [];
const contract = JSON.parse(
  readFileSync(
    join(repo, '.orchestration/plan/revisions/A2-01-R2-contract.json'),
    'utf8',
  ),
) as {
  allowedCatalogChanges: Record<string, { text: string; severity: null }>;
  markdownProjectionOnly: string[];
};
const baseline = JSON.parse(
  readFileSync(
    join(repo, '.orchestration/plan/revisions/A2-01-R1-baseline.json'),
    'utf8',
  ),
) as {
  requirements: Array<{ id: string; text: string; severity: null }>;
};
const affectedIds = [
  ...Object.keys(contract.allowedCatalogChanges),
  ...contract.markdownProjectionOnly,
];
const unchangedIds = baseline.requirements
  .map(({ id }) => id)
  .filter((id) => !affectedIds.includes(id));

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'a2-spec-check-'));
  roots.push(root);
  cpSync(join(repo, 'docs'), join(root, 'docs'), { recursive: true });
  for (const name of ['A2-01-R1-baseline.json', 'A2-01-R2-contract.json']) {
    const target = join(root, '.orchestration/plan/revisions', name);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(repo, '.orchestration/plan/revisions', name), target);
  }
  const catalog = JSON.parse(
    readFileSync(join(repo, 'docs/requirements.json'), 'utf8'),
  ) as {
    requirements: Array<{
      implementation: string[];
      tests: string[];
      gates: Array<{ path: string }>;
      evidence: Array<{ path: string }>;
    }>;
  };
  const paths = new Set(
    catalog.requirements.flatMap((item) => [
      ...item.implementation,
      ...item.tests,
      ...item.gates.map((gate) => gate.path),
      ...item.evidence.map((record) => record.path),
    ]),
  );
  for (const path of paths) {
    const source = join(repo, path);
    if (!existsSync(source)) continue;
    const target = join(root, path);
    if (existsSync(target)) continue;
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(source, target);
  }
  return root;
}

function git(root: string, args: string[]) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function canonicalEvidenceFixture() {
  const root = fixture();
  const validator = join(root, 'scripts/validate-release.mjs');
  mkdirSync(dirname(validator), { recursive: true });
  copyFileSync(join(repo, 'scripts/validate-release.mjs'), validator);
  writeFileSync(join(root, '.gitignore'), 'artifacts/\n');
  writeReleaseFileManifest(root);
  git(root, ['init', '-q']);
  git(root, ['config', 'user.name', 'A2 Test']);
  git(root, ['config', 'user.email', 'a2@example.invalid']);
  git(root, ['add', '.']);
  git(root, ['commit', '-qm', 'canonical fixture']);
  writePassingEvidence(root);
  return root;
}

function writePassingEvidence(root: string) {
  const identity = collectSourceIdentity(root);
  const runId = randomUUID();
  const results = GATES.map(
    (
      gate: {
        name: string;
        executable: string;
        args: readonly string[];
        stdoutArtifact?: string;
      },
      sequence: number,
    ) => {
      const stdoutPath = join(
        root,
        `artifacts/validation/${gate.name}.stdout.log`,
      );
      const stderrPath = join(
        root,
        `artifacts/validation/${gate.name}.stderr.log`,
      );
      mkdirSync(dirname(stdoutPath), { recursive: true });
      writeFileSync(
        stdoutPath,
        gate.name === 'vitest_all' ? '13 passed\n' : '',
      );
      writeFileSync(stderrPath, '');
      const artifactDigests: Record<string, string> = {};
      if (gate.stdoutArtifact) {
        const path = join(root, gate.stdoutArtifact);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, `${gate.name}\n`);
        artifactDigests[gate.stdoutArtifact] = digest(readFileSync(path));
      }
      const result = {
        name: gate.name,
        executable: gate.executable,
        args: [...gate.args],
        status: 'passed',
        returnCode: 0,
        durationMs: 1,
      };
      const record = createGateRecord({
        gate,
        result,
        identity,
        runId,
        sequence,
        stdoutDigest: digest(readFileSync(stdoutPath)),
        stderrDigest: digest(readFileSync(stderrPath)),
        artifactDigests,
      });
      return { ...result, recordDigest: writeGateRecord(record, root) };
    },
  );
  writeValidationReport(
    createValidationReport({ status: 'passed', results, identity, runId }),
    root,
  );
}

function rewriteReport(root: string, mutate: (report: any) => void) {
  const path = join(
    root,
    'artifacts/validation/final_verification_report.json',
  );
  const report = JSON.parse(readFileSync(path, 'utf8'));
  mutate(report);
  const { evidenceDigest: _ignored, ...core } = report;
  report.evidenceDigest = digest(canonicalJson(core));
  writeFileSync(path, `${canonicalJson(report)}\n`);
}

function rewriteRecord(
  root: string,
  gate: string,
  mutate: (record: any) => void,
) {
  const path = join(root, `artifacts/validation/${gate}.record.json`);
  const record = JSON.parse(readFileSync(path, 'utf8'));
  mutate(record);
  const bytes = `${canonicalJson(record)}\n`;
  writeFileSync(path, bytes);
  rewriteReport(root, (report) => {
    const result = report.results.find(
      (item: { name: string }) => item.name === gate,
    );
    result.recordDigest = digest(bytes);
  });
}

function run(root: string, args = ['--check-id-bijection']) {
  return spawnSync(process.execPath, [checker, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
}

function json(root: string, name: 'requirements.json' | 'traceability.json') {
  return JSON.parse(readFileSync(join(root, 'docs', name), 'utf8'));
}

function writeJson(root: string, name: string, value: unknown) {
  writeFileSync(
    join(root, 'docs', name),
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

function reject(root: string, pattern: RegExp, args?: string[]) {
  const result = run(root, args);
  expect(result.status).not.toBe(0);
  expect(result.stderr).toMatch(pattern);
}

function addNormativeProductText(root: string, text: string) {
  const path = join(root, 'docs/PRODUCT_REQUIREMENTS.md');
  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace(
      '## Non-normative current design inventory',
      `${text}\n\n## Non-normative current design inventory`,
    ),
  );
}

function addNonNormativeProductText(root: string, text: string) {
  const path = join(root, 'docs/PRODUCT_REQUIREMENTS.md');
  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace(
      '## Non-normative current design inventory',
      `## Non-normative current design inventory\n\n${text}`,
    ),
  );
}

function catalogItem(root: string, id: string) {
  const catalog = json(root, 'requirements.json');
  const item = catalog.requirements.find(
    (candidate: { id: string }) => candidate.id === id,
  );
  if (!item) throw new Error(`missing fixture requirement ${id}`);
  return { catalog, item };
}

function replaceProjection(
  root: string,
  id: string,
  oldText: string,
  newText: string,
) {
  const { item } = catalogItem(root, id);
  const path = join(root, item.source.path);
  const source = readFileSync(path, 'utf8');
  const candidates: Array<[string, string]> = [
    [`## ${id}\n${oldText}`, `## ${id}\n${newText}`],
    [`- ${id}: ${oldText}`, `- ${id}: ${newText}`],
    [`| ${id} | ${oldText} |`, `| ${id} | ${newText} |`],
  ];
  const match = candidates.find(([before]) => source.includes(before));
  if (!match) throw new Error(`missing Markdown projection ${id}`);
  const [before, after] = match;
  if (source.split(before).length !== 2)
    throw new Error(`ambiguous Markdown projection ${id}`);
  const changed = source.replace(before, after);
  if (changed === source)
    throw new Error(`unchanged Markdown projection ${id}`);
  writeFileSync(path, changed);
}

function lockstepTextChange(root: string, id: string, newText: string) {
  const { catalog, item } = catalogItem(root, id);
  replaceProjection(root, id, item.text, newText);
  item.text = newText;
  writeJson(root, 'requirements.json', catalog);
}

describe('authoritative requirement catalog CLI', () => {
  it('accepts the clean catalog and ignores fenced and non-normative IDs', () => {
    const clean = fixture();
    expect(run(clean).status).toBe(0);

    const evidence = canonicalEvidenceFixture();
    expect(run(evidence, ['--check-evidence-links']).status).toBe(0);

    const fenced = fixture();
    addNormativeProductText(
      fenced,
      '\`\`\`text\n- PR-999: example only\n\`\`\`',
    );
    expect(run(fenced).status).toBe(0);
  });

  it('rejects filename-only evidence that lacks a canonical A1 report', () => {
    const root = fixture();
    const catalog = json(root, 'requirements.json');
    for (const path of new Set(
      catalog.requirements.flatMap((item: any) =>
        item.evidence.map((record: { path: string }) => record.path),
      ),
    )) {
      const target = join(root, path as string);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, '');
    }
    reject(root, /final_verification_report|final_report/, [
      '--check-evidence-links',
    ]);

    const structural = fixture();
    rmSync(join(structural, 'artifacts'), { recursive: true, force: true });
    expect(run(structural).status).toBe(0);
    expect(run(structural, ['--check-id-bijection']).status).toBe(0);
  });

  it('rejects Markdown-only, catalog-only, and trace-only IDs', () => {
    const markdownOnly = fixture();
    addNormativeProductText(
      markdownOnly,
      '- PR-999: orphan Markdown requirement.',
    );
    reject(markdownOnly, /Markdown-only requirement PR-999/);

    const catalogOnly = fixture();
    const catalog = json(catalogOnly, 'requirements.json');
    catalog.requirements.push({
      ...catalog.requirements[0],
      id: 'PR-999',
      text: 'orphan catalog requirement',
    });
    const catalogTrace = json(catalogOnly, 'traceability.json');
    catalogTrace.links.push({ requirement: 'PR-999' });
    writeJson(catalogOnly, 'requirements.json', catalog);
    writeJson(catalogOnly, 'traceability.json', catalogTrace);
    reject(catalogOnly, /catalog-only requirement PR-999/);

    const traceOnly = fixture();
    const trace = json(traceOnly, 'traceability.json');
    trace.links.push({ requirement: 'PR-999' });
    writeJson(traceOnly, 'traceability.json', trace);
    reject(traceOnly, /traceability-only requirement PR-999/);
  });

  it('rejects raw duplicates and duplicates hidden by array normalization', () => {
    const markdown = fixture();
    addNormativeProductText(markdown, '- PR-001: duplicate.');
    reject(markdown, /duplicate Markdown requirement: PR-001/);

    for (const source of ['requirements.json', 'traceability.json'] as const) {
      const root = fixture();
      const value = json(root, source);
      const rows =
        source === 'requirements.json' ? value.requirements : value.links;
      rows.push(rows[0]);
      writeJson(root, source, value);
      reject(root, /duplicate (?:catalog|trace) requirement/);
    }

    const normalized = fixture();
    const catalog = json(normalized, 'requirements.json');
    catalog.requirements[0].implementation.push(
      catalog.requirements[0].implementation[0],
    );
    writeJson(normalized, 'requirements.json', catalog);
    reject(normalized, /duplicate hidden by normalization/);
  });

  it('rejects malformed IDs, unknown keys, drift, and mixed or equals modes', () => {
    const malformed = fixture();
    addNormativeProductText(malformed, '- PR-1: malformed.');
    reject(malformed, /malformed normative id: PR-1/);

    const unknown = fixture();
    const catalog = json(unknown, 'requirements.json');
    catalog.requirements[0].surprise = true;
    writeJson(unknown, 'requirements.json', catalog);
    reject(unknown, /unknown or missing keys/);

    const drift = fixture();
    writeFileSync(
      join(drift, 'docs/TRACEABILITY_MATRIX.md'),
      `${readFileSync(join(drift, 'docs/TRACEABILITY_MATRIX.md'), 'utf8')}drift\n`,
    );
    reject(drift, /traceability matrix drift/);

    reject(fixture(), /mutually exclusive/, [
      '--check-id-bijection',
      '--check-evidence-links',
    ]);
    reject(fixture(), /unknown arguments/, ['--check-id-bijection=true']);
    reject(fixture(), /unknown arguments/, ['--check-id-bijection', 'extra']);
  });

  it('rejects missing, extra, incorrect-kind, traversal, absolute, and symlink paths', () => {
    const cases: Array<[string, (root: string, item: any) => void, RegExp]> = [
      [
        'missing',
        (_root, item) => (item.implementation[0] = 'src/missing.ts'),
        /does not exist/,
      ],
      [
        'missing-test',
        (_root, item) => (item.tests[0] = 'tests/missing.ts'),
        /does not exist/,
      ],
      [
        'implementation-kind',
        (_root, item) => (item.implementation[0] = item.tests[0]),
        /incorrect implementation path kind/,
      ],
      [
        'test-kind',
        (_root, item) => (item.tests[0] = item.implementation[0]),
        /incorrect test path kind/,
      ],
      [
        'directory',
        (_root, item) => (item.implementation[0] = 'src'),
        /not a regular file/,
      ],
      [
        'gate-path',
        (_root, item) => (item.gates[0].path = 'scripts/spec-check.mjs'),
        /gate path does not define the named gate/,
      ],
      [
        'traversal',
        (_root, item) => (item.implementation[0] = '../escape.ts'),
        /canonical repository-relative path/,
      ],
      [
        'absolute',
        (_root, item) => (item.implementation[0] = '/tmp/escape.ts'),
        /canonical repository-relative path/,
      ],
      [
        'symlink',
        (root, item) => {
          symlinkSync('app.ts', join(root, 'src/link.ts'));
          item.implementation[0] = 'src/link.ts';
        },
        /symlink ambiguity/,
      ],
    ];
    for (const [, mutate, pattern] of cases) {
      const root = fixture();
      const catalog = json(root, 'requirements.json');
      mutate(root, catalog.requirements[0]);
      writeJson(root, 'requirements.json', catalog);
      reject(root, pattern);
    }
  });

  it('rejects placeholder, planned, wildcard, directory, and ungenerated evidence', () => {
    for (const [path, pattern] of [
      ['artifacts/validation/placeholder.log', /planned or placeholder/],
      ['artifacts/validation/planned.log', /planned or placeholder/],
      ['artifacts/validation/*.log', /wildcard/],
      ['artifacts/validation', /not a regular file/],
    ] as const) {
      const root = fixture();
      const catalog = json(root, 'requirements.json');
      catalog.requirements[0].evidence[0].path = path;
      writeJson(root, 'requirements.json', catalog);
      reject(root, pattern);
    }

    const generator = fixture();
    const catalog = json(generator, 'requirements.json');
    catalog.requirements[0].gates[0].name = 'future_gate';
    writeJson(generator, 'requirements.json', catalog);
    reject(generator, /nonexistent evidence generator/);
  });

  it('rejects every unsupported normative block start and keeps scoped controls ignored', () => {
    for (const text of [
      '* PR-001: hidden duplicate.',
      '+ PR-001: hidden duplicate.',
      '1. PR-999: unsupported unknown requirement.',
      '> PR-999: unsupported blockquote requirement.',
      'PR-999: unsupported paragraph requirement.',
      '## PR-999: unsupported heading requirement.',
    ]) {
      const root = fixture();
      addNormativeProductText(root, text);
      reject(root, /unsupported normative structure/);
    }

    const fenced = fixture();
    addNormativeProductText(
      fenced,
      '```text\n* PR-001: fenced duplicate.\n```',
    );
    expect(run(fenced).status).toBe(0);

    const nonNormative = fixture();
    addNonNormativeProductText(
      nonNormative,
      '> PR-999: non-normative example.',
    );
    expect(run(nonNormative).status).toBe(0);
  });

  it('accepts canonical post-run evidence including authentic empty streams', () => {
    const root = canonicalEvidenceFixture();
    expect(
      readFileSync(
        join(root, 'artifacts/validation/setup_python.stdout.log'),
        'utf8',
      ),
    ).toBe('');
    expect(
      readFileSync(
        join(root, 'artifacts/validation/setup_python.stderr.log'),
        'utf8',
      ),
    ).toBe('');
    expect(run(root, ['--check-evidence-links']).status).toBe(0);
  });

  it('rejects canonical evidence log and execution-record tampering', () => {
    const cases: Array<[string, (root: string) => void, RegExp]> = [
      [
        'normally-nonempty-stdout-to-empty',
        (root) =>
          writeFileSync(
            join(root, 'artifacts/validation/vitest_all.stdout.log'),
            '',
          ),
        /stdout log digest mismatch/,
      ],
      [
        'stdout-byte',
        (root) =>
          writeFileSync(
            join(root, 'artifacts/validation/setup_python.stdout.log'),
            'x',
          ),
        /stdout log digest mismatch/,
      ],
      [
        'stderr-byte',
        (root) =>
          writeFileSync(
            join(root, 'artifacts/validation/setup_python.stderr.log'),
            'x',
          ),
        /stderr log digest mismatch/,
      ],
      [
        'missing-record',
        (root) =>
          rmSync(join(root, 'artifacts/validation/setup_python.record.json')),
        /execution record missing/,
      ],
      [
        'failed-record',
        (root) => {
          rewriteRecord(root, 'setup_python', (record) => {
            record.status = 'failed';
            record.returnCode = 1;
          });
          rewriteReport(root, (report) => {
            report.results[0].status = 'failed';
            report.results[0].returnCode = 1;
          });
        },
        /incomplete gate/,
      ],
      [
        'wrong-run',
        (root) =>
          rewriteRecord(root, 'setup_python', (record) => {
            record.runId = randomUUID();
          }),
        /execution record mismatch/,
      ],
      [
        'wrong-source',
        (root) =>
          rewriteRecord(root, 'setup_python', (record) => {
            record.sourceTreeDigest = '0'.repeat(64);
          }),
        /execution record mismatch/,
      ],
      [
        'wrong-gate-manifest',
        (root) =>
          rewriteRecord(root, 'setup_python', (record) => {
            record.gateManifestDigest = '0'.repeat(64);
          }),
        /execution record mismatch/,
      ],
    ];
    for (const [, mutate, pattern] of cases) {
      const root = canonicalEvidenceFixture();
      mutate(root);
      reject(root, pattern, ['--check-evidence-links']);
    }
  });

  it('rejects partial, reordered, duplicate, stale, and dirty reports', () => {
    const cases: Array<[string, (root: string) => void, RegExp]> = [
      [
        'partial',
        (root) => rewriteReport(root, (report) => report.results.pop()),
        /gate set size mismatch/,
      ],
      [
        'reordered',
        (root) =>
          rewriteReport(root, (report) =>
            report.results.splice(0, 2, report.results[1], report.results[0]),
          ),
        /gate order or command mismatch/,
      ],
      [
        'duplicate',
        (root) =>
          rewriteReport(root, (report) => {
            report.results[1] = report.results[0];
          }),
        /duplicate gate|gate order or command mismatch/,
      ],
      [
        'stale-revision',
        (root) =>
          rewriteReport(root, (report) => {
            report.source.revision = '0'.repeat(40);
          }),
        /source revision mismatch|execution record mismatch/,
      ],
      [
        'stale-tree',
        (root) =>
          rewriteReport(root, (report) => {
            report.source.treeDigest = '0'.repeat(64);
          }),
        /source treeDigest mismatch|execution record mismatch/,
      ],
      [
        'dirty-source',
        (root) => {
          mkdirSync(join(root, 'src'), { recursive: true });
          writeFileSync(join(root, 'src/dirty.ts'), 'export {};\n');
        },
        /dirty state rejected|release_file_manifest: extra path/,
      ],
    ];
    for (const [, mutate, pattern] of cases) {
      const root = canonicalEvidenceFixture();
      mutate(root);
      reject(root, pattern, ['--check-evidence-links']);
    }
  });

  it('rejects one-byte Markdown drift for every R2-affected projection', () => {
    expect(affectedIds).toHaveLength(15);
    for (const id of affectedIds) {
      const root = fixture();
      const { item } = catalogItem(root, id);
      replaceProjection(root, id, item.text, `${item.text}!`);
      reject(root, new RegExp(`requirement ${id} text does not exactly match`));
    }
  });

  it('rejects rollback of either allowed change even when Markdown and JSON agree', () => {
    for (const id of Object.keys(contract.allowedCatalogChanges)) {
      const root = fixture();
      const oldText = baseline.requirements.find(
        (item) => item.id === id,
      )?.text;
      if (!oldText) throw new Error(`missing baseline tuple ${id}`);
      lockstepTextChange(root, id, oldText);
      reject(root, /catalog differs from the authorized A2-01-R2 post-state/);
    }
  });

  it('rejects lockstep Markdown and JSON mutation for every other tuple', () => {
    expect(unchangedIds).toHaveLength(57);
    for (const id of unchangedIds) {
      const root = fixture();
      const { item } = catalogItem(root, id);
      lockstepTextChange(root, id, `${item.text}!`);
      reject(root, /catalog differs from the authorized A2-01-R2 post-state/);
    }
  });

  it('rejects a three-way addition and ID or severity drift', () => {
    const addition = fixture();
    addNormativeProductText(addition, '- PR-999: Unauthorized addition.');
    const addedCatalog = json(addition, 'requirements.json');
    addedCatalog.requirements.push({
      ...addedCatalog.requirements[0],
      id: 'PR-999',
      text: 'Unauthorized addition.',
      source: { path: 'docs/PRODUCT_REQUIREMENTS.md' },
    });
    const addedTrace = json(addition, 'traceability.json');
    addedTrace.links.push({ requirement: 'PR-999' });
    writeJson(addition, 'requirements.json', addedCatalog);
    writeJson(addition, 'traceability.json', addedTrace);
    reject(addition, /catalog differs from the authorized A2-01-R2 post-state/);

    const idDrift = fixture();
    const idCatalog = json(idDrift, 'requirements.json');
    idCatalog.requirements[0].id = 'PR-999';
    writeJson(idDrift, 'requirements.json', idCatalog);
    reject(idDrift, /(?:Markdown|catalog)-only requirement/);

    const severityDrift = fixture();
    const severityCatalog = json(severityDrift, 'requirements.json');
    severityCatalog.requirements[0].severity = 'high';
    writeJson(severityDrift, 'requirements.json', severityCatalog);
    reject(severityDrift, /invents an undocumented severity/);
  });

  it('rejects baseline, contract, baseline-digest, and post-digest tampering', () => {
    const cases = [
      {
        name: 'baseline-file',
        file: 'A2-01-R1-baseline.json',
        mutate: (text: string) => text.replace('FR-002', 'FR-099'),
        pattern: /baseline file digest mismatch/,
      },
      {
        name: 'contract-file',
        file: 'A2-01-R2-contract.json',
        mutate: (text: string) => text.replace('FR-001', 'FR-099'),
        pattern: /revision contract digest mismatch/,
      },
      {
        name: 'baseline-digest',
        file: 'A2-01-R1-baseline.json',
        mutate: (text: string) =>
          text.replace(
            'sha256:920779c8d43363a82401f0750de9d0a543934eedbed7276e971183b763a27f9a',
            'sha256:020779c8d43363a82401f0750de9d0a543934eedbed7276e971183b763a27f9a',
          ),
        pattern: /baseline file digest mismatch/,
      },
      {
        name: 'post-digest',
        file: 'A2-01-R2-contract.json',
        mutate: (text: string) =>
          text.replace(
            'sha256:5ee6afb60940ebd8eff1ffb85c4a01f3653d7e0bdbfc051ba0d23caba92c7b91',
            'sha256:0ee6afb60940ebd8eff1ffb85c4a01f3653d7e0bdbfc051ba0d23caba92c7b91',
          ),
        pattern: /revision contract digest mismatch/,
      },
    ];
    for (const { file, mutate, pattern } of cases) {
      const root = fixture();
      const path = join(root, '.orchestration/plan/revisions', file);
      writeFileSync(path, mutate(readFileSync(path, 'utf8')));
      reject(root, pattern);
    }
  });

  it('rejects every structural mutation of the two-paragraph HTTP requirement', () => {
    const id = 'REQ-HTTP-REQUEST-001';
    const change = contract.allowedCatalogChanges[id];
    if (!change) throw new Error(`missing R2 contract change ${id}`);
    const text = change.text;
    const [first, second] = text.split('\n\n');
    if (!first || !second)
      throw new Error('invalid R2 HTTP paragraph contract');
    const mutations = [
      first,
      `${second}\n\n${first}`,
      `${first} ${second}`,
      `${first}\n\n${second}\n\nThird normative paragraph.`,
      `${first}\n\n### Orphaning subheading\n\n${second}`,
    ];
    for (const replacement of mutations) {
      const root = fixture();
      replaceProjection(root, id, text, replacement);
      reject(
        root,
        /(?:text does not exactly match|non-paragraph block|contains a subheading|catalog-only requirement)/,
      );
    }
  });

  it('has exactly two catalog deltas and no unauthorized baseline text delta', () => {
    const current = JSON.parse(
      readFileSync(join(repo, 'docs/requirements.json'), 'utf8'),
    ) as { requirements: Array<{ id: string; text: string; severity: null }> };
    const currentById = new Map(
      current.requirements.map((item) => [item.id, item]),
    );
    const deltas = baseline.requirements
      .filter((item) => {
        const now = currentById.get(item.id);
        return now?.text !== item.text || now?.severity !== item.severity;
      })
      .map(({ id }) => id)
      .sort();
    expect(deltas).toEqual(['FR-001', 'REQ-HTTP-REQUEST-001']);
    expect(run(fixture()).status).toBe(0);
  });
});
