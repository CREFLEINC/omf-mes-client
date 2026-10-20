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
/* ⛔ 화면을 싣는 import 보다 위에 둔다 — 아래 import 들이 문구를 붙잡기 전에 언어를 정한다. */
import './pop-locale';

import { StrictMode, useEffect, useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, RouterProvider, createBrowserRouter, useLocation } from 'react-router';

import { popRoutes } from '../routes/pop';
import { PopConsoleShell, popShellLayoutOf } from '../patterns/pop-console';
import { applyPopFit } from '../patterns/pop-fit';
import {
  PopRegistrationProvider,
  usePopRegistration,
  useRefreshPopTerminalOnScreenEntry,
} from '../patterns/pop-registration';
import { RegistrationPanel } from '../screens/worker-assignment/registration-panel';
import { WorkerSignInDialog } from '../screens/worker-assignment/sign-in-dialog';
import { printSampleLotLabel } from '../screens/pop-material-lot-label/sample-print';
import { currentTerminalToken, readTerminalToken } from '../patterns/pop-terminal-token';
import { AppProviders } from './providers';

/**
 * **등록을 마치기 전에는 업무로 넘기지 않는다**(공유계약 F-4 · P-CO-01 §3-A).
 *
 * ⛔ **라우터 «밖»에 세운다.** 안에 두면 주소만 알면 업무 화면이 먼저 그려지고, 그 화면이
 * 조회를 시작한다 — 「등록 전에는 서버 업무 조회를 열지 않는다」가 깨진다.
 *
 * ⭐ **보관된 토큰이 있으면 스스로 확인한다.** 단말을 껐다 켤 때마다 설치 담당자를 부를 수는
 * 없다. 보관된 토큰도 새 토큰과 **같은 검증 길**을 지난다 — 세대가 폐기됐으면 여기서
 * 걸러져 등록 패널이 다시 선다.
 */
const PopRegistrationGate = ({ children }: { children: ReactNode }) => {
  const registration = usePopRegistration();
  const { phase, verify } = registration;
  /**
   * 이미 스스로 확인해 본 보관 토큰. **한 번만 시도한다.**
   *
   * ⛔ **없으면 무한히 되돈다.** 검증이 실패하면 상태가 `unregistered` 로 돌아오는데, 그것이
   *    바로 이 effect 의 조건이다 — 보관 토큰은 그대로 남아 있으므로 즉시 또 물어보고, 또
   *    실패하고, 다시 돌아온다. 화면은 「확인하는 중…」 과 실패 문구 사이를 끝없이 오가고
   *    설치 담당자는 입력조차 할 수 없다(실측 2026-09-12 · 사용자 지적 — 실 서버 설치본).
   */
  const attempted = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== 'unregistered') return;

    const stored = currentTerminalToken();

    if (stored === null || attempted.current === stored) return;

    attempted.current = stored;

    /* ⚠ 사람이 넣은 값이 아니다 — 실패 문구가 그 사실을 말해야 한다(#1137). */
    void verify(stored, 'stored');
  }, [phase, verify]);

  if (phase !== 'ready') return <RegistrationPanel />;

  return <>{children}</>;
};

/*
 * ⛔ 개발용 브라우저 실행에는 프린터가 없다 — 통로는 열어 두되 인쇄는 «실패»로 돌려준다.
 *    전에는 경로를 돌려줘 성공으로 접혔고, 라벨이 안 나왔는데 「인쇄했습니다」가 떴다(2단계 검증 2026-10-16).
 */
if (import.meta.env.DEV && window.pop === undefined) {
  window.pop =
    import.meta.env.VITE_POP_VIRTUAL_PRINTERS === '1'
      ? virtualPrinterShell()
      : {
          rendition: {
            save: async () => {
              throw new Error('브라우저 실행 — 프린터로 보내지 않았습니다.');
            },
          },
        };
}

/**
 * 개발용 가상 프린터 — `VITE_POP_VIRTUAL_PRINTERS=1` 로 띄운 브라우저 POP 에서만 선다(2단계 검증 2026-10-16).
 * 설치본 없이도 프린터 선택·기억·인쇄 성공/실패·재인쇄를 끝까지 확인하려는 것이다.
 *
 * - 1번(기본 출력 대상)은 «출력»한다 — 그림 라벨을 새 탭에 연다(팝업이 막히면 열지 않고 성공만 돌려준다).
 * - 2번은 «꺼진» 프린터다 — 인쇄를 실패로 돌려준다.
 *
 * ⛔ 설치본에는 없다(`window.pop` 을 셸이 심으면 이 자리를 지나지 않는다). 켜지 않으면 위의 «실패» 통로 그대로다.
 */
function virtualPrinterShell() {
  const OK = 'VIRTUAL-1';
  const OFF = 'VIRTUAL-2';
  return {
    printers: {
      list: async () => ({
        printers: [
          { name: OK, displayName: '가상 프린터 1 (출력됨)' },
          { name: OFF, displayName: '가상 프린터 2 (꺼짐 — 인쇄 실패)' },
        ],
        target: OK,
      }),
      capabilities: async () => ({ raw: false, selectable: true }),
    },
    rendition: {
      save: async (
        bytes: Uint8Array,
        label: string,
        _now: string,
        format: string,
        printerName?: string,
      ) => {
        const to = printerName ?? OK;
        if (to === OFF) throw new Error('가상 프린터 2가 꺼져 있어 인쇄하지 못했습니다.');
        if (to !== OK) throw new Error(`가상 프린터 「${to}」를 찾을 수 없습니다.`);
        if (format === 'png' || format === 'pdf') {
          const type = format === 'png' ? 'image/png' : 'application/pdf';
          window.open(URL.createObjectURL(new Blob([bytes as BlobPart], { type })), '_blank');
        }
        return `virtual://${to}/${label}.${format}`;
      },
    },
  };
}

/**
 * 단말을 켰을 때 맨 처음 서는 화면 — **홈**(`screens/pop-home`).
 *
 * ⭐ **사번 입력 페이지가 아니다**(현장 지적 2026-10-20). 상용 MES 단말은 켜면 작업장 홈이 서고,
 *    누구로 기록할지는 상태바의 [작업자]가 여는 창에서 필요할 때 정한다. 단말 토큰이 이미 인증을
 *    마쳤으므로(등록 게이트) 사번을 «먼저» 받을 까닭이 없다.
 *
 * ⛔ **주소를 여기서 지어내지 않는다.** 라우트 표에 실제로 있는 경로여야 하고, 아래 시험이
 * 그것을 지킨다 — 화면이 옮겨지면 이 상수도 함께 고쳐야 한다.
 */
const POP_ENTRY_PATH = '/pop/home';

/**
 * 화면 위에 늘 서 있는 것 — **작업장 콘솔**(`patterns/pop-console`).
 *
 * ⭐ **모든 화면이 같은 골격 안에 선다.** 상태바의 [홈]·[이전]·위치·[작업자]·[작업 메뉴]가 어느
 *    화면에서나 같은 자리에 있어, 부서마다 쓰는 화면이 달라도 화면을 옮기다 돌아갈 길을 잃지
 *    않는다(현장 지적 2026-10-20). 생산 흐름 화면만 현재작업 패널·단계·액션바를 더 갖는다
 *    (`popShellLayoutOf`).
 *
 * ⭐ **길 위에 두어야 길을 안다.** 라우터 «안» 겹이라 지금 어느 화면인지 알 수 있다.
 *
 * ⭐ **작업자 확인 창은 여기서 넘긴다.** 골격은 `patterns` 라 화면 슬라이스의 창을 부를 수 없다 —
 *    둘을 다 볼 수 있는 셸이 이어 준다.
 */
const PopChrome = () => {
  /* ⭐ 관리웹에서 바꾼 단말 공정·설비가 단말을 다시 켜지 않아도 보이게 한다(#1202). */
  useRefreshPopTerminalOnScreenEntry();

  const { pathname } = useLocation();

  return (
    <PopConsoleShell
      layout={popShellLayoutOf(pathname)}
      renderWorkerSignIn={(onClose) => <WorkerSignInDialog onClose={onClose} />}
    />
  );
};

const popRouter = createBrowserRouter([
  {
    element: <PopChrome />,
    children: [
      { path: '/', element: <Navigate to={POP_ENTRY_PATH} replace /> },
      ...popRoutes,
      /*
       * 알 수 없는 주소는 홈으로 되돌린다. 키오스크에는 주소창도 뒤로가기도 없어,
       * 여기서 되돌리지 않으면 빈 화면 앞에서 단말이 멈춘다.
       */
      { path: '*', element: <Navigate to={POP_ENTRY_PATH} replace /> },
    ],
  },
]);

/*
 * 화면을 단말 크기에 맞춘다. **라우터를 세우기 전에 건다** — 첫 그림부터 맞은 크기로 서야
 * 열자마자 넘쳤다가 줄어드는 것이 보이지 않는다(`patterns/pop-fit`).
 */
applyPopFit();

const container = document.getElementById('root');
if (!container) {
  throw new Error('root 요소가 pop.html에 없습니다');
}

const mount = () => {
  createRoot(container).render(
    <StrictMode>
      <AppProviders>
        <PopRegistrationProvider>
          <PopRegistrationGate>
            <RouterProvider router={popRouter} />
          </PopRegistrationGate>
        </PopRegistrationProvider>
      </AppProviders>
    </StrictMode>,
  );
};

/*
 * ⭐ **단말 토큰을 먼저 읽고 화면을 세운다**(#999). 설계가 POP 요청을 단말 토큰으로
 *    인증하도록 정했는데(`Authorization: Bearer <단말 토큰>`), 셸에서 읽어 오는 것은
 *    프로세스를 건너가므로 «비동기» 이고 요청에 헤더를 붙이는 자리는 «동기» 다.
 *
 * ⛔ **순서를 뒤집지 않는다.** 먼저 세우면 첫 조회들이 토큰 없이 나가 거절되고, 화면은
 *    잠깐 「단말이 확인되지 않았습니다」를 보였다가 스스로 낫는 것처럼 움직인다 — 진짜
 *    미등록 단말과 구분되지 않는다.
 *
 * ⚠ 읽기는 실패해도 던지지 않는다(`patterns/pop-terminal-token`). 셸 밖(브라우저로 여는
 *   개발 확인)에서도 통로가 없을 뿐이므로 그대로 화면을 세운다.
 */
/*
 * 셸 진단(Ctrl+Alt+P · 80 × 30)이 부르는 자리 — 견본을 **실제 발행과 같은 서식·통로**로 찍는다
 * (`sample-print` 머리말). 셸이 `executeJavaScript` 로 부른다.
 */
window.__popPrintSampleLotLabel = printSampleLotLabel;

void readTerminalToken().then(mount);
