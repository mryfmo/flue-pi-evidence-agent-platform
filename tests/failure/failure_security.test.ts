import { describe, expect, it } from 'vitest';
import { evaluatePolicy } from '../../src/lib/opa.ts';
import { unsafeQueryExitCode } from '../../src/lib/dataProxy.ts';

describe('failure and security gates', () => {
  it('requires review for high-risk actions instead of auto execution', async () => {
    const decision = await evaluatePolicy({
      user: 'engineer',
      tenant: 'acme',
      tool: 'apply_patch',
      risk: 'high',
      resource: 'repo',
    });
    expect(decision.allow).toBe(false);
    expect(decision.requires_approval).toBe(true);
  });

  it('blocks shell tools and all unsafe SQL classes', async () => {
    await expect(
      evaluatePolicy({
        user: 'engineer',
        tenant: 'acme',
        tool: 'shell',
        risk: 'medium',
        resource: 'repo',
      }),
    ).resolves.toMatchObject({ allow: false });
    await expect(unsafeQueryExitCode('mutation')).resolves.not.toBe(0);
    await expect(unsafeQueryExitCode('multi')).resolves.not.toBe(0);
  });
});
