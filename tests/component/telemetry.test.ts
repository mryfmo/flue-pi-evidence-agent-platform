import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const nodeArgs = ['--import', 'tsx', '--input-type=module', '-e'];
const nodeBinary = './node_modules/node/bin/node';
const execFile = promisify(execFileCallback);

async function runTelemetryScript(script: string) {
  const { stdout, stderr } = await execFile(nodeBinary, [...nodeArgs, script], {
    cwd: process.cwd(),
    env: { HOME: process.env.HOME, PATH: process.env.PATH },
    timeout: 10_000,
  });
  expect(stderr).toBe('');
  return JSON.parse(stdout) as unknown;
}

describe('telemetry exporters', () => {
  it('keeps the default JSONL trace evidence unchanged when OTLP is unset', async () => {
    const result = (await runTelemetryScript(`
      import { readFile } from 'node:fs/promises';
      import { tmpdir } from 'node:os';
      import { join } from 'node:path';
      process.env.EAP_OTLP_ENDPOINT = '';
      const { configureTelemetry, withSpan } = await import('./src/lib/telemetry.ts');
      const tracePath = join(tmpdir(), \`eap-traces-\${crypto.randomUUID()}.jsonl\`);

      const configuredPath = configureTelemetry(tracePath);
      await withSpan('component.default', { component: 'telemetry' }, async () => 'ok');
      const lines = (await readFile(tracePath, 'utf8')).trim().split('\\n');

      console.log(JSON.stringify({ configuredPath, tracePath, lines }));
    `)) as { configuredPath: string; tracePath: string; lines: string[] };

    expect(result.configuredPath).toBe(result.tracePath);
    expect(result.lines).toHaveLength(1);
    expect(JSON.parse(result.lines[0] ?? '{}')).toEqual({
      name: 'component.default',
      traceId: expect.any(String),
      spanId: expect.any(String),
      attributes: { component: 'telemetry' },
      status: { code: 1 },
    });
  });

  it('drops OTLP export failures without failing the workflow', async () => {
    const result = (await runTelemetryScript(`
      import { tmpdir } from 'node:os';
      import { join } from 'node:path';
      process.env.EAP_OTLP_ENDPOINT = 'http://127.0.0.1:9/v1/traces';
      const warnings = [];
      console.warn = (...args) => warnings.push(args.join(' '));
      const { configureTelemetry, withSpan } = await import('./src/lib/telemetry.ts');
      const tracePath = join(tmpdir(), \`eap-traces-\${crypto.randomUUID()}.jsonl\`);

      configureTelemetry(tracePath);
      const value = await withSpan('component.otlp', { component: 'telemetry' }, async () => 'ok');
      for (let i = 0; i < 30 && warnings.length === 0; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      console.log(JSON.stringify({ value, warnings }));
    `)) as { value: string; warnings: string[] };

    expect(result.value).toBe('ok');
    expect(result.warnings).toEqual([
      'OTLP trace export failed; dropping spans.',
    ]);
  });
});
