// main·preload를 CommonJS로 번들한다 — Electron의 preload는 ESM을 안정적으로 받지 않는다.
// 렌더러는 apps/web 빌드 산출물을 그대로 복사해 쓴다(POP 화면 구현은 #441 범위 밖).
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const webDist = join(root, '../web/dist');

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
};

/**
 * esbuild 경고를 실패로 올린다.
 * 근거: `import.meta`가 CJS 출력에서 비는 것은 경고로만 나오는데, 비면 preload·renderer
 * 경로가 조용히 어긋나 창이 빈 화면으로 뜬다. 빌드가 초록인 채 앱만 죽는 부류라 여기서 막는다.
 */
async function buildOrFail(options) {
  const result = await build(options);
  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.error(`✖ ${w.text}  (${w.location?.file}:${w.location?.line})`);
    }
    throw new Error(`esbuild 경고 ${result.warnings.length}건 — 빌드를 실패로 처리한다`);
  }
}

await buildOrFail({
  ...common,
  entryPoints: [join(root, 'src/main/index.ts')],
  outfile: join(root, 'dist/main/index.cjs'),
});

await buildOrFail({
  ...common,
  entryPoints: [join(root, 'src/preload/index.ts')],
  outfile: join(root, 'dist/preload/index.cjs'),
});

// sql.js는 런타임에 자기 옆에서 sql-wasm.wasm을 찾는다. 번들만 내면 앱이 기동 중 죽는다
// (감지기는 통과한다 — 테스트는 node_modules에서 직접 읽기 때문이다).
const wasmSource = join(root, 'node_modules/sql.js/dist/sql-wasm.wasm');
if (!existsSync(wasmSource)) throw new Error(`sql-wasm.wasm을 찾을 수 없다: ${wasmSource}`);
cpSync(wasmSource, join(root, 'dist/main/sql-wasm.wasm'));

if (existsSync(webDist)) {
  mkdirSync(join(root, 'dist/renderer'), { recursive: true });
  cpSync(webDist, join(root, 'dist/renderer'), { recursive: true });
  console.log('renderer: apps/web/dist 복사 완료');
} else {
  console.warn('⚠ apps/web/dist 없음 — 먼저 web을 빌드해야 셸이 화면을 띄운다');
}
