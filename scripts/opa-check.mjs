import { evaluatePolicy } from '../src/lib/opa.ts';

const cases = [
  [
    {
      user: 'engineer',
      tenant: 'acme',
      tool: 'apply_patch',
      risk: 'medium',
      resource: 'repo',
    },
    true,
  ],
  [
    {
      user: 'guest',
      tenant: 'acme',
      tool: 'apply_patch',
      risk: 'medium',
      resource: 'repo',
    },
    false,
  ],
  [
    {
      user: 'engineer',
      tenant: 'other',
      tool: 'apply_patch',
      risk: 'medium',
      resource: 'repo',
    },
    false,
  ],
  [
    {
      user: 'engineer',
      tenant: 'acme',
      tool: 'shell',
      risk: 'medium',
      resource: 'repo',
    },
    false,
  ],
];
for (const [input, expected] of cases) {
  const decision = await evaluatePolicy(input);
  if (decision.allow !== expected) {
    throw new Error(
      `unexpected OPA decision for ${JSON.stringify(input)}: ${JSON.stringify(decision)}`,
    );
  }
}
console.log('opa:ok');
