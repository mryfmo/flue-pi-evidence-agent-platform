/** Flue/Pi remediator agent profile. */
import { Type, createAgent, defineTool } from '@flue/runtime';

export const explainHypothesis = defineTool({
  name: 'explain_hypothesis',
  description: 'Explain one evidence hypothesis for a remediation run.',
  parameters: Type.Object({ id: Type.String(), title: Type.String() }),
  execute: async ({ id, title }) => `Hypothesis ${id}: ${title}`,
});

export default createAgent(() => ({
  model: 'local-gateway/fixbot',
  instructions:
    'You are an evidence-driven remediation agent. Summarize only verified facts.',
  tools: [explainHypothesis],
}));
