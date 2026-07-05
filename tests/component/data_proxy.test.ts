import { describe, expect, it } from 'vitest';
import { metricQuery, unsafeQueryExitCode } from '../../src/lib/dataProxy.ts';

describe('governed data proxy', () => {
  it('executes aggregate metric path and redacts PII', async () => {
    const result = await metricQuery();
    expect(result.metric).toBe('active_users_by_plan');
    expect(result.piiDetected).toBe(true);
    expect(result.redactedText).not.toContain('alice@example.com');
    expect(result.rejectedUnsafeSql).toBe(true);
    expect(result.rejectedMutationSql).toBe(true);
    expect(result.rejectedMultiStatementSql).toBe(true);
  });

  it('rejects unsafe, mutation, and multi-statement SQL commands', async () => {
    await expect(unsafeQueryExitCode('unsafe')).resolves.not.toBe(0);
    await expect(unsafeQueryExitCode('mutation')).resolves.not.toBe(0);
    await expect(unsafeQueryExitCode('multi')).resolves.not.toBe(0);
  });
});
