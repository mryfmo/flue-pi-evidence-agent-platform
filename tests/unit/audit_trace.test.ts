import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const repo = resolve('.');
const node = resolve(repo, 'node_modules/node/bin/node');
const script = resolve(repo, 'scripts/audit-trace.mjs');

describe('audit trace CLI', () => {
  it('renders all available sections for a task id', () => {
    const dir = fixture();
    const output = execFileSync(node, [script, 'T-audit'], {
      cwd: dir,
      encoding: 'utf8',
    });

    expect(output).toContain('# Audit Trace: T-audit');
    expect(output).toContain('## Delegation');
    expect(output).toContain('## Acceptance');
    expect(output).toContain('llm_gateway_call');
    expect(output).toContain('gateway.call');
    expect(output).not.toContain('secret prompt');
  });

  it('marks missing sections explicitly', () => {
    const dir = fixture({ minimal: true });
    const output = execFileSync(node, [script, 'T-audit'], {
      cwd: dir,
      encoding: 'utf8',
    });

    expect(output).toContain('## Llm Events');
    expect(output).toContain('status: missing');
  });

  it('exits one when task_id has no records', () => {
    const result = spawnSync(node, [script, 'T-missing', '--json'], {
      cwd: fixture(),
      encoding: 'utf8',
    });

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      task_id: 'T-missing',
      record_count: 0,
    });
  });

  it('emits structured JSON and redacts body fields to digests', () => {
    const output = execFileSync(node, [script, 'T-audit', '--json'], {
      cwd: fixture(),
      encoding: 'utf8',
    });
    const parsed = JSON.parse(output);

    expect(parsed.sections.delegation.status).toBe('present');
    expect(parsed.sections.llm_events.audit[0].event.body).toMatchObject({
      redacted: true,
    });
    expect(JSON.stringify(parsed)).not.toContain('secret prompt');
  });
});

function fixture(options: { minimal?: boolean } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'audit-trace-'));
  for (const path of [
    '.orchestration/tasks',
    '.orchestration/orchestrator',
    '.orchestration/reports',
    '.orchestration/validation',
    '.orchestration/sandboxes',
    '.orchestration/acceptance',
    'artifacts/audit',
    'artifacts/telemetry',
  ]) {
    mkdirSync(join(dir, path), { recursive: true });
  }
  writeFileSync(
    join(dir, '.orchestration/tasks/T-audit.md'),
    '# task\n',
    'utf8',
  );
  writeFileSync(
    join(dir, '.orchestration/reports/T-audit.report.md'),
    'status: ready_for_review\n',
    'utf8',
  );
  if (options.minimal) return dir;

  writeFileSync(
    join(dir, '.orchestration/orchestrator/events.jsonl'),
    [
      JSON.stringify({
        ts: '2026-07-08T00:00:00Z',
        type: 'delegate',
        task_id: 'T-audit',
        to: 'worker',
      }),
      JSON.stringify({
        ts: '2026-07-08T00:10:00Z',
        type: 'accept',
        task_id: 'T-audit',
        approver: 'alice',
      }),
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    join(dir, '.orchestration/orchestrator/leases.json'),
    JSON.stringify([
      { task_id: 'T-audit', paths: ['docs/x.md'], status: 'released' },
    ]),
    'utf8',
  );
  writeFileSync(
    join(dir, '.orchestration/validation/T-audit.validation.log'),
    'overall: passed\n',
    'utf8',
  );
  writeFileSync(
    join(dir, '.orchestration/sandboxes/T-audit.sandbox.md'),
    'status=skipped\n',
    'utf8',
  );
  writeFileSync(
    join(dir, '.orchestration/acceptance/T-audit.acceptance.md'),
    'status=accepted\n',
    'utf8',
  );
  writeFileSync(
    join(dir, 'artifacts/audit/remediation.jsonl'),
    [
      JSON.stringify({
        type: 'policy_decision',
        task_id: 'T-audit',
        policyDecision: { allow: true },
      }),
      JSON.stringify({
        type: 'llm_gateway_call',
        task_id: 'T-audit',
        body: 'secret prompt',
      }),
    ].join('\n'),
    'utf8',
  );
  writeFileSync(
    join(dir, 'artifacts/telemetry/traces.jsonl'),
    JSON.stringify({
      name: 'gateway.call',
      attributes: { 'gateway.task_id': 'T-audit' },
    }),
    'utf8',
  );
  return dir;
}
