// main·preload를 CommonJS로 번들한다 — Electron의 preload는 ESM을 안정적으로 받지 않는다.
// 렌더러는 apps/web 빌드 산출물을 그대로 복사해 쓴다(POP 화면 구현은 #441 범위 밖).
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
/*
 * 렌더러 산출물. **POP 전용 빌드(`dist-pop`)를 먼저 찾는다** — 관리웹 번들(`dist`)을 실으면
 * 설치본이 켜질 때 관리웹 화면이 서고 단말이 쓰지 않는 화면이 함께 실린다
 * (`apps/web/src/app/pop-main.tsx` 머리말).
 *
 * ⚠ 없으면 예전처럼 `dist`로 물러선다 — 이 변경 전의 빌드 순서를 쓰던 사람이 갑자기
 * 막히지 않게 한다. 물러섰다는 사실은 아래에서 말한다.
 */
const popDist = join(root, '../web/dist-pop');
const adminDist = join(root, '../web/dist');
const webDist = existsSync(popDist) ? popDist : adminDist;

// 릴리스 여부. 배포본에는 소스맵을 싣지 않고, 렌더러 부재를 실패로 처리한다.
const isRelease = process.env.POP_RELEASE === '1';

const common = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['electron'],
  sourcemap: !isRelease,
  // `import.meta`는 CJS 출력에서 비는데 esbuild는 경고로만 알린다. 비면 preload·renderer
  // 경로가 조용히 어긋나 창이 빈 화면으로 뜨므로, 이 경고 하나만 실패로 올린다.
  // (경고 전체를 올리면 정당한 경고 하나에 가드를 통째로 끄는 우회가 나온다.)
  logOverride: { 'empty-import-meta': 'error' },
};

await build({
  ...common,
  entryPoints: [join(root, 'src/main/index.ts')],
  outfile: join(root, 'dist/main/index.cjs'),
});

await build({
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
  const rendererDir = join(root, 'dist/renderer');
  /*
   * ⛔ **덮어쓰지 말고 비우고 채운다.** 이어 붙이면 지난 빌드의 파일이 남아, 관리웹 번들을
   * 실었는데도 예전 `pop.html`이 남아 있어 「POP 번들을 실었다」로 보이는 일이 생긴다(실측).
   */
  rmSync(rendererDir, { recursive: true, force: true });
  mkdirSync(rendererDir, { recursive: true });
  cpSync(webDist, rendererDir, { recursive: true });

  // 셸은 `index.html`을 찾는다(없는 경로의 SPA 폴백도 그것으로 돌아온다).
  // POP 전용 빌드의 진입 문서는 `pop.html`이라 그 이름으로 한 벌 더 둔다.
  const popHtml = join(rendererDir, 'pop.html');
  if (existsSync(popHtml)) cpSync(popHtml, join(rendererDir, 'index.html'));
  else console.warn('⚠ 관리웹 번들을 실었다 — 앱이 켜지면 관리웹 화면이 뜬다. `pnpm --filter @omf-mes/web build:pop`을 쓰라');

  console.log(`renderer: ${webDist === popDist ? 'apps/web/dist-pop' : 'apps/web/dist'} 복사 완료`);
} else if (isRelease) {
  // 렌더러 없는 인스톨러는 설치되고 실행되지만 화면이 빈다 — 이 셸이 두 번 고친 그 증상이다.
  // 릴리스 경로에서는 경고로 넘기지 않는다.
  throw new Error(
    `렌더러 산출물이 없다: ${popDist} · ${adminDist}\n` +
      '릴리스 빌드는 렌더러 없이 만들지 않는다. 먼저 `pnpm --filter @omf-mes/web build:pop`을 실행하라.',
  );
} else {
  console.warn('⚠ apps/web/dist 없음 — 셸만 뜨고 화면은 비어 있다 (개발 편의로 허용)');
}
