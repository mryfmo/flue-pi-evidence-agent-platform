import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Flue + Pi runtime integration', () => {
  it('uses Flue runtime with Pi dependencies installed', () => {
    const pkg = JSON.parse(
      readFileSync('node_modules/@flue/runtime/package.json', 'utf8'),
    ) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@earendil-works/pi-agent-core']).toBeTruthy();
    expect(pkg.dependencies['@earendil-works/pi-ai']).toBeTruthy();
  });

  it('builds Flue Node target', () => {
    const out = execFileSync('npm', ['run', 'flue:build'], {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    expect(out).toContain('Build complete');
  });
});
