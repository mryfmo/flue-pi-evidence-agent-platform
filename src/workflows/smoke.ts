/** Flue/Pi smoke workflow that exercises Pi through an OpenAI-compatible local gateway. */
import { createAgent, type FlueContext } from '@flue/runtime';
import { startLocalGateway } from '../lib/localGateway.ts';

const agent = createAgent(() => ({
  model: 'local-gateway/fixbot',
  instructions: 'Return concise text.',
}));

export async function run({ init, payload }: FlueContext<{ text: string }>) {
  const gateway = await startLocalGateway(`ack:${payload.text}`);
  try {
    const harness = await init(agent);
    const session = await harness.session();
    const response = await session.prompt(payload.text);
    return { text: response.text, gatewayRequests: gateway.requests.length };
  } finally {
    await gateway.close();
  }
}
