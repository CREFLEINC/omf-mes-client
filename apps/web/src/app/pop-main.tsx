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
 * `main.tsx`(관리웹)는 그대로 두었다 — 관리웹 번들에서 POP 라우트를 빼는 것은 개발 중
 * 브라우저로 POP 화면을 여는 경로를 없애는 일이라, 이 변경의 범위 밖이다.
 *
 * ⛔ **탭 제목 맞추기(`syncDocumentTitle`)를 여기서 걸지 않는다.** 그것은 「한 번들에 셸이
 * 둘이라 제목이 하나뿐」인 사정을 메우는 장치이고, 이 번들은 `pop.html`이 자기 제목을 갖는다.
 */
import '@crefle/web-ui/styles/index.css';
import '@crefle/web-ui/css';
import './app.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router';

import { popRoutes } from '../routes/pop';
import { AppProviders } from './providers';

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
      <RouterProvider router={popRouter} />
    </AppProviders>
  </StrictMode>,
);
