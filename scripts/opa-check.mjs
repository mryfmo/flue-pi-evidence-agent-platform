import { evaluatePolicy } from '../src/lib/opa.ts';

const validInput = {
  identity_context: {
    subject_id: 'sub-123',
    principal_type: 'authenticated',
    tenant_memberships: ['acme'],
    roles: ['software_engineer'],
    issuer: 'flue-pi-identity-authority',
    audience: 'flue-pi-agent-policy',
    verification: { status: 'verified', owner: 'flue-pi-platform-gateway' },
    request_binding: { id: 'req-123' },
  },
  request_context: { tenant: 'acme', binding_id: 'req-123' },
  tool: 'apply_patch',
  risk: 'medium',
  resource: 'repo',
};

const cases = [
  ['canonical gateway context', validInput, true, ['ok']],
  [
    'body-only identity spoof',
    {
      user: 'engineer',
      tenant: 'acme',
      tool: 'apply_patch',
      risk: 'medium',
      resource: 'repo',
    },
    false,
    [
      'body_identity_forbidden',
      'missing_identity_context',
      'missing_request_context',
    ],
  ],
  [
    'unknown role',
    {
      ...validInput,
      identity_context: { ...validInput.identity_context, roles: ['unknown'] },
    },
    false,
    ['insufficient_role', 'unknown_role'],
  ],
  [
    'insufficient role',
    {
      ...validInput,
      identity_context: {
        ...validInput.identity_context,
        roles: ['data_analyst'],
      },
    },
    false,
    ['insufficient_role'],
  ],
  [
    'tenant mismatch',
    {
      ...validInput,
      request_context: { tenant: 'other', binding_id: 'req-123' },
    },
    false,
    ['tenant_mismatch'],
  ],
  [
    'shell tool',
    { ...validInput, tool: 'shell' },
    false,
    ['dangerous_shell', 'insufficient_role', 'unknown_tool'],
  ],
  [
    'unknown tool',
    { ...validInput, tool: 'unknown' },
    false,
    ['insufficient_role', 'unknown_tool'],
  ],
];

for (const [name, input, allow, reasons] of cases) {
  const decision = await evaluatePolicy(input);
  const actualReasons = [...decision.reasons].sort();
  const expectedReasons = [...reasons].sort();
  if (
    decision.allow !== allow ||
    decision.requires_approval ||
    JSON.stringify(actualReasons) !== JSON.stringify(expectedReasons)
  ) {
    throw new Error(
      `unexpected OPA decision for ${name}: ${JSON.stringify(decision)}`,
    );
  }
}

console.log('opa:ok');
