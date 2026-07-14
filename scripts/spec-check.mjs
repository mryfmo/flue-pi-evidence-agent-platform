import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from 'node:fs';
import { dirname, isAbsolute, posix, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';
import { parse } from 'yaml';
import { opaBinary } from '../src/lib/opa.ts';
import { GATES, verifyValidationReport } from './validation-manifest.mjs';

function requestedChecks(argv) {
  const args = [...argv];
  const requestSchemaIndex = args.indexOf('--check-request-schema');
  let requestSchema;
  if (requestSchemaIndex !== -1) {
    requestSchema = args[requestSchemaIndex + 1];
    if (!requestSchema || requestSchema.startsWith('--'))
      throw new Error('missing request schema path');
    args.splice(requestSchemaIndex, 2);
  }
  if (args.length === 0)
    return {
      specs: [],
      decision: undefined,
      requestSchema,
      specRegister: undefined,
      catalogCheck: true,
      evidenceCheck: false,
    };
  const primaryModeCount = args.filter((arg) =>
    [
      '--check-spec',
      '--check-decision',
      '--check-spec-register',
      '--check-id-bijection',
      '--check-evidence-links',
    ].some((flag) => arg === flag || arg.startsWith(`${flag}=`)),
  ).length;
  if (primaryModeCount > 1)
    throw new Error('check modes are mutually exclusive');
  let value;
  if (args.length === 2 && args[0] === '--check-spec') {
    value = args[1];
  } else if (args.length === 1 && args[0].startsWith('--check-spec=')) {
    value = args[0].slice('--check-spec='.length);
  } else if (args.length === 2 && args[0] === '--check-decision') {
    if (!args[1]) throw new Error('missing decision path');
    return { specs: [], decision: args[1], requestSchema };
  } else if (args.length === 1 && args[0].startsWith('--check-decision=')) {
    const decision = args[0].slice('--check-decision='.length);
    if (!decision) throw new Error('missing decision path');
    return { specs: [], decision, requestSchema, specRegister: undefined };
  } else if (args.length === 2 && args[0] === '--check-spec-register') {
    const specRegister = parseSpecRegister(args[1]);
    return {
      specs: specRegister,
      decision: undefined,
      requestSchema,
      specRegister,
    };
  } else if (
    args.length === 1 &&
    args[0].startsWith('--check-spec-register=')
  ) {
    const specRegister = parseSpecRegister(
      args[0].slice('--check-spec-register='.length),
    );
    return {
      specs: specRegister,
      decision: undefined,
      requestSchema,
      specRegister,
    };
  } else if (args.length === 1 && args[0] === '--check-spec-register') {
    throw new Error('missing spec register range');
  } else if (
    args.length === 1 &&
    ['--check-id-bijection', '--check-evidence-links'].includes(args[0])
  ) {
    return {
      specs: [],
      decision: undefined,
      requestSchema,
      specRegister: undefined,
      catalogCheck: true,
      evidenceCheck: args[0] === '--check-evidence-links',
    };
  } else {
    throw new Error(`unknown arguments: ${args.join(' ')}`);
  }
  const specs = value.split(',');
  if (specs.some((id) => id.length === 0)) throw new Error('missing spec id');
  return {
    specs,
    decision: undefined,
    requestSchema,
    specRegister: undefined,
    catalogCheck: false,
    evidenceCheck: false,
  };
}

function parseSpecRegister(value) {
  if (!value) throw new Error('missing spec register range');
  const match = /^([^.]+)\.\.([^.]+)$/.exec(value);
  if (!match) throw new Error('malformed spec register range');
  const endpoints = match.slice(1).map((endpoint) => {
    const parsed = /^([A-Za-z]+)-(\d+)$/.exec(endpoint);
    if (!parsed) throw new Error('malformed spec register endpoint');
    return { prefix: parsed[1], digits: parsed[2], value: Number(parsed[2]) };
  });
  if (endpoints[0].prefix !== endpoints[1].prefix)
    throw new Error('mixed spec register prefixes');
  if (endpoints[0].prefix !== 'SPEC')
    throw new Error('invalid spec register prefix');
  if (endpoints.some(({ digits }) => digits.length !== 2))
    throw new Error('noncanonical spec register padding');
  if (endpoints.some(({ value: number }) => number < 1 || number > 20))
    throw new Error('spec register endpoint is out of register');
  if (endpoints[0].value > endpoints[1].value)
    throw new Error('reversed spec register range');
  return Array.from(
    { length: endpoints[1].value - endpoints[0].value + 1 },
    (_, index) => `SPEC-${String(endpoints[0].value + index).padStart(2, '0')}`,
  );
}

const {
  specs,
  decision,
  requestSchema,
  specRegister,
  catalogCheck,
  evidenceCheck,
} = requestedChecks(process.argv.slice(2));

if (decision) {
  if (!existsSync(decision)) throw new Error(`missing decision: ${decision}`);
  const actual = parse(readFileSync(decision, 'utf8'));
  const expectedDecisions = {
    'SPEC-05': {
      spec_id: 'SPEC-05',
      status: 'accepted',
      accepted_by: 'user',
      accepted_at: '2026-07-11T17:00:00+09:00',
      canonical_rule: 'production_fallback_prohibited',
      synthetic_evidence_status: 'explicitly_marked_non_evidence',
      runtime_contract: {
        exhausted_chain_result: 'ok:false, reason=llm_unavailable',
        workflow_outcome: 'typed_failure_no_summary',
        production_local_gateway_reachable: false,
        synthetic_output_scope: 'local_validation_only',
      },
      superseded_locations: [
        {
          path: 'docs/PRODUCTION_GATEWAY_DESIGN.md',
          locator: 'fallback chain and deterministic-fallback success passages',
        },
        {
          path: 'policy/routing.prod.json',
          locator: 'production local_gateway provider declaration',
        },
        {
          path: 'src/lib/productionGateway.ts',
          locator: 'production deterministic-fallback success branch',
        },
      ],
    },
    'SPEC-20': {
      spec_id: 'SPEC-20',
      status: 'accepted',
      accepted_by: 'user',
      accepted_at: '2026-07-11T17:00:00+09:00',
      requirement_abstraction: 'capability_level',
      conformance_evidence: 'machine_verifiable_capability_tests',
      superseded_locations: [
        {
          path: 'docs/SPECIFICATION.md',
          requirement_id: 'REQ-PI-001',
          locator: 'deterministic local gateway as normative mechanism',
        },
        {
          path: 'docs/SPECIFICATION.md',
          requirement_id: 'REQ-DATA-001',
          locator: 'SQLGlot, DuckDB, and Presidio as normative tool identities',
        },
      ],
      tool_inventory_disposition: 'non_normative_design_record',
    },
  };
  const expected = expectedDecisions[actual.spec_id];
  if (!expected)
    throw new Error(`unsupported decision spec: ${actual.spec_id}`);
  if (!isDeepStrictEqual(actual, expected)) {
    throw new Error(
      `decision does not exactly match the accepted ${actual.spec_id} contract`,
    );
  }
}

const markdownSources = [
  'docs/SPECIFICATION.md',
  'docs/PRODUCT_REQUIREMENTS.md',
  'docs/FUNCTIONAL_REQUIREMENTS.md',
  'docs/NON_FUNCTIONAL_REQUIREMENTS.md',
];
const canonicalId =
  /^(?:PR-\d{3}|FR-\d{3}|NFR-\d{3}|SPEC-\d{2}|REQ-(?:[A-Z][A-Z0-9]*-)+\d{3})$/;
const idCandidate = /^(?:PR|FR|NFR|SPEC|REQ)-[A-Z0-9-]+$/;
const revisionContractPath =
  '.orchestration/plan/revisions/A2-01-R2-contract.json';
const revisionContractDigest =
  'sha256:e607e6984e59666253f141a0ec5806932f2a72178aebc146fce15eff2b29e239';
const revisionBaselineDigest =
  'sha256:3480e8f8b5b8d0b65b193df52c1589b3a201fb307f4a18b4a46f1afd64f33392';
const revisionBaselineTupleDigest =
  'sha256:920779c8d43363a82401f0750de9d0a543934eedbed7276e971183b763a27f9a';
const revisionPostDigest =
  'sha256:5abe1e78c1bd19b274285f1e1be2cc8c9ce5cafff471e20e34572ee34f4c556b';

function closedObject(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (!isDeepStrictEqual(actual, expected))
    throw new Error(`${label} has unknown or missing keys`);
}

function headingRequirement(lines, index, id) {
  let end = index + 1;
  while (end < lines.length && !/^#{1,6} /.test(lines[end])) end += 1;
  if (end < lines.length && /^#{3,6} /.test(lines[end]))
    throw new Error(`normative heading ${id} contains a subheading`);
  const body = lines.slice(index + 1, end);
  if (body.at(-1) === '\n') body.pop();
  if (body.length === 0 || body[0] === '\n' || body.at(-1) === '\n')
    throw new Error(`normative heading ${id} has invalid paragraph structure`);
  const paragraphs = [];
  let paragraph = [];
  for (const line of body) {
    if (line === '\n') {
      if (paragraph.length === 0)
        throw new Error(
          `normative heading ${id} has invalid paragraph structure`,
        );
      paragraphs.push(paragraph.join('').replace(/\n$/, ''));
      paragraph = [];
      continue;
    }
    if (
      /^(?:#{1,6} | {0,3}(?:`{3,}|~{3,})|\s*(?:[-*+] |\d+[.)] |\||> )| {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$)/.test(
        line,
      )
    )
      throw new Error(`normative heading ${id} contains a non-paragraph block`);
    paragraph.push(line);
  }
  if (paragraph.length > 0)
    paragraphs.push(paragraph.join('').replace(/\n$/, ''));
  if (paragraphs.some((text) => text.length === 0))
    throw new Error(`normative heading ${id} has an empty paragraph`);
  return { text: paragraphs.join('\n\n'), end };
}

function markdownRequirements() {
  const records = [];
  for (const path of markdownSources) {
    const sections = [];
    let fence;
    const lines = readFileSync(path, 'utf8').match(/[^\n]*\n|[^\n]+$/g) ?? [];
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const lineText = line.replace(/\n$/, '');
      const fenceMatch = /^ {0,3}(`{3,}|~{3,})/.exec(lineText);
      if (fenceMatch) {
        if (!fence) fence = fenceMatch[1][0];
        else if (fence === fenceMatch[1][0]) fence = undefined;
        continue;
      }
      if (fence) continue;
      const heading = /^(#{1,6}) (.+)$/.exec(lineText);
      if (heading) {
        const level = heading[1].length;
        while (sections.at(-1)?.level >= level) sections.pop();
        sections.push({
          level,
          nonNormative:
            Boolean(sections.at(-1)?.nonNormative) ||
            /\bnon[- ]normative\b/i.test(heading[2]),
        });
      }
      if (sections.at(-1)?.nonNormative) continue;
      const headingId = heading?.[2];
      const bullet = /^- ((?:PR|FR|NFR|SPEC|REQ)-[A-Z0-9-]+): (.*)$/.exec(
        lineText,
      );
      const broadBullet = /^\s*-\s+((?:PR|FR|NFR|SPEC|REQ)-[A-Z0-9-]+):/.exec(
        lineText,
      );
      const table =
        /^\| ((?:PR|FR|NFR|SPEC|REQ)-[A-Z0-9-]+) \| ([^|]*) \|/.exec(lineText);
      const unsupportedHeading =
        /^#{1,6} ((?:PR|FR|NFR|SPEC|REQ)-[A-Z0-9-]+)(?::|$)/.exec(lineText);
      const unsupportedBlock =
        /^(?:(?:[*+] |\d+[.)] |> )?)((?:PR|FR|NFR|SPEC|REQ)-[A-Z0-9-]+):(?:\s|$)/.exec(
          lineText,
        );
      const unsupportedTable =
        /^\s*\|\s*((?:PR|FR|NFR|SPEC|REQ)-[A-Z0-9-]+)\s*\|/.exec(lineText);
      const candidate =
        headingId && idCandidate.test(headingId)
          ? headingId
          : (bullet?.[1] ??
            table?.[1] ??
            broadBullet?.[1] ??
            unsupportedHeading?.[1] ??
            unsupportedBlock?.[1] ??
            unsupportedTable?.[1]);
      if (!candidate) continue;
      if (!canonicalId.test(candidate))
        throw new Error(`malformed normative id: ${candidate}`);
      if (headingId === candidate) {
        const record = headingRequirement(lines, index, candidate);
        records.push({
          id: candidate,
          text: record.text,
          path,
          line: index + 1,
        });
        index = record.end - 1;
      } else if (bullet?.[1] === candidate) {
        records.push({ id: candidate, text: bullet[2], path, line: index + 1 });
      } else if (table?.[1] === candidate) {
        records.push({ id: candidate, text: table[2], path, line: index + 1 });
      } else {
        throw new Error(`unsupported normative structure for ${candidate}`);
      }
    }
  }
  const counts = new Map();
  for (const record of records)
    counts.set(record.id, (counts.get(record.id) ?? 0) + 1);
  for (const [id, count] of counts)
    if (count !== 1) throw new Error(`duplicate Markdown requirement: ${id}`);
  return records;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function tupleBytes(items) {
  const tuples = items
    .map(({ id, text, severity }) => ({ id, text, severity }))
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
    );
  return `${JSON.stringify(tuples)}\n`;
}

function loadRevisionContract() {
  const contractBytes = readFileSync(revisionContractPath);
  if (sha256(contractBytes) !== revisionContractDigest)
    throw new Error('A2-01-R2 revision contract digest mismatch');
  const contract = JSON.parse(contractBytes.toString('utf8'));
  closedObject(
    contract,
    [
      'schemaVersion',
      'baselineFile',
      'baselineFileDigest',
      'baselineTupleDigest',
      'expectedPostDigest',
      'allowedCatalogChanges',
      'markdownProjectionOnly',
    ],
    'A2-01-R2 revision contract',
  );
  if (
    contract.schemaVersion !== 1 ||
    contract.baselineFile !==
      '.orchestration/plan/revisions/A2-01-R1-baseline.json' ||
    contract.baselineFileDigest !== revisionBaselineDigest ||
    contract.baselineTupleDigest !== revisionBaselineTupleDigest ||
    contract.expectedPostDigest !== revisionPostDigest
  )
    throw new Error('A2-01-R2 revision contract values mismatch');
  const baselineBytes = readFileSync(contract.baselineFile);
  if (sha256(baselineBytes) !== revisionBaselineDigest)
    throw new Error('A2-01-R1 baseline file digest mismatch');
  const baseline = JSON.parse(baselineBytes.toString('utf8'));
  if (!Array.isArray(baseline.requirements))
    throw new Error('A2-01-R1 baseline requirements are invalid');
  for (const item of baseline.requirements) {
    closedObject(item, ['id', 'text', 'severity'], `baseline ${item?.id}`);
    if (!canonicalId.test(item.id) || typeof item.text !== 'string')
      throw new Error('A2-01-R1 baseline tuple is invalid');
  }
  if (
    new Set(baseline.requirements.map(({ id }) => id)).size !== 72 ||
    baseline.requirements.length !== 72 ||
    sha256(tupleBytes(baseline.requirements)) !== revisionBaselineTupleDigest
  )
    throw new Error('A2-01-R1 baseline tuple digest mismatch');
  return { contract, baseline: baseline.requirements };
}

function enforceRevisionContract(requirements) {
  const { contract, baseline } = loadRevisionContract();
  const allowedIds = Object.keys(contract.allowedCatalogChanges).sort();
  if (
    !isDeepStrictEqual(allowedIds, [
      'FR-001',
      'REQ-HTTP-REQUEST-001',
      'SPEC-01',
    ])
  )
    throw new Error('A2-01-R2 allowed catalog change set mismatch');
  if (
    !isDeepStrictEqual(contract.markdownProjectionOnly, [
      'PR-005',
      'PR-008',
      'REQ-DATA-001',
      'REQ-PI-001',
      'SPEC-04',
      'SPEC-05',
      'SPEC-06',
      'SPEC-07',
      'SPEC-09',
      'SPEC-12',
      'SPEC-15',
      'SPEC-16',
      'SPEC-20',
    ])
  )
    throw new Error('A2-01-R2 projection-only set mismatch');
  const post = baseline.map((item) => {
    const change = contract.allowedCatalogChanges[item.id];
    return change ? { id: item.id, ...change } : item;
  });
  if (sha256(tupleBytes(post)) !== revisionPostDigest)
    throw new Error('A2-01-R2 derived post tuple digest mismatch');
  if (sha256(tupleBytes(requirements)) !== revisionPostDigest)
    throw new Error('catalog differs from the authorized A2-01-R2 post-state');
  return post;
}

function checkedArray(value, label) {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error(`${label} must be a nonempty array`);
  if (value.some((item) => typeof item !== 'string' || item.length === 0))
    throw new Error(`${label} must contain nonempty strings`);
  if (new Set(value).size !== value.length)
    throw new Error(`${label} contains a duplicate hidden by normalization`);
  return value;
}

function checkedPath(path, label, expectedKind = 'file', mustExist = true) {
  if (
    typeof path !== 'string' ||
    path.length === 0 ||
    isAbsolute(path) ||
    path.includes('\\') ||
    path.includes('\0') ||
    posix.normalize(path) !== path ||
    path.split('/').some((part) => part === '' || part === '.' || part === '..')
  )
    throw new Error(`${label} is not a canonical repository-relative path`);
  if (/[*?[\]]/.test(path)) throw new Error(`${label} contains a wildcard`);
  if (/\b(?:planned|placeholder|todo|tbd)\b/i.test(path))
    throw new Error(`${label} is a planned or placeholder path`);
  if (!mustExist && !existsSync(path)) return;
  if (!existsSync(path)) throw new Error(`${label} does not exist: ${path}`);
  const stat = lstatSync(path);
  if (stat.isSymbolicLink())
    throw new Error(`${label} has traversal or symlink ambiguity: ${path}`);
  if (!stat.isFile())
    throw new Error(`${label} is not a regular file: ${path}`);
  const root = realpathSync('.');
  const actual = realpathSync(path);
  if (relative(root, actual).startsWith('..') || actual !== resolve(path))
    throw new Error(`${label} has traversal or symlink ambiguity: ${path}`);
  if (
    expectedKind === 'implementation' &&
    /^(?:tests(?:_py)?|policy\/tests|artifacts)\//.test(path)
  )
    throw new Error(`${label} has incorrect implementation path kind: ${path}`);
  if (
    expectedKind === 'test' &&
    !/^(?:tests(?:_py)?\/|policy\/(?:tests\/|[^/]+_test\.rego$)|scripts\/spec-check\.mjs$)/.test(
      path,
    )
  )
    throw new Error(`${label} has incorrect test path kind: ${path}`);
}

function renderMatrix(requirements) {
  const cell = (value) => value.replaceAll('|', '\\|');
  const paths = (values) =>
    values.map((path) => `\`${cell(path)}\``).join(', ');
  const rows = [...requirements]
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
    )
    .map(
      (item) =>
        `| ${item.id} | \`${item.source.path}\` | ${paths(item.implementation)} | ${paths(item.tests)} | ${item.gates.map((gate) => `\`${gate.name}\``).join(', ')} | ${paths(item.evidence.map((record) => record.path))} |`,
    );
  return [
    '# Traceability Matrix',
    '',
    '<!-- Generated from docs/requirements.json; do not edit by hand. -->',
    '',
    '| Requirement | Normative source | Implementation | Tests | Gates | Evidence |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

function validateCatalog(requirements, traceability) {
  closedObject(requirements, ['schemaVersion', 'requirements'], 'catalog');
  if (
    requirements.schemaVersion !== 1 ||
    !Array.isArray(requirements.requirements)
  )
    throw new Error('catalog schema is invalid');
  closedObject(traceability, ['schemaVersion', 'links'], 'traceability');
  if (traceability.schemaVersion !== 1 || !Array.isArray(traceability.links))
    throw new Error('traceability schema is invalid');

  const markdown = markdownRequirements();
  const catalogCounts = new Map();
  for (const item of requirements.requirements) {
    if (item && typeof item === 'object')
      catalogCounts.set(item.id, (catalogCounts.get(item.id) ?? 0) + 1);
  }
  for (const [id, count] of catalogCounts)
    if (count !== 1) throw new Error(`duplicate catalog requirement: ${id}`);
  const traceCounts = new Map();
  for (const link of traceability.links) {
    if (link && typeof link === 'object')
      traceCounts.set(
        link.requirement,
        (traceCounts.get(link.requirement) ?? 0) + 1,
      );
  }
  for (const [id, count] of traceCounts)
    if (count !== 1) throw new Error(`duplicate trace requirement: ${id}`);

  const gateManifest = new Map(GATES.map((gate) => [gate.name, gate]));
  for (const item of requirements.requirements) {
    closedObject(
      item,
      [
        'id',
        'text',
        'severity',
        'source',
        'implementation',
        'tests',
        'gates',
        'evidence',
      ],
      `requirement ${item?.id ?? '<unknown>'}`,
    );
    if (!canonicalId.test(item.id))
      throw new Error(`malformed catalog requirement id: ${item.id}`);
    if (typeof item.text !== 'string' || item.text.length === 0)
      throw new Error(`requirement ${item.id} has invalid text`);
    if (item.severity !== null)
      throw new Error(
        `requirement ${item.id} invents an undocumented severity`,
      );
    closedObject(item.source, ['path'], `requirement ${item.id} source`);
    if (!markdownSources.includes(item.source.path))
      throw new Error(`requirement ${item.id} has an unknown normative source`);
    checkedPath(item.source.path, `requirement ${item.id} source`);
    for (const [field, paths] of [
      [
        'implementation',
        checkedArray(item.implementation, `${item.id} implementation`),
      ],
      ['tests', checkedArray(item.tests, `${item.id} tests`)],
    ]) {
      for (const path of paths)
        checkedPath(
          path,
          `${item.id} ${field}`,
          field === 'tests' ? 'test' : 'implementation',
        );
    }
    if (!Array.isArray(item.gates) || item.gates.length === 0)
      throw new Error(`${item.id} gates must be a nonempty array`);
    const gateNames = [];
    for (const gate of item.gates) {
      closedObject(gate, ['name', 'path'], `${item.id} gate`);
      if (!gateManifest.has(gate.name))
        throw new Error(
          `${item.id} names a nonexistent evidence generator: ${gate.name}`,
        );
      if (gate.path !== 'scripts/validation-manifest.mjs')
        throw new Error(`${item.id} gate path does not define the named gate`);
      checkedPath(gate.path, `${item.id} gate`);
      gateNames.push(gate.name);
    }
    if (new Set(gateNames).size !== gateNames.length)
      throw new Error(`${item.id} gates contain a duplicate`);
    if (!Array.isArray(item.evidence) || item.evidence.length === 0)
      throw new Error(`${item.id} evidence must be a nonempty array`);
    const evidencePaths = [];
    for (const record of item.evidence) {
      closedObject(record, ['path', 'gate'], `${item.id} evidence`);
      if (!gateNames.includes(record.gate))
        throw new Error(`${item.id} evidence names an unlinked gate`);
      checkedPath(record.path, `${item.id} evidence`, 'file', evidenceCheck);
      if (record.path !== `artifacts/validation/${record.gate}.stdout.log`)
        throw new Error(
          `${item.id} evidence is not generated by its named gate`,
        );
      evidencePaths.push(record.path);
    }
    if (new Set(evidencePaths).size !== evidencePaths.length)
      throw new Error(`${item.id} evidence contains a duplicate`);
  }

  for (const link of traceability.links) {
    closedObject(
      link,
      ['requirement'],
      `trace link ${link?.requirement ?? '<unknown>'}`,
    );
    if (!canonicalId.test(link.requirement))
      throw new Error(`malformed trace requirement id: ${link.requirement}`);
  }
  const markdownIds = new Set(markdown.map((record) => record.id));
  const catalogIds = new Set(requirements.requirements.map((item) => item.id));
  const traceIds = new Set(traceability.links.map((link) => link.requirement));
  for (const [leftName, left, rightName, right] of [
    ['Markdown', markdownIds, 'catalog', catalogIds],
    ['catalog', catalogIds, 'Markdown', markdownIds],
    ['catalog', catalogIds, 'traceability', traceIds],
    ['traceability', traceIds, 'catalog', catalogIds],
  ]) {
    for (const id of left)
      if (!right.has(id))
        throw new Error(
          `${leftName}-only requirement ${id}; missing from ${rightName}`,
        );
  }
  for (const item of requirements.requirements) {
    const projection = markdown.find((record) => record.id === item.id);
    if (projection?.path !== item.source.path)
      throw new Error(
        `requirement ${item.id} source does not match Markdown inventory`,
      );
    if (projection.text !== item.text)
      throw new Error(
        `requirement ${item.id} text does not exactly match its Markdown projection`,
      );
  }
  const expectedPost = enforceRevisionContract(requirements.requirements);
  if (
    !isDeepStrictEqual(
      requirements.requirements
        .map(({ id, text, severity }) => ({ id, text, severity }))
        .sort((left, right) =>
          Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
        ),
      [...expectedPost].sort((left, right) =>
        Buffer.compare(Buffer.from(left.id), Buffer.from(right.id)),
      ),
    )
  )
    throw new Error(
      'catalog tuples do not exactly match the A2-01-R2 contract',
    );
  const expectedMatrix = renderMatrix(requirements.requirements);
  if (readFileSync('docs/TRACEABILITY_MATRIX.md', 'utf8') !== expectedMatrix)
    throw new Error('traceability matrix drift');
  if (evidenceCheck) verifyCatalogEvidence(requirements.requirements);
}

function verifyCatalogEvidence(requirements) {
  const report = verifyValidationReport(
    '.',
    'artifacts/validation/final_verification_report.json',
  );
  const passedGates = new Set(report.results.map(({ name }) => name));
  for (const item of requirements) {
    for (const evidence of item.evidence) {
      if (!passedGates.has(evidence.gate))
        throw new Error(
          `${item.id} evidence gate is absent from the verified report`,
        );
      const expected = `artifacts/validation/${evidence.gate}.stdout.log`;
      if (evidence.path !== expected || !existsSync(evidence.path))
        throw new Error(`${item.id} evidence is not a verified stdout log`);
    }
  }
}

const requiredDocs = [
  'docs/PRODUCT_REQUIREMENTS.md',
  'docs/FUNCTIONAL_REQUIREMENTS.md',
  'docs/NON_FUNCTIONAL_REQUIREMENTS.md',
  'docs/SYSTEM_ARCHITECTURE.md',
  'docs/AGENT_LOOP_SPEC.md',
  'docs/HYPOTHESIS_LEDGER_SPEC.md',
  'docs/EVIDENCE_GRAPH_SPEC.md',
  'docs/TOOL_REGISTRY_SPEC.md',
  'docs/POLICY_MODEL.md',
  'docs/DATA_GOVERNANCE.md',
  'docs/SECURITY_MODEL.md',
  'docs/THREAT_MODEL.md',
  'docs/ABUSE_CASES.md',
  'docs/DEPLOYMENT.md',
  'docs/OPERATIONS.md',
  'docs/RUNBOOK.md',
  'docs/FAILURE_MODE_MATRIX.md',
  'docs/VALIDATION_PLAN.md',
  'docs/TRACEABILITY_MATRIX.md',
  'docs/requirements.json',
  'docs/traceability.json',
];

for (const doc of requiredDocs) {
  if (!existsSync(doc)) throw new Error(`missing required doc: ${doc}`);
  const lines = readFileSync(doc, 'utf8').trim().split('\n').length;
  if (doc.endsWith('.md') && lines < 6) {
    throw new Error(`doc too thin: ${doc} has ${lines} lines`);
  }
}
const req = JSON.parse(readFileSync('docs/requirements.json', 'utf8'));
const trace = JSON.parse(readFileSync('docs/traceability.json', 'utf8'));
if (specRegister) {
  const countBy = (items, select) => {
    const counts = new Map();
    for (const item of items) {
      const id = select(item);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  };
  const requirementCounts = countBy(req.requirements, (item) => item.id);
  const traceCounts = countBy(trace.links, (link) => link.requirement);
  for (const id of specRegister) {
    if (requirementCounts.get(id) !== 1)
      throw new Error(
        `spec register requirement ${id} must occur exactly once`,
      );
    if (traceCounts.get(id) !== 1)
      throw new Error(`spec register trace link ${id} must occur exactly once`);
  }
  if (
    specRegister.length === 20 &&
    specRegister[0] === 'SPEC-01' &&
    specRegister[19] === 'SPEC-20'
  ) {
    const expected = new Set(specRegister);
    for (const [label, ids] of [
      ['requirement', req.requirements.map((item) => item.id)],
      ['trace link', trace.links.map((link) => link.requirement)],
    ]) {
      for (const id of ids.filter(
        (candidate) =>
          typeof candidate === 'string' && /^SPEC/i.test(candidate),
      )) {
        if (!/^SPEC-\d{2}$/.test(id))
          throw new Error(`malformed spec register ${label} id`);
        if (!expected.has(id))
          throw new Error(`extra spec register ${label}: ${id}`);
      }
    }
  }
}
if (catalogCheck) validateCatalog(req, trace);
const reqIds = new Set(req.requirements.map((item) => item.id));
for (const id of reqIds) {
  if (!trace.links.some((link) => link.requirement === id)) {
    throw new Error(`requirement ${id} has no traceability link`);
  }
}
for (const requirement of req.requirements) {
  for (const file of [
    ...(requirement.implementation ?? []),
    ...(requirement.tests ?? []),
  ]) {
    if (file.startsWith('artifacts/')) continue;
    if (!existsSync(file))
      throw new Error(`traceability file missing: ${file}`);
  }
}
for (const id of specs) {
  if (!id.startsWith('SPEC-')) throw new Error(`not a spec id: ${id}`);
  if (!reqIds.has(id)) throw new Error(`unknown spec: ${id}`);
  if (!trace.links.some((link) => link.requirement === id)) {
    throw new Error(`spec ${id} has no traceability link`);
  }
}

if (specs.includes('SPEC-05')) {
  const gateway = readFileSync('docs/PRODUCTION_GATEWAY_DESIGN.md', 'utf8');
  const boundary = readFileSync('docs/INTEGRATION_BOUNDARY.md', 'utf8');
  const product = readFileSync('docs/PRODUCT_REQUIREMENTS.md', 'utf8');
  const requiredMarkers = [
    'production_fallback_prohibited',
    'ok:false, reason=llm_unavailable',
    'typed_failure_no_summary',
    'explicitly_marked_non_evidence',
    'local_validation_only',
  ];
  for (const marker of requiredMarkers) {
    if (!gateway.includes(marker) || !boundary.includes(marker)) {
      throw new Error(
        `SPEC-05 marker missing from normative documents: ${marker}`,
      );
    }
  }
  if (
    !product.includes('SPEC-05') ||
    !product.includes('production_fallback_prohibited')
  ) {
    throw new Error('SPEC-05 product requirement is missing');
  }
  for (const superseded of [
    'fallback chain and deterministic-fallback success passages',
    'production local_gateway provider declaration',
    'production deterministic-fallback success branch',
  ]) {
    if (!gateway.includes(`SUPERSEDED by SPEC-05: ${superseded}`)) {
      throw new Error(`SPEC-05 supersession marker missing: ${superseded}`);
    }
  }
}

if (['SPEC-06', 'SPEC-07', 'SPEC-09'].some((id) => specs.includes(id))) {
  const schemaPath = 'schemas/remediation-closure.schema.json';
  const policyPath = 'policy/closure.rego';
  const schemaText = readFileSync(schemaPath, 'utf8');
  const policy = readFileSync(policyPath, 'utf8');
  const digestLine = /^# contract-digest: sha256:[0-9a-f]{64}\r?$/gm;
  const digestLines = policy.match(digestLine) ?? [];
  if (digestLines.length !== 1)
    throw new Error(
      'closure policy must contain exactly one contract digest line',
    );
  const canonicalPolicy = policy.replace(`${digestLines[0]}\n`, '');
  const digest = createHash('sha256')
    .update(JSON.stringify({ schema: schemaText, policy: canonicalPolicy }))
    .digest('hex');
  const marker = `sha256:${digest}`;
  for (const path of [
    'docs/SPECIFICATION.md',
    'docs/HYPOTHESIS_LEDGER_SPEC.md',
    'docs/EVIDENCE_GRAPH_SPEC.md',
  ]) {
    const document = readFileSync(path, 'utf8');
    for (const required of [
      schemaPath,
      'data.eap.closure.remediation_success',
      'data.eap.closure.closed',
      marker,
    ]) {
      if (!document.includes(required))
        throw new Error(`${path} missing closure binding: ${required}`);
    }
  }
  if (!policy.includes(`# contract-digest: ${marker}`)) {
    throw new Error(
      'closure policy is not bound to the current schema and policy digest',
    );
  }
  for (const required of [
    'remediation_success if',
    'closed if remediation_success',
  ]) {
    if (!policy.includes(required))
      throw new Error(`closure policy missing canonical rule: ${required}`);
  }

  const validate = new Ajv2020({ strict: true }).compile(
    JSON.parse(schemaText),
  );
  const positive = JSON.parse(
    readFileSync('tests/fixtures/policy/closure_clean.json', 'utf8'),
  );
  if (!validate(positive))
    throw new Error(
      `positive closure fixture violates schema: ${JSON.stringify(validate.errors)}`,
    );
  for (const path of [
    'tests/fixtures/policy/closure_clean_without_issue_proof.json',
    'tests/fixtures/policy/closure_missing_field.json',
    'tests/fixtures/policy/closure_missing_hypothesis_evidence.json',
    'tests/fixtures/policy/closure_missing_impact.json',
    'tests/fixtures/policy/closure_unknown_field.json',
    'tests/fixtures/policy/closure_wrong_type.json',
  ]) {
    if (validate(JSON.parse(readFileSync(path, 'utf8')))) {
      throw new Error(
        `malformed closure fixture unexpectedly satisfies schema: ${path}`,
      );
    }
  }
}

if (specs.includes('SPEC-08')) {
  const schema = JSON.parse(
    readFileSync('schemas/routing-policy.schema.json', 'utf8'),
  );
  const validate = new Ajv2020({ strict: true }).compile(schema);
  const policy = JSON.parse(readFileSync('policy/routing.prod.json', 'utf8'));
  if (!validate(policy)) {
    throw new Error(
      `production routing policy violates schema: ${JSON.stringify(validate.errors)}`,
    );
  }
  const validInput = JSON.parse(
    readFileSync(
      'tests/fixtures/policy/production_contract_routing_valid.json',
      'utf8',
    ),
  );
  if (!validate(validInput.policy))
    throw new Error('positive production routing fixture violates schema');
  const crossTenantInput = JSON.parse(
    readFileSync(
      'tests/fixtures/policy/production_contract_cross_tenant_invalid.json',
      'utf8',
    ),
  );
  if (!validate(crossTenantInput.policy)) {
    throw new Error('cross-tenant routing fixture must remain schema-valid');
  }
  const wrapped = JSON.parse(
    readFileSync(
      'tests/fixtures/policy/production_contract_wrapped_invalid.json',
      'utf8',
    ),
  );
  if (validate(wrapped.policy))
    throw new Error(
      'old wrapped production routing shape unexpectedly validates',
    );
  const providers = new Set(Object.keys(policy.providers));
  const targets = [
    ...policy.defaults.fallback_chain,
    ...policy.routes.flatMap((route) => [route, ...route.fallback_chain]),
  ];
  if (targets.some((target) => !providers.has(target.provider))) {
    throw new Error('production routing target references an unknown provider');
  }
  if (
    new Set(policy.routes.map((route) => route.id)).size !==
    policy.routes.length
  ) {
    throw new Error('production routing route ids must be unique');
  }
}

if (['SPEC-10', 'SPEC-11', 'SPEC-13'].some((id) => specs.includes(id))) {
  const ajv = new Ajv2020({ strict: true });
  const outcome = ajv.compile(
    JSON.parse(readFileSync('schemas/run-outcome.schema.json', 'utf8')),
  );
  const telemetry = ajv.compile(
    JSON.parse(readFileSync('schemas/telemetry-event.schema.json', 'utf8')),
  );
  const fixture = (name) =>
    JSON.parse(
      readFileSync(
        `tests/fixtures/policy/production_contract_${name}.json`,
        'utf8',
      ),
    );

  for (const name of [
    'outcome_passed_valid',
    'outcome_needs_review_valid',
    'outcome_audit_failure_valid',
    'outcome_telemetry_failure_valid',
    'outcome_sandbox_lifecycle_failure_valid',
    'outcome_sandbox_evidence_failure_valid',
  ]) {
    if (!outcome(fixture(name)))
      throw new Error(`valid run outcome rejected: ${name}`);
  }
  for (const name of [
    'outcome_missing_invalid',
    'outcome_unknown_invalid',
    'outcome_malformed_invalid',
    'outcome_failure_as_success_invalid',
  ]) {
    if (outcome(fixture(name)))
      throw new Error(`invalid run outcome accepted: ${name}`);
  }

  const correlatedTelemetry = (event) =>
    telemetry(event) &&
    event.audit.audit_id === event.span.audit_id &&
    event.audit.trace_id === event.span.trace_id;
  if (!correlatedTelemetry(fixture('telemetry_valid'))) {
    throw new Error('valid correlated telemetry event rejected');
  }
  for (const name of [
    'telemetry_missing_audit_id_invalid',
    'telemetry_missing_trace_id_invalid',
    'telemetry_mismatched_correlation_invalid',
    'telemetry_unknown_span_invalid',
  ]) {
    if (correlatedTelemetry(fixture(name)))
      throw new Error(`invalid telemetry event accepted: ${name}`);
  }

  const failures = new Map([
    ['outcome_audit_failure_valid', 'audit_sink_failure'],
    ['outcome_telemetry_failure_valid', 'telemetry_emission_failure'],
    ['outcome_sandbox_lifecycle_failure_valid', 'sandbox_lifecycle_failure'],
    ['outcome_sandbox_evidence_failure_valid', 'sandbox_evidence_failure'],
  ]);
  for (const [name, code] of failures) {
    const row = fixture(name);
    if (row.outcome !== 'failed' || row.failure.code !== code) {
      throw new Error(`failure row is not fail closed: ${code}`);
    }
  }

  const slo = readFileSync('docs/SLO.md', 'utf8');
  const failureMatrix = readFileSync('docs/FAILURE_MODE_MATRIX.md', 'utf8');
  for (const marker of ['gateway.call', 'audit_id', 'trace_id']) {
    if (!slo.includes(marker))
      throw new Error(`SLO missing telemetry contract marker: ${marker}`);
  }
  for (const code of failures.values()) {
    if (!failureMatrix.includes(code))
      throw new Error(`failure matrix missing typed outcome: ${code}`);
  }
}

if (['SPEC-12', 'SPEC-15', 'SPEC-16'].some((id) => specs.includes(id))) {
  const schemaAjv = new Ajv2020({
    strict: true,
    formats: { 'date-time': /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/ },
  });
  const identitySchema = JSON.parse(
    readFileSync('schemas/identity-context.schema.json', 'utf8'),
  );
  const acceptanceSchema = JSON.parse(
    readFileSync('schemas/acceptance.schema.json', 'utf8'),
  );
  const approvalSchema = JSON.parse(
    readFileSync('schemas/approval-state.schema.json', 'utf8'),
  );
  schemaAjv.addSchema(identitySchema);
  const validateAcceptance = schemaAjv.compile(acceptanceSchema);
  const validateApproval = schemaAjv.compile(approvalSchema);
  if (requestSchema) {
    if (!specs.includes('SPEC-15'))
      throw new Error('--check-request-schema requires SPEC-15');
    const remediationSchema = JSON.parse(readFileSync(requestSchema, 'utf8'));
    const validateRemediation = schemaAjv.compile(remediationSchema);
    const astral = '\u{1f680}';
    const accepted = [
      { version: 1, workspace: 'repo' },
      { version: 1, workspace: astral.repeat(4096), issue: '' },
      { version: 1, workspace: 'repo', issue: astral.repeat(8192) },
    ];
    const rejected = [
      null,
      [],
      {},
      { version: '1', workspace: 'repo' },
      { version: 2, workspace: 'repo' },
      { version: 1, workspace: '' },
      { version: 1, workspace: astral.repeat(4097) },
      { version: 1, workspace: 'repo', issue: astral.repeat(8193) },
      { version: 1, workspace: 'repo', user: 'forged' },
      { version: 1, workspace: '\ud800' },
    ];
    if (accepted.some((candidate) => !validateRemediation(candidate)))
      throw new Error('valid remediation request rejected by schema');
    if (rejected.some((candidate) => validateRemediation(candidate)))
      throw new Error('invalid remediation request accepted by schema');

    const remediationDocs = [
      readFileSync('docs/SPECIFICATION.md', 'utf8'),
      readFileSync('docs/ORCHESTRATOR_INTERFACE.md', 'utf8'),
    ].join('\n');
    for (const marker of [
      'POST /v1/remediations',
      'application/json',
      '65,536',
      'schemas/remediation-request.schema.json',
      'gateway/PEP-owned',
      '413 payload_too_large',
      '415 unsupported_media_type',
    ]) {
      if (!remediationDocs.includes(marker))
        throw new Error(`remediation request documentation missing: ${marker}`);
    }
  }
  const fixture = (name) =>
    JSON.parse(
      readFileSync(`tests/fixtures/policy/approval_${name}.json`, 'utf8'),
    );

  const lowRisk = fixture('acceptance_low_risk');
  if (!validateAcceptance(lowRisk) || lowRisk.acceptance_tier !== 'auto') {
    throw new Error(
      `complete low-risk record did not auto-accept: ${JSON.stringify(validateAcceptance.errors)}`,
    );
  }
  for (const name of [
    'acceptance_missing_risk',
    'acceptance_unknown_tier',
    'acceptance_contradictory_auto',
  ]) {
    if (validateAcceptance(fixture(name)))
      throw new Error(`invalid acceptance record accepted: ${name}`);
  }
  for (const key of Object.keys(lowRisk.risk_inputs)) {
    const riskInputs = { ...lowRisk.risk_inputs };
    delete riskInputs[key];
    if (validateAcceptance({ ...lowRisk, risk_inputs: riskInputs })) {
      throw new Error(`acceptance risk input is not required: ${key}`);
    }
  }
  for (const candidate of [
    { ...lowRisk, acceptance_tier: 'unknown' },
    { ...lowRisk, acceptance_tier: 1 },
    Object.fromEntries(
      Object.entries(lowRisk).filter(([key]) => key !== 'acceptance_tier'),
    ),
    {
      ...lowRisk,
      risk_inputs: { ...lowRisk.risk_inputs, all_evidence_green: 'yes' },
    },
    {
      ...lowRisk,
      risk_inputs: { ...lowRisk.risk_inputs, caller_override: true },
    },
  ]) {
    if (validateAcceptance(candidate))
      throw new Error('malformed or unknown acceptance input accepted');
  }
  for (const key of Object.keys(lowRisk.risk_inputs)) {
    const riskInputs = { ...lowRisk.risk_inputs, [key]: 'unknown' };
    if (validateAcceptance({ ...lowRisk, risk_inputs: riskInputs })) {
      throw new Error(`unknown acceptance risk input accepted: ${key}`);
    }
  }
  const reviewRisk = {
    ...lowRisk,
    acceptance_tier: 'review',
    risk_inputs: { ...lowRisk.risk_inputs, task_risk: 'high' },
  };
  if (!validateAcceptance(reviewRisk))
    throw new Error('valid review-tier record rejected');

  const approvedInput = fixture('approved_resume');
  const approved = approvedInput.approval;
  if (!validateApproval(approved)) {
    throw new Error(
      `approved record violates approval schema: ${JSON.stringify(validateApproval.errors)}`,
    );
  }
  for (const name of [
    'foreign_requester_resume',
    'precreation_decision_resume',
    'postexpiry_future_decision_resume',
    'incoherent_resume_time',
  ]) {
    if (!validateApproval(fixture(name).approval)) {
      throw new Error(
        `schema-valid approval regression fixture rejected: ${name}: ${JSON.stringify(validateApproval.errors)}`,
      );
    }
  }
  const pending = fixture('unapproved_resume').approval;
  if (!validateApproval(pending))
    throw new Error('pending record violates approval schema');
  const rejected = {
    ...approved,
    state: 'rejected',
    decision: { ...approved.decision, outcome: 'rejected' },
  };
  const expired = {
    ...approved,
    state: 'expired',
    decision: {
      outcome: 'expired',
      decided_at: approved.decision.decided_at,
      idempotency_key: 'expire-key',
      request_digest: approved.decision.request_digest,
    },
  };
  const resumed = {
    ...approved,
    state: 'resumed',
    resume: {
      status: 'resumed',
      resumed_at: '2026-07-13T12:00:00Z',
      idempotency_key: 'resume-key',
      request_digest: approvedInput.idempotency.request_digest,
    },
  };
  for (const [state, record] of Object.entries({
    pending,
    approved,
    rejected,
    expired,
    resumed,
  })) {
    if (!validateApproval(record)) {
      throw new Error(
        `${state} transition record violates approval schema: ${JSON.stringify(validateApproval.errors)}`,
      );
    }
  }
  for (const record of [
    { ...approved, state: 'approved', decision: null },
    { ...approved, state: 'resumed', resume: { status: 'not_resumed' } },
    { ...approved, state: 'rejected', decision: approved.decision },
  ]) {
    if (validateApproval(record))
      throw new Error('contradictory approval state accepted');
  }

  for (const path of [
    'docs/ORCHESTRATOR_INTERFACE.md',
    'docs/INTEGRATION_BOUNDARY.md',
  ]) {
    const document = readFileSync(path, 'utf8');
    if (!document.includes('schemas/acceptance.schema.json')) {
      throw new Error(
        `${path} does not reference the canonical acceptance schema`,
      );
    }
  }

  const documentCache = new Map();
  const loadDocument = (path) => {
    const absolute = resolve(path);
    if (!documentCache.has(absolute)) {
      const text = readFileSync(absolute, 'utf8');
      documentCache.set(
        absolute,
        absolute.endsWith('.json') ? JSON.parse(text) : parse(text),
      );
    }
    return documentCache.get(absolute);
  };
  const pointerValue = (document, fragment) => {
    if (!fragment || fragment === '#') return document;
    if (!fragment.startsWith('#/'))
      throw new Error(`unsupported reference fragment: ${fragment}`);
    return fragment
      .slice(2)
      .split('/')
      .map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'))
      .reduce((value, part) => value?.[part], document);
  };
  const resolveReference = (ref, sourcePath, sourceDocument) => {
    const hash = ref.indexOf('#');
    const filePart = hash === -1 ? ref : ref.slice(0, hash);
    const fragment = hash === -1 ? '' : ref.slice(hash);
    if (/^[a-z]+:/i.test(filePart))
      throw new Error(`remote OpenAPI reference is forbidden: ${ref}`);
    const targetPath = filePart
      ? resolve(dirname(sourcePath), filePart)
      : sourcePath;
    const targetDocument = filePart ? loadDocument(targetPath) : sourceDocument;
    const value = pointerValue(targetDocument, fragment);
    if (value === undefined)
      throw new Error(`unresolved OpenAPI reference: ${ref}`);
    return {
      value,
      targetPath,
      targetDocument,
      key: `${targetPath}${fragment}`,
    };
  };
  const checked = new Set();
  const walkReferences = (value, sourcePath, sourceDocument) => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') {
      const resolvedRef = resolveReference(
        value.$ref,
        sourcePath,
        sourceDocument,
      );
      if (!checked.has(resolvedRef.key)) {
        checked.add(resolvedRef.key);
        walkReferences(
          resolvedRef.value,
          resolvedRef.targetPath,
          resolvedRef.targetDocument,
        );
      }
    }
    for (const child of Object.values(value))
      walkReferences(child, sourcePath, sourceDocument);
  };
  const openapiPath = resolve('docs/openapi.yaml');
  const openapi = loadDocument(openapiPath);
  if (openapi.openapi !== '3.1.0')
    throw new Error('OpenAPI contract must use version 3.1.0');
  walkReferences(openapi, openapiPath, openapi);

  const operations = Object.values(openapi.paths).flatMap((pathItem) =>
    Object.values(pathItem).filter(
      (item) => item && typeof item === 'object' && item.operationId,
    ),
  );
  const operationIds = new Set(
    operations.map((operation) => operation.operationId),
  );
  for (const operationId of [
    'evaluateAcceptance',
    'createPendingApproval',
    'getApproval',
    'approveApproval',
    'rejectApproval',
    'expireApproval',
    'resumeApproval',
  ]) {
    if (!operationIds.has(operationId))
      throw new Error(`OpenAPI operation missing: ${operationId}`);
  }
  const negativeStatuses = new Set();
  const dereference = (
    value,
    sourcePath = openapiPath,
    sourceDocument = openapi,
  ) => {
    let current = { value, sourcePath, sourceDocument };
    const seen = new Set();
    while (current.value && typeof current.value.$ref === 'string') {
      const resolvedRef = resolveReference(
        current.value.$ref,
        current.sourcePath,
        current.sourceDocument,
      );
      if (seen.has(resolvedRef.key))
        throw new Error(`cyclic OpenAPI reference: ${resolvedRef.key}`);
      seen.add(resolvedRef.key);
      current = {
        value: resolvedRef.value,
        sourcePath: resolvedRef.targetPath,
        sourceDocument: resolvedRef.targetDocument,
      };
    }
    return current;
  };
  for (const operation of operations) {
    if (
      !Object.keys(operation.responses).some((status) => status.startsWith('2'))
    ) {
      throw new Error(
        `OpenAPI success response missing: ${operation.operationId}`,
      );
    }
    for (const [status, response] of Object.entries(operation.responses)) {
      if (!status.startsWith('2')) {
        negativeStatuses.add(status);
        const resolvedResponse = dereference(response);
        const responseSchema =
          resolvedResponse.value.content?.['application/json']?.schema;
        const resolvedSchema = dereference(
          responseSchema,
          resolvedResponse.sourcePath,
          resolvedResponse.sourceDocument,
        ).value;
        if (
          resolvedSchema !== openapi.components.schemas.ErrorEnvelope ||
          resolvedSchema.additionalProperties !== false
        ) {
          throw new Error(
            `negative response does not use the closed error envelope: ${operation.operationId} ${status}`,
          );
        }
      }
    }
  }
  for (const status of [
    '400',
    '401',
    '403',
    '404',
    '409',
    '410',
    '429',
    '500',
  ]) {
    if (!negativeStatuses.has(status))
      throw new Error(`OpenAPI negative status missing: ${status}`);
  }
}

if (specs.includes('SPEC-20')) {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const requiredCapabilitySourcePaths = [
    'docs/DATA_GOVERNANCE.md',
    'docs/FUNCTIONAL_REQUIREMENTS.md',
    'docs/PRODUCT_REQUIREMENTS.md',
    'docs/requirements.json',
    'docs/traceability.json',
    'package-lock.json',
    'package.json',
    'policy/agent.rego',
    'policy/conformance.rego',
    'policy/tenants.json',
    'policy/tests/agent_test.rego',
    'pyproject.toml',
    'requirements.txt',
    'scripts/data_guard.py',
    'scripts/setup-python.mjs',
    'scripts/spec-check.mjs',
    'src/lib/opa.ts',
    'src/lib/types.ts',
    'tests_py/test_data_guard.py',
    'tsconfig.json',
    'uv.lock',
    'vitest.config.ts',
  ].sort();
  const sourceManifestPath =
    '.orchestration/validation/A0-08.source-manifest.json';
  const sourceManifest = JSON.parse(readFileSync(sourceManifestPath, 'utf8'));
  if (
    Object.keys(sourceManifest).sort().join(',') !== 'contract_version,paths' ||
    sourceManifest.contract_version !==
      'spec20-capability-source-manifest-v1' ||
    !Array.isArray(sourceManifest.paths) ||
    JSON.stringify(sourceManifest.paths) !==
      JSON.stringify(requiredCapabilitySourcePaths)
  ) {
    throw new Error('SPEC-20 canonical capability source manifest is invalid');
  }
  const sourceIds = (mutations = new Map()) => {
    const hash = createHash('sha256');
    for (const path of requiredCapabilitySourcePaths) {
      hash.update(path);
      hash.update('\0');
      hash.update(mutations.get(path) ?? readFileSync(path));
      hash.update('\0');
    }
    const hex = hash.digest('hex');
    return { revision: hex, digest: `sha256:${hex}` };
  };
  const currentSource = sourceIds();
  const sourceRevision = currentSource.revision;
  const sourceDigest = currentSource.digest;
  const fixturePaths = readdirSync('tests/fixtures/policy')
    .filter((name) => name.startsWith('spec20_') && name.endsWith('.json'))
    .map((name) => `tests/fixtures/policy/${name}`)
    .sort();
  if (fixturePaths.length < 2)
    throw new Error('SPEC-20 requires positive and negative fixtures');
  const fixtures = new Map(
    fixturePaths.map((path) => [path, JSON.parse(readFileSync(path, 'utf8'))]),
  );
  const complete = fixtures.get('tests/fixtures/policy/spec20_complete.json');
  if (!complete) throw new Error('SPEC-20 complete fixture is missing');
  if (
    complete.source.revision !== sourceRevision ||
    complete.source.digest !== sourceDigest
  ) {
    throw new Error(
      `SPEC-20 complete fixture is stale: expected ${sourceRevision} ${sourceDigest}`,
    );
  }

  const testTrustPath = '.orchestration/validation/A0-08.test-trust.json';
  const testTrustData = JSON.parse(readFileSync(testTrustPath, 'utf8'));
  const testTrust = testTrustData.eap?.conformance_trust;
  if (!testTrust) throw new Error('SPEC-20 explicit test trust is missing');
  const testNowNs = BigInt(Date.parse('2026-07-13T02:00:00Z')) * 1_000_000n;
  const testVectorQuery = `data.eap.conformance.satisfied_test_vector with time.now_ns as ${testNowNs}`;
  const evaluateConformance = (
    input,
    query = testVectorQuery,
    trustPath = testTrustPath,
  ) => {
    const args = ['eval', '--format=json', '--data', 'policy/conformance.rego'];
    if (trustPath) args.push('--data', trustPath);
    args.push('--stdin-input', query);
    const result = JSON.parse(
      execFileSync(opaBinary(), args, {
        input: JSON.stringify(input),
        encoding: 'utf8',
      }),
    );
    return result.result?.[0]?.expressions?.[0]?.value === true;
  };
  const evaluateWithTrust = (
    input,
    trust,
    nowNs = testNowNs,
    query = 'data.eap.conformance.satisfied_test_vector',
  ) =>
    evaluateConformance(
      input,
      `${query} with data.eap.conformance_trust as ${JSON.stringify(trust)} with time.now_ns as ${nowNs}`,
      null,
    );
  for (const path of [
    'policy/agent.rego',
    'policy/tests/agent_test.rego',
    'scripts/data_guard.py',
    'tests_py/test_data_guard.py',
    'package-lock.json',
    'requirements.txt',
    'scripts/setup-python.mjs',
  ]) {
    const mutatedBytes = Buffer.concat([
      readFileSync(path),
      Buffer.from('\nSPEC20_INDEPENDENT_MUTATION\n'),
    ]);
    const mutatedSource = sourceIds(new Map([[path, mutatedBytes]]));
    if (
      mutatedSource.digest === sourceDigest ||
      mutatedSource.revision === sourceRevision ||
      complete.source.digest === mutatedSource.digest ||
      complete.source.revision === mutatedSource.revision
    ) {
      throw new Error(
        `SPEC-20 source mutation did not change identity: ${path}`,
      );
    }
    const mutatedTrust = clone(testTrust);
    mutatedTrust.expected.source_revision = mutatedSource.revision;
    mutatedTrust.expected.source_digest = mutatedSource.digest;
    if (evaluateWithTrust(complete, mutatedTrust))
      throw new Error(`SPEC-20 old bundle survived source mutation: ${path}`);
  }
  for (const [path, fixture] of fixtures) {
    const shouldSatisfy = path.endsWith('/spec20_complete.json');
    if (evaluateConformance(fixture) !== shouldSatisfy)
      throw new Error(`SPEC-20 fixture has wrong outcome: ${path}`);
  }
  if (evaluateConformance(complete, 'data.eap.conformance.satisfied', null))
    throw new Error('production conformance accepted without external trust');
  if (evaluateConformance(complete, 'data.eap.conformance.satisfied'))
    throw new Error('production conformance accepted test-only trust');
  for (const [name, mutate] of Object.entries({
    inactive_trust: (trust) => (trust.status = 'inactive'),
    dead_key: (trust) => (trust.active_key.status = 'inactive'),
    wrong_environment: (trust) => (trust.environment = 'production'),
    unknown_key: (trust) => (trust.active_key.id = 'rotated-key'),
    rotated_source: (trust) =>
      (trust.expected.source_digest = `sha256:${'b'.repeat(64)}`),
    rotated_run: (trust) => (trust.expected.run_id = 'run-rotated-00000001'),
  })) {
    const trust = clone(testTrust);
    mutate(trust);
    if (evaluateWithTrust(complete, trust))
      throw new Error(`SPEC-20 trust mutation unexpectedly satisfied: ${name}`);
  }
  const runtimeBoundaries = {
    before_run:
      BigInt(Date.parse(testTrust.expected.not_before)) * 1_000_000n - 1n,
    at_run_expiry:
      BigInt(Date.parse(testTrust.expected.not_after)) * 1_000_000n,
    at_key_expiry:
      BigInt(Date.parse(testTrust.active_key.expires_at)) * 1_000_000n,
  };
  for (const [name, nowNs] of Object.entries(runtimeBoundaries)) {
    if (evaluateWithTrust(complete, testTrust, nowNs))
      throw new Error(
        `SPEC-20 runtime boundary unexpectedly satisfied: ${name}`,
      );
  }
  const immediatelyBeforeRunExpiry =
    BigInt(Date.parse(testTrust.expected.not_after)) * 1_000_000n - 1n;
  if (!evaluateWithTrust(complete, testTrust, immediatelyBeforeRunExpiry))
    throw new Error('SPEC-20 denied immediately before run expiry');
  const extendedTrust = clone(testTrust);
  extendedTrust.expected.not_after = '2028-07-13T00:00:00Z';
  const immediatelyBeforeKeyExpiry =
    BigInt(Date.parse(testTrust.active_key.expires_at)) * 1_000_000n - 1n;
  if (!evaluateWithTrust(complete, extendedTrust, immediatelyBeforeKeyExpiry))
    throw new Error('SPEC-20 denied immediately before key expiry');
  for (const [name, mutate] of Object.entries({
    catalog_path_substitution: (catalog) =>
      (catalog[0].path = '/attacker/result.json'),
    catalog_digest_substitution: (catalog) =>
      (catalog[0].digest = `sha256:${'0'.repeat(64)}`),
    catalog_missing_row: (catalog) => catalog.pop(),
    catalog_extra_row: (catalog) => catalog.push(clone(catalog[0])),
    catalog_duplicate_row: (catalog) => (catalog[5] = clone(catalog[0])),
    catalog_duplicate_path: (catalog) => (catalog[1].path = catalog[0].path),
    catalog_duplicate_digest: (catalog) =>
      (catalog[1].digest = catalog[0].digest),
  })) {
    const trust = clone(testTrust);
    mutate(trust.expected.artifacts);
    if (evaluateWithTrust(complete, trust))
      throw new Error(
        `SPEC-20 catalog mutation unexpectedly satisfied: ${name}`,
      );
  }

  const artifactPaths = new Map(
    testTrust.expected.artifacts.map((entry) => [
      `${entry.requirement_id}:${entry.test_id}`,
      entry.path,
    ]),
  );
  if (artifactPaths.size !== 6)
    throw new Error('SPEC-20 artifact path set is not exact');
  for (const result of complete.results) {
    const path = artifactPaths.get(
      `${result.requirement_id}:${result.test_id}`,
    );
    const bytes = readFileSync(path);
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (digest !== result.execution.artifact.digest)
      throw new Error(`SPEC-20 artifact content/hash mismatch: ${path}`);
    const artifact = JSON.parse(bytes.toString('utf8'));
    if (
      artifact.test_id !== result.test_id ||
      artifact.requirement_id !== result.requirement_id ||
      artifact.source_revision !== complete.source.revision ||
      artifact.source_digest !== complete.source.digest ||
      artifact.outcome !== 'passed' ||
      artifact.exit_code !== 0 ||
      typeof artifact.command !== 'string' ||
      typeof artifact.machine_output !== 'string' ||
      artifact.machine_output.length === 0
    ) {
      throw new Error(
        `SPEC-20 artifact is not machine-produced evidence: ${path}`,
      );
    }
  }

  const denyMutation = (name, mutate) => {
    const candidate = clone(complete);
    mutate(candidate);
    if (evaluateConformance(candidate))
      throw new Error(`SPEC-20 mutation unexpectedly satisfied: ${name}`);
  };
  for (const [field, value] of Object.entries({
    requirement_abstraction: 'tool_specific',
    conformance_evidence: 'file_exists',
    tool_inventory_disposition: 'normative',
  })) {
    denyMutation(`decision.${field}`, (row) => (row.decision[field] = value));
  }
  denyMutation('missing requirement', (row) => row.requirements.pop());
  denyMutation(
    'mixed abstraction',
    (row) => (row.requirements[0].abstraction = 'tool_specific'),
  );
  denyMutation('missing test', (row) => row.results.pop());
  denyMutation('failed test', (row) => (row.results[0].outcome = 'failed'));
  denyMutation('duplicate contradictory test', (row) => {
    const failed = clone(row.results[0]);
    failed.outcome = 'failed';
    row.results.push(failed);
  });
  denyMutation('extra failed result', (row) => {
    const extra = clone(row.results[0]);
    extra.test_id = 'unlisted_test';
    extra.outcome = 'failed';
    row.results.push(extra);
  });
  denyMutation(
    'stale source revision',
    (row) => (row.results[0].source_revision = '0'.repeat(40)),
  );
  denyMutation(
    'stale source digest',
    (row) => (row.results[0].source_digest = `sha256:${'0'.repeat(64)}`),
  );
  denyMutation(
    'mismatched evidence digest',
    (row) => (row.results[0].evidence_digest = `sha256:${'0'.repeat(64)}`),
  );
  for (const [name, mutate] of Object.entries({
    manual: (execution) => (execution.kind = 'manual'),
    file_existence: (execution) => (execution.kind = 'file_existence'),
    tool_identity: (execution) => (execution.kind = 'tool_identity_detection'),
    forged_producer: (execution) => (execution.producer = 'ci:forged'),
    unknown_verifier: (execution) => (execution.verifier = 'gateway:forged'),
    cross_run: (execution) => (execution.run_id = 'run-forged-00000001'),
    artifact_digest: (execution) =>
      (execution.artifact.digest = `sha256:${'0'.repeat(64)}`),
    artifact_uri: (execution) =>
      (execution.artifact.uri = 'cas://sha256/forged'),
    attestation_digest: (execution) =>
      (execution.attestation.digest = `sha256:${'0'.repeat(64)}`),
    subject_digest: (execution) =>
      (execution.attestation.subject_digest = `sha256:${'0'.repeat(64)}`),
    attested_outcome: (execution) => (execution.attestation.outcome = 'failed'),
    synthetic: (execution) => (execution.attestation.synthetic = true),
    unverified: (execution) => (execution.attestation.status = 'unverified'),
    self_attested: (execution) => (execution.attestation.self_attested = true),
  })) {
    denyMutation(name, (row) => mutate(row.results[0].execution));
  }
  for (const [name, mutate] of Object.entries({
    caller_supplied: (context) => (context.caller_supplied = true),
    caller_origin: (context) => (context.origin = 'caller'),
    wrong_owner: (context) => (context.owner = 'caller'),
    wrong_verifier: (context) => (context.verifier = 'gateway:forged'),
    unverified_context: (context) => (context.status = 'unverified'),
    cross_run_context: (context) => (context.run_id = 'run-forged-00000001'),
  })) {
    denyMutation(name, (row) => mutate(row.verification_context));
  }
  denyMutation('duplicate attestation row', (row) => {
    row.results[1].execution.attestation.digest =
      row.results[0].execution.attestation.digest;
    row.results[1].evidence_digest = row.results[0].evidence_digest;
  });
  denyMutation('unknown key id', (row) => {
    row.results[0].execution.attestation.key_id = 'attacker-key';
  });
  denyMutation('unknown signature algorithm', (row) => {
    row.results[0].execution.attestation.algorithm = 'RS512';
  });
  denyMutation('malformed signature', (row) => {
    const attestation = row.results[0].execution.attestation;
    attestation.signed_jwt += 'x';
    attestation.digest = `sha256:${createHash('sha256')
      .update(attestation.signed_jwt)
      .digest('hex')}`;
    row.results[0].evidence_digest = attestation.digest;
  });
  denyMutation('bundle digest arbitrary', (row) => {
    row.verification_context.attestation_bundle_digest = `sha256:${'f'.repeat(64)}`;
  });
  denyMutation('bundle order changed', (row) => {
    row.verification_context.attestation_digests.reverse();
  });
  denyMutation('bundle attestation substituted', (row) => {
    row.verification_context.attestation_digests[0] = `sha256:${'0'.repeat(64)}`;
  });
  denyMutation('bundle attestation duplicated', (row) => {
    row.verification_context.attestation_digests[1] =
      row.verification_context.attestation_digests[0];
  });
  denyMutation('revision 1 internally consistent bypass', (row) => {
    const artifactDigest = `sha256:${'d'.repeat(64)}`;
    const attestationDigest = `sha256:${'e'.repeat(64)}`;
    for (const result of row.results) {
      result.execution.artifact.digest = artifactDigest;
      result.execution.artifact.uri = `cas://sha256/${'d'.repeat(64)}`;
      result.execution.attestation.subject_digest = artifactDigest;
      result.execution.attestation.digest = attestationDigest;
      result.evidence_digest = attestationDigest;
    }
    row.verification_context.attestation_digests =
      Array(6).fill(attestationDigest);
    row.verification_context.attestation_bundle_digest = `sha256:${'f'.repeat(64)}`;
  });
  denyMutation('metadata-only recomputed evidence', (row) => {
    const result = row.results[0];
    result.evidence_digest = `sha256:${createHash('sha256')
      .update(
        [
          result.requirement_id,
          result.test_id,
          result.source_revision,
          result.source_digest,
          'ci:forged',
        ].join('|'),
      )
      .digest('hex')}`;
    result.execution.producer = 'ci:forged';
  });
  denyMutation('split witness', (row) => {
    row.results[0].source_digest = `sha256:${'0'.repeat(64)}`;
    row.results[1].evidence_digest = `sha256:${'0'.repeat(64)}`;
  });
  denyMutation(
    'superseded clause used normatively',
    (row) => (row.superseded_clauses[0].disposition = 'normative'),
  );

  const requirementsById = new Map(
    req.requirements.map((requirement) => [requirement.id, requirement.text]),
  );
  const capabilityRequirements = {
    'REQ-PI-001':
      'Remediation execution shall provide externally observable governed-agent behavior, reject unauthorized or invalid execution, and fail closed when the execution capability or its evidence cannot be verified.',
    'REQ-DATA-001':
      'Governed data analysis shall provide aggregate-only results without raw PII, reject unsafe or unauthorized requests, and fail closed when query safety, isolation, or anonymization outcomes cannot be verified.',
  };
  for (const [id, text] of Object.entries(capabilityRequirements)) {
    if (requirementsById.get(id) !== text)
      throw new Error(`${id} is not the accepted capability requirement`);
    const link = trace.links.find((item) => item.requirement === id);
    if (
      !link ||
      !link.tests.includes('policy/tests/conformance_test.rego') ||
      !link.tests.includes('tests/fixtures/policy/spec20_complete.json')
    ) {
      throw new Error(`${id} lacks machine capability-test traceability`);
    }
  }
  const normativeSections = [
    readFileSync('docs/PRODUCT_REQUIREMENTS.md', 'utf8').split(
      '## Non-normative current design inventory',
    )[0],
    readFileSync('docs/DATA_GOVERNANCE.md', 'utf8').split(
      '## Non-normative current design inventory',
    )[0],
    Object.values(capabilityRequirements).join('\n'),
  ].join('\n');
  if (
    /SQLGlot|DuckDB|Presidio|deterministic local gateway/i.test(
      normativeSections,
    )
  )
    throw new Error('tool-specific wording remains in SPEC-20 normative text');
}

if (
  ['SPEC-14', 'SPEC-17', 'SPEC-18', 'SPEC-19'].some((id) => specs.includes(id))
) {
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fixture = (name) =>
    JSON.parse(
      readFileSync(`tests/fixtures/policy/spec17_${name}.json`, 'utf8'),
    );
  const evaluate = (dataPaths, input, query) => {
    const args = ['eval', '--format=json'];
    for (const path of dataPaths) args.push('--data', path);
    args.push('--stdin-input', query);
    const result = JSON.parse(
      execFileSync(opaBinary(), args, {
        cwd: process.cwd(),
        input: JSON.stringify(input),
        encoding: 'utf8',
      }),
    );
    return result.result?.[0]?.expressions?.[0]?.value;
  };

  const artifactSchema = JSON.parse(
    readFileSync('schemas/persistent-artifact.schema.json', 'utf8'),
  );
  const artifactAjv = new Ajv2020({
    strict: true,
    formats: { 'date-time': /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/ },
  });
  const validateArtifactShape = artifactAjv.compile(artifactSchema);
  const validArtifact = fixture('persistent_valid');
  const validateArtifact = (artifact) =>
    validateArtifactShape(artifact) &&
    artifact.owner.tenant_id === artifact.tenant_id &&
    artifact.source.tenant_id === artifact.tenant_id &&
    artifact.access.tenant_id === artifact.tenant_id &&
    artifact.storage_path.startsWith(`tenants/${artifact.tenant_id}/`) &&
    artifact.storage_path.split('/')[2] === artifact.artifact_type;
  if (!validateArtifact(validArtifact)) {
    throw new Error(
      `valid persistent artifact rejected: ${JSON.stringify(validateArtifactShape.errors)}`,
    );
  }
  for (const name of [
    'persistent_missing_tenant',
    'persistent_shared_path',
    'persistent_unknown_field',
    'persistent_invalid_pii',
    'persistent_invalid_dsar',
    'persistent_invalid_deletion',
    'persistent_unbound_access',
  ]) {
    if (validateArtifact(fixture(name)))
      throw new Error(`invalid persistent artifact accepted: ${name}`);
  }
  const artifactMutations = {
    invalid_pii: (row) => (row.pii_classification = 'unknown'),
    invalid_dsar: (row) => (row.dsar.status = 'unknown'),
    invalid_deletion: (row) => (row.deletion.state = 'unknown'),
    unbound_owner: (row) => (row.owner.tenant_id = 'other'),
    unbound_source: (row) => (row.source.tenant_id = 'other'),
    unbound_access: (row) => (row.access.tenant_id = 'other'),
    mismatched_path: (row) =>
      (row.storage_path = 'tenants/other/evidence/artifact-1.json'),
  };
  for (const [name, mutate] of Object.entries(artifactMutations)) {
    const candidate = clone(validArtifact);
    mutate(candidate);
    if (validateArtifact(candidate))
      throw new Error(`invalid persistent artifact accepted: ${name}`);
  }

  const sandboxData = [
    'policy/sandbox.rego',
    'policy/approval.rego',
    'policy/tenants.json',
  ];
  const sandbox = (input) => evaluate(sandboxData, input, 'data.eap.sandbox');
  const allowed = fixture('allowed_egress');
  const allowedDecision = sandbox(allowed);
  for (const output of ['allow', 'requires_approval', 'deny_reason']) {
    if (!Object.hasOwn(allowedDecision, output))
      throw new Error(`sandbox output is undefined: ${output}`);
  }
  if (allowedDecision.allow !== true || allowedDecision.requires_approval) {
    throw new Error('valid non-approval egress did not reach allow');
  }
  for (const name of [
    'catalog_missing_requires_approval',
    'catalog_malformed_requires_approval',
  ]) {
    const decision = sandbox(fixture(name));
    if (decision.allow !== false || decision.deny_reason.length === 0)
      throw new Error(`malformed catalog fail-open: ${name}`);
  }
  const catalogMutations = {
    extra_field: (row) => (row.egress_catalog[0].unknown = true),
    malformed_roles: (row) =>
      (row.egress_catalog[0].allowed_roles = 'software_engineer'),
    duplicate_role: (row) =>
      (row.egress_catalog[0].allowed_roles = [
        'software_engineer',
        'software_engineer',
      ]),
    duplicate_row: (row) =>
      row.egress_catalog.push(clone(row.egress_catalog[0])),
  };
  for (const [name, mutate] of Object.entries(catalogMutations)) {
    const candidate = clone(allowed);
    mutate(candidate);
    const decision = sandbox(candidate);
    if (decision.allow !== false || decision.deny_reason.length === 0)
      throw new Error(`invalid catalog accepted: ${name}`);
  }

  const unapproved = fixture('unapproved_egress');
  const unapprovedDecision = sandbox(unapproved);
  if (
    unapprovedDecision.allow !== false ||
    unapprovedDecision.requires_approval !== true ||
    !unapprovedDecision.deny_reason.includes('approval_required')
  ) {
    throw new Error('unapproved egress did not reach explicit deny output');
  }
  const approved = fixture('approved_egress');
  if (sandbox(approved).allow !== true)
    throw new Error('valid approval-required egress did not reach allow');
  const unsignedDecision = sandbox(fixture('minimal_unsigned_approval'));
  if (
    unsignedDecision.allow !== false ||
    unsignedDecision.deny_reason.length === 0
  )
    throw new Error('minimal unsigned approval fail-open');

  const denyMutations = {
    anonymous: (row) => (row.identity_context.principal_type = 'anonymous'),
    unverified: (row) => (row.identity_context.verification.status = 'no'),
    wrong_issuer: (row) => (row.identity_context.issuer = 'wrong'),
    wrong_audience: (row) => (row.identity_context.audience = 'wrong'),
    unknown_role: (row) => (row.identity_context.roles = ['unknown']),
    foreign_tenant: (row) =>
      (row.identity_context.tenant_memberships = ['other']),
    forged_body: (row) => (row.body = { tenant: 'acme' }),
    missing_destination: (row) => delete row.egress_request.destination,
    unknown_destination: (row) =>
      (row.egress_request.destination = 'unknown.example'),
    wrong_protocol: (row) => (row.egress_request.protocol = 'http'),
    wrong_port: (row) => (row.egress_request.port = 80),
    binding_mismatch: (row) => (row.egress_request.binding_id = 'other'),
    missing_request_source: (row) => delete row.request_context.source,
    missing_request_evidence: (row) =>
      delete row.request_context.evidence_digest,
  };
  for (const [name, mutate] of Object.entries(denyMutations)) {
    const candidate = clone(allowed);
    mutate(candidate);
    if (sandbox(candidate).allow !== false)
      throw new Error(`invalid egress accepted: ${name}`);
  }

  const splitWitness = clone(allowed);
  splitWitness.egress_catalog = [
    { ...clone(allowed.egress_catalog[0]), protocol: 'http' },
    { ...clone(allowed.egress_catalog[0]), port: 80 },
  ];
  if (sandbox(splitWitness).allow !== false)
    throw new Error('split-witness egress catalog tuple accepted');

  const approvalMutations = {
    missing_id: (row) => delete row.approval.approval_id,
    missing_requester: (row) => delete row.approval.requester_identity,
    missing_decision: (row) => delete row.approval.decision,
    pending: (row) => (row.approval.state = 'pending'),
    rejected: (row) => (row.approval.state = 'rejected'),
    expired: (row) => (row.approval.expires_at = '2026-07-12T12:00:00Z'),
    foreign_tenant: (row) => (row.approval.tenant_id = 'other'),
    task_mismatch: (row) => (row.approval.task_id = 'other'),
    run_mismatch: (row) => (row.approval.run_id = 'other'),
    source_mismatch: (row) => (row.approval.source.revision = 'other'),
    evidence_mismatch: (row) =>
      (row.approval.evidence_digest = 'sha256:' + 'c'.repeat(64)),
    action_mismatch: (row) => (row.approval.action = 'other'),
    foreign_approver: (row) =>
      (row.approval.decision.approver_identity.tenant_memberships = ['other']),
    unknown_approver: (row) =>
      (row.approval.decision.approver_identity.roles = ['unknown']),
    unverified_approver: (row) =>
      (row.approval.decision.approver_identity.verification.status =
        'unverified'),
    decision_before_creation: (row) =>
      (row.approval.decision.decided_at = '2026-07-13T09:00:00Z'),
    decision_in_future: (row) =>
      (row.approval.decision.decided_at = '2026-07-13T13:00:00Z'),
    decision_at_expiry: (row) =>
      (row.approval.decision.decided_at = '2026-07-14T12:00:00Z'),
    unpersisted: (row) => (row.record_context.persisted = false),
    consumed: (row) =>
      (row.approval.resume = {
        status: 'resumed',
        resumed_at: '2026-07-13T11:30:00Z',
        idempotency_key: 'resume-key',
        request_digest: 'sha256:' + 'd'.repeat(64),
      }),
    destination_mismatch: (row) =>
      (row.egress_authorization_context.destination = 'other.example'),
    protocol_mismatch: (row) =>
      (row.egress_authorization_context.protocol = 'http'),
    port_mismatch: (row) => (row.egress_authorization_context.port = 80),
    egress_action_mismatch: (row) =>
      (row.egress_authorization_context.action = 'other'),
    binding_mismatch: (row) =>
      (row.egress_authorization_context.request_binding_id = 'other'),
    context_extra_field: (row) =>
      (row.egress_authorization_context.caller_proof = true),
  };
  for (const [name, mutate] of Object.entries(approvalMutations)) {
    const candidate = clone(approved);
    mutate(candidate);
    const decision = sandbox(candidate);
    if (decision.allow !== false || decision.deny_reason.length === 0)
      throw new Error(`invalid approval-bound egress accepted: ${name}`);
  }

  const inventory = {
    agent: {
      data: ['policy/agent.rego', 'policy/tenants.json'],
      input: JSON.parse(
        readFileSync('tests/fixtures/policy/identity_valid.json', 'utf8'),
      ),
      outputs: ['allow', 'requires_approval', 'deny_reason'],
    },
    routing: {
      data: ['policy/routing.rego', 'policy/tenants.json'],
      input: JSON.parse(
        readFileSync('tests/fixtures/policy/routing_happy.json', 'utf8'),
      ),
      outputs: ['allow', 'deny_reason'],
    },
    sandbox: {
      data: sandboxData,
      input: allowed,
      outputs: ['allow', 'requires_approval', 'deny_reason'],
    },
    approval: {
      data: ['policy/approval.rego'],
      input: JSON.parse(
        readFileSync(
          'tests/fixtures/policy/approval_approved_resume.json',
          'utf8',
        ),
      ),
      outputs: [
        'allow_approve',
        'allow_reject',
        'allow_expire',
        'allow_resume',
        'deny_reason',
      ],
    },
    closure: {
      data: ['policy/closure.rego'],
      input: JSON.parse(
        readFileSync('tests/fixtures/policy/closure_clean.json', 'utf8'),
      ),
      outputs: ['remediation_success', 'closed'],
    },
    cc_guard: {
      data: ['policy/cc_guard.rego'],
      input: { paths: ['README.md'], active_leases: [], command: '' },
      outputs: ['allow', 'deny_reason'],
    },
  };
  for (const [name, entry] of Object.entries(inventory)) {
    const decision = evaluate(entry.data, entry.input, `data.eap.${name}`);
    for (const output of entry.outputs) {
      if (!Object.hasOwn(decision, output))
        throw new Error(
          `documented policy output is undefined: ${name}.${output}`,
        );
    }
  }
  const replay = clone(inventory.approval.input);
  replay.approval.state = 'resumed';
  replay.approval.resume = {
    status: 'resumed',
    resumed_at: replay.now,
    idempotency_key: replay.idempotency.key,
    request_digest: replay.idempotency.request_digest,
  };
  if (
    evaluate(
      ['policy/approval.rego'],
      replay,
      'data.eap.approval.idempotent_replay',
    ) !== true
  ) {
    throw new Error('approval idempotent_replay output is not reachable');
  }
  const conflict = clone(replay);
  conflict.idempotency.request_digest = `sha256:${'e'.repeat(64)}`;
  if (
    evaluate(
      ['policy/approval.rego'],
      conflict,
      'data.eap.approval.idempotency_conflict',
    ) !== true
  ) {
    throw new Error('approval idempotency_conflict output is not reachable');
  }
  const ccGuardDenied = evaluate(
    ['policy/cc_guard.rego'],
    { paths: ['policy/sandbox.rego'], active_leases: [], command: '' },
    'data.eap.cc_guard',
  );
  if (ccGuardDenied.allow !== false || ccGuardDenied.deny_reason.length === 0)
    throw new Error('cc_guard deny entry point is not reachable');

  const canonicalDocs = [
    'docs/INTEGRATION_BOUNDARY.md',
    'docs/POLICY_MODEL.md',
    'docs/DATA_GOVERNANCE.md',
    'docs/OPERATIONS.md',
  ];
  const documents = canonicalDocs.map((path) => ({
    path,
    text: readFileSync(path, 'utf8'),
  }));
  for (const heading of [
    '## Canonical glossary (normative)',
    '## Canonical controlled-resource catalog (normative)',
  ]) {
    const definitions = documents.filter(({ text }) => text.includes(heading));
    if (
      definitions.length !== 1 ||
      definitions[0].path !== 'docs/INTEGRATION_BOUNDARY.md'
    ) {
      throw new Error(`canonical section is not unique: ${heading}`);
    }
  }
  for (const { path, text } of documents.slice(1)) {
    for (const reference of [
      'Canonical glossary (normative)',
      'Canonical controlled-resource catalog (normative)',
    ]) {
      if (!text.includes(reference))
        throw new Error(`${path} does not reference ${reference}`);
    }
  }
  const policyModel = documents.find(
    ({ path }) => path === 'docs/POLICY_MODEL.md',
  ).text;
  for (const marker of [
    '`data.eap.agent`',
    '`data.eap.routing`',
    '`data.eap.sandbox`',
    '`data.eap.approval`',
    '`data.eap.closure`',
    '`data.eap.cc_guard`',
    'It does not authenticate identities, establish tenant membership, or supply tenant authorization semantics.',
  ]) {
    if (!policyModel.includes(marker))
      throw new Error(`policy inventory is incomplete: ${marker}`);
  }
}
console.log('spec-check:passed');
