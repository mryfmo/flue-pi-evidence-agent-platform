import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const agentPath = '../../src/agents/remediator.ts';
const originalSkill = process.env.EAP_REMEDIATOR_SKILL;

async function loadAgent() {
  return import(`${agentPath}?case=${crypto.randomUUID()}`);
}

describe('remediator skill hook', () => {
  afterEach(() => {
    if (originalSkill === undefined) {
      delete process.env.EAP_REMEDIATOR_SKILL;
      return;
    }
    process.env.EAP_REMEDIATOR_SKILL = originalSkill;
  });

  it('loads instructions from markdown body when EAP_REMEDIATOR_SKILL is set', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'remediator-skill-'));
    const skill = join(dir, 'skill.md');
    await writeFile(
      skill,
      [
        '---',
        'name: remediator',
        'version: 1.1.0-candidate',
        '---',
        '',
        'Summarize verified evidence only.',
        'Reference hypothesis IDs.',
        '',
      ].join('\n'),
    );
    process.env.EAP_REMEDIATOR_SKILL = skill;

    const { default: remediator } = await loadAgent();

    expect(remediator.initialize().instructions).toBe(
      'Summarize verified evidence only.\nReference hypothesis IDs.',
    );
  });

  it('fails closed when EAP_REMEDIATOR_SKILL points to a missing file', async () => {
    process.env.EAP_REMEDIATOR_SKILL = join(
      tmpdir(),
      `missing-remediator-${crypto.randomUUID()}.md`,
    );
    const { default: remediator } = await loadAgent();

    expect(() => remediator.initialize()).toThrow(/EAP_REMEDIATOR_SKILL/);
  });
});
