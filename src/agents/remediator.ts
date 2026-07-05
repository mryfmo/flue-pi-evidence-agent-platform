/** Flue/Pi remediator agent profile. */
import { readFileSync } from 'node:fs';
import { Type, createAgent, defineTool } from '@flue/runtime';

const DEFAULT_INSTRUCTIONS =
  'You are an evidence-driven remediation agent. Summarize only verified facts.';

export const explainHypothesis = defineTool({
  name: 'explain_hypothesis',
  description: 'Explain one evidence hypothesis for a remediation run.',
  parameters: Type.Object({ id: Type.String(), title: Type.String() }),
  execute: async ({ id, title }) => `Hypothesis ${id}: ${title}`,
});

function remediatorInstructions(): string {
  const skillPath = process.env.EAP_REMEDIATOR_SKILL;
  if (!skillPath) return DEFAULT_INSTRUCTIONS;
  try {
    return stripFrontmatter(readFileSync(skillPath, 'utf8')).trim();
  } catch (error) {
    throw new Error(`EAP_REMEDIATOR_SKILL is unreadable: ${skillPath}`, {
      cause: error,
    });
  }
}

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---\n')) return markdown;
  const end = markdown.indexOf('\n---\n', 4);
  return end === -1 ? markdown : markdown.slice(end + 5);
}

export default createAgent(() => ({
  model: 'local-gateway/fixbot',
  instructions: remediatorInstructions(),
  tools: [explainHypothesis],
}));
