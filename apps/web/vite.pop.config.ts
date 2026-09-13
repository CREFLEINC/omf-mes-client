import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

import { apiProxy } from './vite.api-proxy';

/**
 * 개발 서버가 **POP 진입 문서를 돌려주게** 한다.
 *
 * vite 의 SPA 되돌림은 진입 문서가 `index.html` 하나라고 보고 그것을 돌려준다. 그대로 두면
 * 이 설정으로 띄운 서버에서도 관리웹 번들이 서고, POP 번들은 아무 주소로도 열리지 않는다.
 *
 * ⚠ **문서 요청만 돌려준다.** 모듈·자원 요청(`/src/...`·`/@vite/...`)까지 바꾸면 번들이
 * 뜨지 않는다 — 그래서 브라우저가 화면을 달라고 한 요청(`Accept: text/html`)만 고른다.
 */
const popDevEntry = (): Plugin => ({
  name: 'pop-dev-entry',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      /* ⚠ 백엔드 프록시 경로는 건드리지 않는다 — 바꾸면 API 요청이 화면 문서로 답한다. */
      if (req.url?.startsWith('/api') !== true && req.headers.accept?.includes('text/html')) {
        req.url = '/pop.html';
      }
      next();
    });
  },
});

/**
 * POP 셸 전용 빌드·개발 서버 — 진입 문서가 `pop.html`이고 산출물이 `dist-pop`이다.
 *
 * ⛔ **관리웹 빌드(`vite.config.ts`)와 산출물을 가른다.** 한 벌로 두면 `apps/pop`이 싣는
 * 것이 관리웹 번들이 되어, 설치본이 켜질 때 관리웹 화면이 먼저 서고 단말이 쓰지 않는 화면이
 * 함께 실린다(`src/app/pop-main.tsx` 머리말).
 *
 * ⚠ 관리웹 빌드는 이 파일을 읽지 않는다 — `pnpm build`의 동작은 그대로다.
 *
 * ## 개발 중 POP 화면을 여는 길
 *
 * `pnpm --filter @omf-mes/web dev:pop` → `http://localhost:5174/pop/...`
 *
 * 관리웹 라우트 표는 POP 라우트를 더 이상 펼쳐 넣지 않으므로(#752), 브라우저 확인은 이
 * 서버로 한다. 모바일이 자기 앱에서 자기 dev 서버를 띄우는 것과 같은 형태이며, **확인
 * 대상이 실제로 단말에 나가는 번들**이라는 점에서 이전보다 낫다.
 *
 * ⚠ **포트를 관리웹(5173)과 가른다** — 두 셸을 동시에 띄우는 일이 잦다. 다만 **고정하지
 * 않는다**: 이 저장소는 워크트리 여럿이 동시에 돌아 5174도 이미 물려 있을 수 있고
 * (실측), 고정하면 그때 서버가 아예 뜨지 않는다. 밀리면 vite 가 다음 포트로 옮겨 가며
 * 터미널에 실제 주소를 찍는다 — **그 주소를 쓴다.**
 */
/**
 * 설치본이 부를 기준 URL — **셸 자신의 주소**다(`apps/pop/src/main/api-relay.ts`).
 *
 * ⭐ 화면이 `pop://app/api/...` 를 부르면 셸이 그 요청을 백엔드로 대신 보낸다. 화면이 실서버
 *    절대 주소를 직접 부르면 `pop://app` 이 늘 「다른 출처」라 백엔드의 허용 헤더가 없는 한
 *    응답을 읽지 못한다 — 안드로이드가 `CAP_NATIVE_HTTP` 로 푼 것과 같은 자리다.
 *
 * ⚠ 이 값이 기본이므로 **굽는 사람은 `POP_API_TARGET` 으로 백엔드 원점을 줘야 한다.**
 *   주지 않으면 릴리스 빌드가 멈춘다(`apps/pop/scripts/api-target.mjs`).
 */
const RELAY_BASE_URL = 'pop://app/api';

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  /*
   * ⛔ **개발 서버에는 걸지 않는다.** `dev:pop` 은 브라우저에서 열리므로 `pop://app` 을 부를
   *    수 없고, `/api` 프록시가 그 자리를 대신한다 — 기본을 바꾸면 개발 확인이 통째로 죽는다.
   *
   * ⚠ 사람이 준 값이 이긴다. 목을 가리키는 설치본을 굽던 기존 레시피가 그대로 선다.
   */
  const bakeRelayBase = command === 'build' && (env.VITE_API_BASE_URL ?? '') === '';

  return {
    plugins: [react(), popDevEntry()],
    define: bakeRelayBase
      ? { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(RELAY_BASE_URL) }
      : {},
    server: {
      port: 5174,
      proxy: apiProxy(env.VITE_API_PROXY_TARGET),
    },
    build: {
      outDir: 'dist-pop',
      emptyOutDir: true,
      rollupOptions: {
        input: 'pop.html',
      },
    },
  };
});
