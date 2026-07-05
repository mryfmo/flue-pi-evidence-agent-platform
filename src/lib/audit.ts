/** Append-only JSONL audit logging for validation and trace evidence. */
import { mkdir, appendFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function appendAudit(
  path: string,
  event: Record<string, unknown>,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await appendFile(
    path,
    `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`,
    'utf8',
  );
}
