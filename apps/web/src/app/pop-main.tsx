/*
 * POP 셸의 진입 파일 — **관리웹과 다른 번들이다.**
 *
 * ## 왜 진입점을 가르나
 *
 * `apps/pop`(Electron 셸)은 지금까지 `apps/web/dist`를 **통째로** 실었다. 코드가 1벌인 것은
 * 「도메인 타입·검증·API 클라이언트·디자인 토큰을 공유한다」는 뜻이지 「한 번들로 나간다」는
 * 뜻이 아닌데, 산출물이 한 벌이라 두 결과가 따라왔다.
 *
 * 1. **설치본이 켜지면 관리웹이 뜬다.** 셸이 여는 주소 `/`가 관리웹 셸(`AppLayout`)의
 *    것이라, 산업용 패널 PC에서 사이드바 달린 화면이 먼저 선다.
 * 2. **단말에 관리웹 화면 전부가 실린다.** 현장 단말이 쓰지 않는 화면이 설치본의 대부분을
 *    차지한다(실측 — 화면 코드 2.5MB → 0.5MB).
 *
 * 그래서 이 파일이 **POP 라우트 표만** 세우고 루트를 진입 화면(P-CO-01)으로 보낸다.
 *
 * ⚠ **관리웹 라우트 표는 POP 라우트를 더 이상 펼쳐 넣지 않는다**(#752). 그래서 개발 중
 * 브라우저로 POP 화면을 여는 길도 이 번들로 옮겨졌다 — `pnpm --filter @omf-mes/web dev:pop`
 * 이 `pop.html`을 5174 포트로 띄운다(`vite.pop.config.ts`). 확인 대상이 실제로 단말에
 * 나가는 번들이라는 점에서 이전보다 낫다.
 *
 * ⛔ **탭 제목을 코드에서 맞추지 않는다.** 셸마다 진입 문서가 따로이므로 제목도 그 문서가
 * 갖는다 — `pop.html`이 「OMF-MES POP」, 관리웹 `index.html`이 「OMF-MES 관리웹」,
 * 모바일 `apps/mobile/index.html`이 「OMF-MES 모바일」이다. 주소로 제목을 가르던 장치
 * (`app/document-title.ts`)는 「한 번들에 셸이 둘」인 동안만 필요했고, #752 로 사라졌다.
 */
import '@crefle/web-ui/styles/index.css';
import '@crefle/web-ui/css';
import './app.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';

import { popRoutes } from '../routes/pop';
import {
  PopIdentityProvider,
  UNKNOWN_POP_IDENTITY,
  type PopIdentity,
} from '../patterns/pop-identity';
import { AppProviders } from './providers';

/** 브라우저 수동 검증에서만 쓰는 합성 셸 값. 설치본에는 들어가지 않는다. */
const DEV_POP_IDENTITY: PopIdentity = {
  terminalId: 10,
  processId: 1001,
  workerNo: '100027',
};

const popIdentity = import.meta.env.DEV ? DEV_POP_IDENTITY : UNKNOWN_POP_IDENTITY;

if (import.meta.env.DEV && window.pop === undefined) {
  window.pop = {
    rendition: {
      save: async (_bytes, label) => `dev://print/${encodeURIComponent(label)}`,
    },
  };
}

/**
 * 단말을 켰을 때 맨 처음 서는 화면 — 사번 경량 인증(P-CO-01).
 *
 * ⛔ **주소를 여기서 지어내지 않는다.** 라우트 표에 실제로 있는 경로여야 하고, 아래 시험이
 * 그것을 지킨다 — 화면이 옮겨지면 이 상수도 함께 고쳐야 한다.
 */
const POP_ENTRY_PATH = '/pop/worker-assignment';

const popRouter = createBrowserRouter([
  { path: '/', element: <Navigate to={POP_ENTRY_PATH} replace /> },
  ...popRoutes,
  /*
   * 알 수 없는 주소는 진입 화면으로 되돌린다. 키오스크에는 주소창도 뒤로가기도 없어,
   * 여기서 되돌리지 않으면 빈 화면 앞에서 단말이 멈춘다.
   */
  { path: '*', element: <Navigate to={POP_ENTRY_PATH} replace /> },
]);

const container = document.getElementById('root');
if (!container) {
  throw new Error('root 요소가 pop.html에 없습니다');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <PopIdentityProvider value={popIdentity}>
        <RouterProvider router={popRouter} />
      </PopIdentityProvider>
    </AppProviders>
  </StrictMode>,
);
