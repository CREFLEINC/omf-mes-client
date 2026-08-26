// 개발 모드 — 번들 후 Electron을 띄운다.
// POP_DEV_SERVER_URL을 주면 vite 개발 서버를 물고, 없으면 복사된 산출물을 띄운다.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

await import('./build.mjs');

const electron = spawn(join(root, 'node_modules/.bin/electron'), ['.'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
electron.on('exit', (code) => process.exit(code ?? 0));
