import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

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
      if (req.headers.accept?.includes('text/html')) {
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
export default defineConfig({
  plugins: [react(), popDevEntry()],
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist-pop',
    emptyOutDir: true,
    rollupOptions: {
      input: 'pop.html',
    },
  },
});
