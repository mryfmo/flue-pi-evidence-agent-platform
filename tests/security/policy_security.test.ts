import { describe, expect, it } from 'vitest';
import { evaluatePolicy } from '../../src/lib/opa.ts';

describe('policy security regression', () => {
  it('denies cross-tenant operations', async () => {
    await expect(
      evaluatePolicy({
        user: 'engineer',
        tenant: 'other',
        tool: 'apply_patch',
        risk: 'medium',
        resource: 'repo',
      }),
    ).resolves.toMatchObject({ allow: false });
  });
});
