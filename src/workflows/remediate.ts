/** Evidence-driven remediation workflow implemented with Flue + Pi and OSS gates. */
import type { FlueContext } from '@flue/runtime';
import remediator from '../agents/remediator.ts';
import { appendAudit } from '../lib/audit.ts';
import {
  applySelectedPatches,
  proposePatchCandidates,
  readWorkspaceFiles,
  scanWorkspace,
  sourceArtifactPaths,
  verifyWorkspaceWithExecutor,
} from '../lib/code.ts';
import { metricQuery } from '../lib/dataProxy.ts';
import {
  addEvidence,
  addHypotheses,
  addImpactEdge,
  addPatchCandidate,
  closureGate,
  createLedger,
  markHypothesesPatched,
  markHypothesesVerified,
  markPatchApplied,
  saveLedger,
} from '../lib/ledger.ts';
import { startLocalGateway } from '../lib/localGateway.ts';
import { evaluatePolicy } from '../lib/opa.ts';
import { getSandboxExecutor, type SandboxHandle } from '../lib/sandbox.ts';
import { configureTelemetry, withSpan } from '../lib/telemetry.ts';
import type { RemediationPayload, RemediationResult } from '../lib/types.ts';

export async function run({
  init,
  log,
  payload,
}: FlueContext<RemediationPayload>): Promise<RemediationResult> {
  const auditLog = 'artifacts/audit/remediation.jsonl';
  const ledgerPath = 'artifacts/demo/hypothesis-ledger.json';
  const tracePath = configureTelemetry('artifacts/telemetry/traces.jsonl');
  const runId = `run-${Date.now()}`;
  const auditId = runId;
  const traceId = runId;
  const sandboxExecutor = getSandboxExecutor({ auditLog });
  let sandboxHandle: SandboxHandle | undefined;
  const workspaceFiles = await readWorkspaceFiles(payload.workspace);
  const gateway = await startLocalGateway(
    'Verified remediation: all localized hypotheses were patched, tests passed, data path enforced SQL and PII policy.',
  );
  try {
    await appendAudit(auditLog, { type: 'run_start', payload });
    const workspace = await withSpan(
      'workspace.prepare',
      { workspace: payload.workspace },
      async () => {
        sandboxHandle = await sandboxExecutor.create({
          image: {
            name: 'local-workspace',
            tag: 'validate-release',
            digest: 'sha256:local',
          },
          limits: { cpu: '1', memoryMb: 1024, timeoutMs: 30_000 },
          network: { egress: 'deny' },
          audit_id: auditId,
          trace_id: traceId,
        });
        await sandboxExecutor.putFiles(sandboxHandle, workspaceFiles);
        return sandboxHandle.id;
      },
    );
    let ledger = createLedger(runId);

    const localized = await withSpan('code.localize', { workspace }, () =>
      scanWorkspace(workspace),
    );
    ledger = addHypotheses(ledger, localized);
    ledger = addEvidence(ledger, {
      id: 'EV-CODE-SCAN-001',
      kind: 'source',
      summary: `Code scan localized ${localized.length} hypotheses.`,
      location: workspace,
      linkedHypotheses: localized.map((item) => item.id),
    });
    const testTargets = workspaceFiles
      .map((file) => file.path)
      .filter((path) => path.startsWith('tests/') && path.endsWith('.py'))
      .sort();
    const impactTarget = testTargets.length > 0 ? testTargets.join(', ') : '';
    for (const hypothesis of localized) {
      ledger = addImpactEdge(ledger, {
        from: hypothesis.affectedSymbol,
        to: impactTarget,
        reason: 'Regression tests exercise the affected public function.',
      });
    }
    log.info('Hypotheses localized', { count: localized.length });
    await appendAudit(auditLog, {
      type: 'hypotheses_localized',
      hypotheses: localized,
    });

    const policyDecision = await withSpan(
      'policy.opa.evaluate',
      { tool: 'apply_patch' },
      () =>
        evaluatePolicy({
          user: payload.user,
          tenant: payload.tenant,
          tool: 'apply_patch',
          risk: 'medium',
          resource: workspace,
        }),
    );
    ledger = addEvidence(ledger, {
      id: 'EV-OPA-001',
      kind: 'policy',
      summary: `OPA decision allow=${policyDecision.allow} approval=${policyDecision.requires_approval}`,
    });
    await appendAudit(auditLog, { type: 'policy_decision', policyDecision });
    if (!policyDecision.allow || policyDecision.requires_approval) {
      const closure = closureGate(ledger);
      await saveLedger(ledgerPath, ledger);
      return {
        status: 'needs_review',
        agentSummary: 'Policy prevented automatic remediation.',
        hypotheses: localized,
        closure,
        policyDecision,
        verification: {
          passed: false,
          command: 'not executed',
          stdout: '',
          stderr: 'policy blocked',
          exitCode: 1,
        },
        dataQuery: {
          metric: 'not executed',
          rows: [],
          piiDetected: false,
          redactedText: '',
          rejectedUnsafeSql: false,
          rejectedMutationSql: false,
          rejectedMultiStatementSql: false,
        },
        auditLog,
        ledgerPath,
        tracePath,
        flueGatewayRequests: gateway.requests.length,
      };
    }

    const candidates = proposePatchCandidates(localized);
    for (const candidate of candidates)
      ledger = addPatchCandidate(ledger, candidate);
    const applied = await withSpan(
      'code.patch.apply',
      { candidates: candidates.length },
      () => applySelectedPatches(workspace, candidates),
    );
    for (const patchId of applied.appliedPatchIds)
      ledger = markPatchApplied(ledger, patchId);
    ledger = markHypothesesPatched(ledger, applied.hypothesesPatched);
    ledger = addEvidence(ledger, {
      id: 'EV-PATCH-FANOUT-001',
      kind: 'agent',
      summary: `${candidates.length} patch candidates generated; ${applied.appliedPatchIds.length} selected and applied.`,
      linkedHypotheses: applied.hypothesesPatched,
    });

    const verification = await withSpan(
      'verification.pytest',
      { workspace },
      () =>
        verifyWorkspaceWithExecutor(
          sandboxExecutor,
          requireSandboxHandle(sandboxHandle),
        ),
    );
    ledger = markHypothesesVerified(ledger, verification);
    ledger = addEvidence(ledger, {
      id: 'EV-VERIFY-001',
      kind: 'verification',
      summary: `Verifier ${verification.command} passed=${verification.passed}`,
      location: workspace,
    });

    const remaining = await withSpan('code.rescan', { workspace }, () =>
      scanWorkspace(workspace),
    );
    await sandboxExecutor.collectArtifacts(
      requireSandboxHandle(sandboxHandle),
      sourceArtifactPaths(workspace, localized),
      {
        maxBytes: 1024 * 1024,
        audit_id: auditId,
        trace_id: traceId,
      },
    );
    ledger = addEvidence(ledger, {
      id: 'EV-RESCAN-001',
      kind: 'impact',
      summary: `Rescan remaining hypotheses=${remaining.length}`,
      location: workspace,
    });
    const dataQuery = await withSpan(
      'data.guard.metric_query',
      { metric: 'active_users_by_plan' },
      () => metricQuery(),
    );
    ledger = addEvidence(ledger, {
      id: 'EV-DATA-PROXY-001',
      kind: 'data',
      summary: `SQLGlot/DuckDB/Presidio path executed metric=${dataQuery.metric}; PII redacted=${dataQuery.piiDetected}`,
    });
    const closure = closureGate(ledger);
    await saveLedger(ledgerPath, ledger);

    const harness = await init(remediator);
    await harness.fs.writeFile(
      'evidence.json',
      JSON.stringify({ ledger, verification, dataQuery, closure }, null, 2),
    );
    const session = await harness.session();
    const agentResponse = await session.prompt(
      'Summarize the verified remediation from evidence.json.',
    );

    const status =
      verification.passed &&
      remaining.length === 0 &&
      dataQuery.rejectedUnsafeSql &&
      dataQuery.rejectedMutationSql &&
      dataQuery.rejectedMultiStatementSql &&
      closure.closed
        ? 'passed'
        : 'failed';
    await appendAudit(auditLog, {
      type: 'run_end',
      status,
      verification,
      dataQuery,
      closure,
      remaining,
    });
    return {
      status,
      agentSummary: agentResponse.text,
      hypotheses: ledger.hypotheses,
      closure,
      policyDecision,
      verification,
      dataQuery,
      auditLog,
      ledgerPath,
      tracePath,
      flueGatewayRequests: gateway.requests.length,
    };
  } finally {
    if (sandboxHandle) await sandboxExecutor.destroy(sandboxHandle);
    await gateway.close();
  }
}

function requireSandboxHandle(
  handle: SandboxHandle | undefined,
): SandboxHandle {
  if (!handle) throw new Error('sandbox handle is unavailable');
  return handle;
}
