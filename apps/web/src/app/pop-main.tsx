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
/*
 * ⭐ **POP 셸의 스타일시트.** `app.css`는 관리웹과 함께 쓰는 것이고, 단말 전용 규칙은 이쪽에
 * 둔다 — 모바일 셸이 `apps/mobile/src/app/app.css`를 자기 진입점에서만 읽는 것과 같은 형태다.
 * 근거는 그 파일 머리말에 있다.
 */
import './pop.css';

import { StrictMode, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router';

import { popRoutes } from '../routes/pop';
import { applyPopFit } from '../patterns/pop-fit';
import { PopLogoutButton } from '../patterns/pop-logout';
import { PopScreenNavButton } from '../patterns/pop-screen-nav';
import { PopIdentityProvider, UNKNOWN_POP_IDENTITY } from '../patterns/pop-identity';
import { AppProviders } from './providers';

/**
 * 셸이 아직 채우지 못하는 단말 신원의 자리.
 *
 * ⛔ **개발 모드에서는 이 겹을 씌우지 않는다.** `AppProviders` 가 개발용 신원 공급자를
 * 이미 세우는데(`patterns/pop-dev-identity`), 그 «안쪽» 에 이 겹을 한 번 더 씌우면 안쪽이
 * 이겨 단말이 도로 「모름」이 된다 — 그러면 저장·발행이 전부 「단말이 확인되지 않았습니다」로
 * 잠긴다(2026-09-08 설치본에서 실측).
 *
 * ⛔ **가름은 `MODE` 로 한다.** `import.meta.env.DEV` 는 개발 서버에서만 참이라
 * `--mode development` 로 구운 확인용 설치본에서 조용히 거짓이 됐다. 이 저장소의 빌드 시점
 * 가름은 `MODE === 'development'` 한 표기로 통일돼 있다(`pop-dev-guard.test.ts`).
 */
const PopShellIdentity = ({ children }: { children: ReactNode }) =>
  import.meta.env.MODE === 'development' ? (
    children
  ) : (
    <PopIdentityProvider value={UNKNOWN_POP_IDENTITY}>{children}</PopIdentityProvider>
  );

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

/**
 * 화면 위에 늘 서 있는 것 — **화면 이동**과 **사용자 전환** 두 자리다(공유계약 G-34).
 *
 * ⭐ **길 위에 두어야 길을 안다.** 라우터 «안» 겹이라 지금 어느 화면인지 알 수 있고, 그래야
 * 진입 화면에서 스스로 빠질 수 있다. 라우터 밖에 두면 주소를 직접 읽어야 하고, 화면을 옮겨도
 * 다시 그려지지 않는다.
 */
const PopChrome = () => (
  <>
    <Outlet />
    <PopScreenNavButton />
    <PopLogoutButton />
  </>
);

const popRouter = createBrowserRouter([
  {
    element: <PopChrome />,
    children: [
      { path: '/', element: <Navigate to={POP_ENTRY_PATH} replace /> },
      ...popRoutes,
      /*
       * 알 수 없는 주소는 진입 화면으로 되돌린다. 키오스크에는 주소창도 뒤로가기도 없어,
       * 여기서 되돌리지 않으면 빈 화면 앞에서 단말이 멈춘다.
       */
      { path: '*', element: <Navigate to={POP_ENTRY_PATH} replace /> },
    ],
  },
]);

/*
 * ⚠ **개발 빌드에서만 듣는 되돌림 단축키(`Ctrl+Alt+H`).** 화면 이동 선택기는 진입 화면
 * 안에만 있어, 다른 화면으로 나가면 사번 입력 화면으로 돌아올 길이 없다 — 키오스크에는
 * 주소창도 뒤로가기도 없기 때문이다.
 *
 * ⛔ **화면에 버튼을 두지 않는다.** 처음에는 떠 있는 버튼으로 두었는데 어느 자리에 놓아도
 * 화면마다 다른 조작 버튼을 가렸다(실측). 단축키는 무엇도 가리지 않는다.
 *
 * ⛔ **`MODE`로 가른다.** 빌드 시점에 상수로 접혀 배포 번들에서 이 가지째 걷힌다 —
 * 현장 단말에서 이 손짓이 통하면 작업자가 작업 중에 세션을 버릴 수 있다.
 *
 * ⭐ **사번은 놓지 않는다**(사용자 지시 2026-09-08). 사번을 비우는 것은 이제 머리줄의
 *    **로그아웃**이 맡는다 — 이 손짓은 「사번 확인을 마친 그 화면으로 돌아간다」이지
 *    「작업자를 바꾼다」가 아니다. 그래서 문서를 다시 열지 않고 **라우터로만** 옮긴다.
 */
const PopDevHomeShortcut = () => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // `event.key` 는 배열(레이아웃)에 따라 달라지므로 물리 키(`code`)로 판정한다.
      if (!event.ctrlKey || !event.altKey || event.code !== 'KeyH') return;

      event.preventDefault();
      window.history.pushState(null, '', POP_ENTRY_PATH);
      window.dispatchEvent(new PopStateEvent('popstate'));
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return null;
};

/*
 * 화면을 단말 크기에 맞춘다. **라우터를 세우기 전에 건다** — 첫 그림부터 맞은 크기로 서야
 * 열자마자 넘쳤다가 줄어드는 것이 보이지 않는다(`patterns/pop-fit`).
 */
applyPopFit();

const container = document.getElementById('root');
if (!container) {
  throw new Error('root 요소가 pop.html에 없습니다');
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <PopShellIdentity>
        <RouterProvider router={popRouter} />
        {import.meta.env.MODE === 'development' ? <PopDevHomeShortcut /> : null}
      </PopShellIdentity>
    </AppProviders>
  </StrictMode>,
);
