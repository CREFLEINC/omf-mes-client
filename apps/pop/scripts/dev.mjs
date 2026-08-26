// 개발 모드 — 번들 후 Electron을 띄운다.
// POP_DEV_SERVER_URL을 주면 vite 개발 서버를 물고, 없으면 복사된 산출물을 띄운다.
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

await import('./build.mjs');

// ⛔ `node_modules/.bin/electron`을 직접 spawn하지 않는다 — Windows에서 그것은 확장자 없는
//    sh 스크립트이고 실행 가능한 것은 `electron.cmd`다. shell:false spawn은 확장자 해석을
//    하지 않아 실패한다. 이 이슈가 상정한 개발 PC가 Windows다.
//    패키지가 알려 주는 실행 파일 경로를 쓰면 플랫폼과 무관하게 맞는다.
const { default: electronPath } = await import('electron');

const electron = spawn(electronPath, ['.'], { cwd: root, stdio: 'inherit', env: process.env });
electron.on('exit', (code) => process.exit(code ?? 0));
