import { existsSync, readFileSync } from 'node:fs';

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
const reqIds = new Set(req.requirements.map((item) => item.id));
for (const id of reqIds) {
  if (!trace.links.some((link) => link.requirement === id)) {
    throw new Error(`requirement ${id} has no traceability link`);
  }
}
for (const link of trace.links) {
  for (const file of [...link.implementation, ...link.tests]) {
    if (file.startsWith('artifacts/')) continue;
    if (!existsSync(file))
      throw new Error(`traceability file missing: ${file}`);
  }
}
console.log('spec-check:passed');
