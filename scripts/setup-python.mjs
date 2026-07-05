import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const python = process.env.PYTHON ?? 'python';
const venvPython =
  process.platform === 'win32'
    ? '.venv/Scripts/python.exe'
    : '.venv/bin/python';
if (!existsSync(venvPython)) {
  execFileSync(python, ['-m', 'venv', '.venv'], { stdio: 'inherit' });
}
execFileSync(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'], {
  stdio: 'inherit',
});
execFileSync(venvPython, ['-m', 'pip', 'install', '-r', 'requirements.txt'], {
  stdio: 'inherit',
});
console.log(venvPython);
