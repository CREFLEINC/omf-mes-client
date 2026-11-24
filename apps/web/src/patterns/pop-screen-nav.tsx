import { Badge, Button, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAccessiblePopScreens } from './pop-access';
import { usePopIdentity } from './pop-identity';
import { usePopOnline } from './pop-online';
import {
  POP_ENTRY_SCREEN_PATH,
  POP_HOME_PATH,
  POP_SCREEN_GROUPS,
  POP_WORK_ENTRY_PATH,
  type PopScreen,
  type PopScreenGroupKey,
} from './pop-screen-catalog';
import { PuConfirm } from './pop-uniform';
import { usePopTabCounts, usePopWorkCounts, type PopWorkCounts } from './pop-work-counts';
import { PopWorkSteps } from './pop-work-steps';
import { setWorkerSession, useWorkerSession } from './worker-session';

const nav = messages.popChrome.nav;
const remainingText = messages.popChrome.remaining;
const headerText = messages.popChrome.header;
const common = messages.common.connection;

/** 한 화면의 남은 수. 셀 수 없는 화면이거나 수를 모르면 0 — 0 은 어디에도 그리지 않는다. */
export const countOf = (screen: PopScreen, counts: PopWorkCounts['counts']): number =>
  screen.countKey === undefined ? 0 : (counts?.[screen.countKey] ?? 0);

/**
 * 남은 작업 배지 — 중립색(빨강 쓰지 않음). 수는 숨은 글이 읽어 준다. 남은 작업 창은 1~9, 10 이상 「9+」,
 * 묶음·화면 탭은 수 그대로(POP 통일 시안 #295 — 「창고 29」).
 */
const WorkBadge = ({ count, max = 9 }: { count: number; max?: number }) =>
  count > 0 ? (
    <Badge count={count} max={max} tone="neutral" className="pop-work-badge" aria-hidden="true" />
  ) : null;

/** 묶음·화면 탭 건수의 상한 — 사실상 수 그대로 보인다. */
const TAB_COUNT_MAX = 999;

/**
 * 갈 곳의 주소.
 *
 * ⭐ **작업지시 문맥은 주소 하나로만 흐른다**(사용자 승인 2026-09-15). 지금 보는 화면이
 *    작업지시를 달고 있고 갈 화면도 그 인자를 받는 화면이면, 그 값을 그대로 실어 준다. 싣지
 *    않으면 작업자가 자재 투입에서 생산 실적으로 갈 때 「작업지시를 받지 못했다」로 막혀
 *    작업 시작 화면까지 되돌아가야 했다(WIP-CHAIN-01 D10).
 *
 * ⛔ **받는다고 표기된 화면에만 싣는다.** 모르는 화면에 실으면 그 화면이 쓰지 않는 값이 주소에
 *    남고, 뒤에 같은 이름을 쓰게 되면 남이 남긴 값으로 조회가 선다. 표기는 `pop-screen-catalog`.
 */
export const destinationOf = (screen: PopScreen, search: string): string => {
  const workOrderId = new URLSearchParams(search).get('workOrderId');
  const hasWorkOrder = workOrderId !== null && workOrderId !== '';
  /*
   * 작업 단계·작업 중 화면(자재 투입·작업 중단 등)은 W/O 를 고른 뒤에만 연다 — 단계 줄이 잠그는 것과
   * 같다(#291). 홈 바로가기·남은 작업에서 W/O 없이 누르면 ① 작업지시 선택으로 보낸다.
   */
  if (screen.workFlow !== undefined && !hasWorkOrder) return POP_WORK_ENTRY_PATH;
  if (screen.acceptsWorkOrderId !== true || !hasWorkOrder) return screen.path;

  return `${screen.path}?workOrderId=${encodeURIComponent(workOrderId)}`;
};

/**
 * 이동 메뉴가 쓰는 값 한 묶음 — 이동 가능한 화면, 남은 작업 수, 화면으로 가는 길.
 * 공통 메뉴와 홈 화면이 같은 값을 쓴다(둘이 따로 세면 숫자가 어긋난다).
 */
export interface PopNavigation {
  pathname: string;
  search: string;
  access: ReturnType<typeof useAccessiblePopScreens>;
  workCounts: PopWorkCounts;
  /** 남은 작업이 있는 화면 — 많은 순. */
  pending: { screen: PopScreen; count: number }[];
  /**
   * 화면 탭에 붙는 건수 — 남은 작업 수(`countKey`)에 더해, 셀 수 있는 다른 화면의 대기 건수까지(#295 시안).
   * 묶음 건수는 그 묶음 화면 탭 건수의 합이다. 남은 작업 창(`pending`)에는 넣지 않는다.
   */
  tabCount: (screen: PopScreen) => number;
  total: number;
  go: (screen: PopScreen) => void;
}

export const usePopNavigation = (): PopNavigation => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();
  const { workerNo, plantId = null } = usePopIdentity();
  /* 피처 002 — 사번이 확인되고 갈 화면이 정해진 뒤에만 센다(60초 주기). */
  const canCount = workerNo !== null && access.state === 'ready';
  const workCounts = usePopWorkCounts(canCount);
  const tabCounts = usePopTabCounts(
    canCount,
    plantId,
    access.screens.map((screen) => screen.path),
  );
  /* 사번을 비우면(로그아웃) 앞 작업자의 수를 남기지 않는다 — 처음 켰을 때처럼 수 없이(#334 · 리뷰). */
  const pending = (canCount ? access.screens : [])
    .map((screen) => ({ screen, count: countOf(screen, workCounts.counts) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    pathname,
    search,
    access,
    workCounts,
    pending,
    total: pending.reduce((sum, entry) => sum + entry.count, 0),
    tabCount: (screen: PopScreen) =>
      canCount ? countOf(screen, workCounts.counts) + (tabCounts[screen.path] ?? 0) : 0,
    go: (screen: PopScreen) => {
      /* ⛔ 저장하지 않은 입력을 묻지 않는다(G-34) — 확인 창은 정작 물어야 할 자리의 확인까지 넘기게 만든다. */
      if (screen.path === pathname) return;
      void navigate(destinationOf(screen, search));
    },
  };
};

/** 메뉴·홈이 함께 쓰는 선 아이콘(24 격자). */
export const navIcon = (path: ReactNode): ReactNode => (
  <svg
    className="pop-nav-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {path}
  </svg>
);

const HOME_ICON = navIcon(
  <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
);

export const GROUP_ICONS: Record<PopScreenGroupKey, ReactNode> = {
  warehouse: navIcon(
    <>
      <path d="M3 21V9l9-5 9 5v12" />
      <path d="M7 21v-8h10v8M7 17h10" />
    </>,
  ),
  production: navIcon(
    <>
      <path d="M3 21V10l5 3v-3l5 3V6l5-3v18z" />
      <path d="M3 21h18" />
    </>,
  ),
  quality: navIcon(
    <>
      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>,
  ),
  shipping: navIcon(
    <>
      <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>,
  ),
};

const CHEVRON = navIcon(<path d="m6 9 6 6 6-6" />);

/* 사용자 전환 — 두 사람(시안 2026-11-17). */
const USER_ICON = navIcon(
  <>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8M18 14.2a6.5 6.5 0 0 1 3.5 5.8" />
  </>,
);

const REFRESH_ICON = navIcon(
  <>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v5h-5" />
  </>,
);

/* 종료 — 전원 단추(#295 시안). */
/* 단말 재등록 — 사번 입력 카드에 있던 것과 같은 되돌림 화살표(`PuIcon` reset). */
const RE_REGISTER_ICON = navIcon(
  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5" />,
);

/* 설정 — 톱니바퀴. [단말 재등록] · [종료]를 이 안에 모은다(사용자 지시 2026-11-23). */
const SETTINGS_ICON = navIcon(
  <>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

const POWER_ICON = navIcon(
  <>
    <path d="M12 3v8" />
    <path d="M6.4 6.4a8 8 0 1 0 11.2 0" />
  </>,
);

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** 갱신 시각 글 — 단말 시계 기준 「MM-DD HH:mm:ss」(#295 시안). */
export const formatRefreshedAt = (at: Date): string =>
  `${pad2(at.getMonth() + 1)}-${pad2(at.getDate())} ${pad2(at.getHours())}:${pad2(
    at.getMinutes(),
  )}:${pad2(at.getSeconds())}`;

/**
 * POP 화면 끄기(#295 시안 규칙 17). POP 앱(Electron)이면 셸에 앱 종료를 맡기고(`pop.app.quit`), 그 통로가
 * 없는 브라우저·옛 설치본이면 창 닫기를 시도한다 — 브라우저는 스크립트가 연 창이 아니면 닫지 않는다.
 */
export const quitPopScreen = (): void => {
  const shell = (globalThis as { pop?: { app?: { quit?: () => Promise<void> } } }).pop;

  if (typeof shell?.app?.quit === 'function') {
    void shell.app.quit();
    return;
  }

  window.close();
};

/** 맨 위 줄 — 제품 이름 · 단말 | 온라인 · 프린터 · [사번(누르면 사용자 전환)] · [새로고침] 갱신 시각 · [종료]. */
const TopBar = ({
  terminalCode,
  printer,
  statusRef,
  printerRef,
  onReRegister,
  onLogin,
}: {
  terminalCode: string | null;
  printer: ReactNode;
  statusRef?: (element: HTMLElement | null) => void;
  printerRef?: (element: HTMLElement | null) => void;
  onReRegister?: () => void;
  onLogin?: () => void;
}) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { workerNo, equipment } = usePopIdentity();
  const session = useWorkerSession();
  const isOnline = usePopOnline();
  const queryClient = useQueryClient();
  /* 화면 자료를 마지막으로 받은 때 — 화면을 열 때와 [새로고침]이 끝날 때 적는다. */
  const [refreshedAt, setRefreshedAt] = useState(() => new Date());
  const [isExitOpen, setExitOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRefreshedAt(new Date());
  }, [pathname]);

  /* 설정 메뉴는 바깥을 누르거나 Esc 로 닫는다(관리웹 「⋯」 메뉴와 같은 규칙). */
  useEffect(() => {
    if (!isSettingsOpen) return undefined;
    const handlePointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && settingsRef.current?.contains(event.target) === true) return;
      setSettingsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setSettingsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsOpen]);

  /* 이름은 지금 사번과 같은 사람의 세션일 때만 붙인다 — 다른 사번의 이름을 빌려 오지 않는다. */
  const workerName =
    session !== null && session.worker.workerNo === workerNo ? session.worker.workerName : null;

  return (
    <div className="pop-nav-top">
      {/* 연결 표시는 모든 화면에 같게 선다(사용자 지시 2026-11-17 · #291) — 줄 맨 앞, 제품 이름 왼쪽(사용자 지시 2026-11-20 · #334). */}
      <Chip variant="status" size="md" status={isOnline ? 'success' : 'warning'}>
        {isOnline ? common.online : common.offline}
      </Chip>
      <span className="pop-nav-top__brand">{nav.brand}</span>
      {/* 단말은 제품 이름 바로 오른쪽(사용자 지시 2026-11-17). 나머지 상태·작업자는 오른쪽 끝에 모은다. */}
      <span className="pop-nav-top__chip pop-nav-top__terminal">
        {terminalCode === null
          ? headerText.terminalUnknown
          : headerText.terminalLabel(terminalCode)}
      </span>
      {/* 설비는 단말 옆에 늘 보인다 — 홈 포함(POP 통일 시안 #295 · 사용자 지시 2026-11-19). */}
      {equipment !== null && (
        <span
          className="pop-nav-top__chip pop-nav-top__equipment"
          title={headerText.equipmentTitle(
            equipment.equipmentCode ?? '',
            equipment.equipmentName ?? '',
          )}
        >
          {headerText.equipmentLabel(
            equipment.equipmentCode ?? `#${String(equipment.equipmentId)}`,
            equipment.equipmentName ?? '',
          )}
        </span>
      )}
      {/* 화면이 보내는 미전송 표시(`PopTopStatus`) 자리 — 미전송이 있을 때만 선다. */}
      <span className="pop-nav-top__status" ref={statusRef} />
      {/* 화면이 보내는 프린터 칩(`PopTopPrinter`) 자리 — 서면 아래 기본 프린터 표시는 감춘다. */}
      <span className="pop-nav-top__screen-printer" ref={printerRef} />
      {printer !== null && <span className="pop-nav-top__printer">{printer}</span>}
      {/*
       * 사번 — 있으면 「이름 (사번) | 전환」: 누르면 작업자 변경(교대 · 사용자 지시 2026-11-17 · #291). 현재 활성 사번만 지우고
       * 홈으로 간다. 저장 기록과 오프라인 큐의 사번은 바꾸지 않는다(G-34 · D-5).
       * 없으면 「사번 미입력 | 로그인」: 누르면 사번 입력 창을 연다(사용자 지시 2026-11-20 · #334). 사번 전 잠금을 받지 않는다.
       */}
      <Button
        /* 사번이 없으면 빨강 강조(남은 작업 단추와 같은 빨간 테두리 · 글자 — 사용자 지시 2026-11-20). */
        className={workerNo === null ? 'pop-logout pop-nav-top__login' : 'pop-logout'}
        variant="outlined"
        size="md"
        title={workerNo === null ? undefined : headerText.workerTitle(workerNo, workerName)}
        aria-label={`${workerNo === null ? messages.popChrome.login : messages.popChrome.userSwitch}: ${
          workerNo === null ? headerText.workerUnset : headerText.workerLabel(workerNo, workerName)
        }`}
        disabled={workerNo === null && onLogin === undefined}
        onClick={() => {
          if (workerNo === null) {
            onLogin?.();
            return;
          }
          /* [전환] — 지금 작업자를 지우고 바로 사번 입력 창을 연다(사용자 지시 2026-11-20). [취소]하면 사번 없는 채로 둔다. */
          setWorkerSession(null);
          void navigate(POP_ENTRY_SCREEN_PATH, { replace: true });
          onLogin?.();
        }}
      >
        {USER_ICON}
        {workerNo === null ? headerText.workerUnset : headerText.workerLabel(workerNo, workerName)}
        {/* 시안(사용자 지시 2026-11-17): 「이름 (사번) | 전환」 — 세로선 뒤 「전환」이 누르면 할 일을 알린다. */}
        <span className="pop-nav-top__switch" aria-hidden>
          {workerNo === null ? messages.popChrome.login : messages.popChrome.switchShort}
        </span>
      </Button>
      {/*
       * [새로고침] — 모든 화면 같은 자리(사용자 지시 2026-11-17 · #291). 지금 화면이 보이는 자료만 서버에서
       * 다시 받는다. ⛔ 페이지를 다시 읽지 않는다 — 그러면 입력 중이던 수량·스캔이 사라진다.
       */}
      <Button
        className="pop-logout"
        variant="outlined"
        size="md"
        onClick={() => {
          void queryClient.invalidateQueries().then(() => {
            setRefreshedAt(new Date());
          });
        }}
      >
        {REFRESH_ICON}
        {messages.popChrome.refresh}
      </Button>
      {/* 날짜와 시각을 나눠 두어, 좁은 폭(1024)에서는 두 줄로 접어 단말·설비 칩 자리를 남긴다. */}
      <span className="pop-nav-top__refreshed">
        <span>{messages.popChrome.refreshedAt(formatRefreshedAt(refreshedAt).slice(0, 5))}</span>{' '}
        <span>{formatRefreshedAt(refreshedAt).slice(6)}</span>
      </span>
      {/*
       * [설정] — 맨 위 줄 오른쪽 끝의 톱니 단추 하나(사용자 지시 2026-11-23). 드물게 쓰는 [단말 재등록] · [종료]를
       * 이 안에 모은다. [단말 재등록]은 설치 담당자용 보조 조작이라 전처럼 사번 입력 전에만 선다(#334).
       */}
      <div className="pop-nav-top__settings" ref={settingsRef}>
        <Button
          className="pop-logout pop-nav-top__settings-button"
          variant="outlined"
          size="md"
          aria-label={messages.popChrome.settings}
          title={messages.popChrome.settings}
          aria-expanded={isSettingsOpen}
          aria-haspopup="menu"
          onClick={() => {
            setSettingsOpen((open) => !open);
          }}
        >
          {SETTINGS_ICON}
        </Button>
        {isSettingsOpen && (
          <div className="pop-nav-top__settings-menu" role="menu" aria-label={messages.popChrome.settings}>
            {workerNo === null && onReRegister !== undefined && (
              <Button
                className="pop-logout"
                variant="outlined"
                size="md"
                role="menuitem"
                onClick={() => {
                  setSettingsOpen(false);
                  onReRegister();
                }}
              >
                {RE_REGISTER_ICON}
                {messages.workerAssignment.registration.reRegister}
              </Button>
            )}
            {/* [종료] — 확인 창을 거친다(#295 시안 규칙 17). */}
            <Button
              className="pop-logout pop-nav-top__exit"
              variant="outlined"
              size="md"
              role="menuitem"
              onClick={() => {
                setSettingsOpen(false);
                setExitOpen(true);
              }}
            >
              {POWER_ICON}
              {messages.popChrome.exit.button}
            </Button>
          </div>
        )}
      </div>
      {isExitOpen && (
        <PuConfirm
          title={messages.popChrome.exit.title}
          confirmLabel={messages.popChrome.exit.confirm}
          onCancel={() => {
            setExitOpen(false);
          }}
          onConfirm={() => {
            setExitOpen(false);
            quitPopScreen();
          }}
        >
          {messages.popChrome.exit.body}
        </PuConfirm>
      )}
    </div>
  );
};

/**
 * **POP 공통 이동 메뉴**(#291) — 맨 위 줄, 업무 묶음 줄(+ [남은 작업]), 화면 탭 줄.
 *
 * ⭐ 단말에는 주소창도 뒤로가기도 없다. 화면을 옮기는 길이 화면마다 따로 있으면 작업자가
 *    「여기서는 어디로 갈 수 있나」를 화면마다 새로 배워야 하므로 셸(`app/pop-main`)에서 한 번만 그린다.
 *
 * ⭐ 묶음을 누르면 그 묶음의 첫 화면(지금 화면이 그 묶음이면 그대로)으로 옮기고 화면 탭 줄이 바뀐다
 *    (사용자 지시 2026-11-17 · #291).
 *
 * ⚠ 못 갈 때는 감추지 않고 사유를 보인다(G-2). 묶음이 통째로 사라지면 「원래 이동이 안 되는
 *    단말인가」와 「지금 확인이 안 되는가」를 구별할 수 없다.
 *
 * ⛔ 사번이 없으면(맨 위 줄 [로그인]으로 넣기 전) 묶음 · 홈 · [남은 작업]을 잠근다(감추지 않음 · G-2) — 사번 없이 다른 화면으로
 *    가는 길이 생기지 않게(omf-all-around#334). 주소로 직접 들어와도 셸(`app/pop-main`)이 홈으로 돌려보낸다.
 *
 * `terminalCode` 는 셸이 단말 등록에서 읽어 넘긴다(모르면 `null`). `printer` 는 셸이 넘기는 프린터
 * 연결 표시(`HeaderPrinter`)이고, 없으면 그리지 않는다.
 */
export const PopScreenNav = ({
  terminalCode,
  printer = null,
  statusRef,
  printerRef,
  onReRegister,
  onLogin,
}: {
  terminalCode: string | null;
  printer?: ReactNode;
  /** 맨 위 줄 화면 상태 자리를 셸에 알린다(`PopTopStatusTarget`). */
  statusRef?: (element: HTMLElement | null) => void;
  printerRef?: (element: HTMLElement | null) => void;
  /** [단말 재등록] — 셸이 단말 등록의 `restart` 를 넘긴다. 없으면 단추를 두지 않는다. */
  onReRegister?: () => void;
  /** 「사번 미입력 | 로그인」 — 셸이 사번 입력 창을 연다. 없으면 사번 칩이 눌리지 않는다. */
  onLogin?: () => void;
}): ReactNode => {
  const navigate = useNavigate();
  const { pathname, search, access, workCounts, pending, total, go, tabCount } = usePopNavigation();
  const isLocked = usePopIdentity().workerNo === null;
  const current = access.screens.find((screen) => screen.path === pathname) ?? null;
  const [open, setOpen] = useState(false);
  const currentTab = useRef<HTMLButtonElement | null>(null);

  /* 탭이 줄 폭을 넘으면 지금 화면 탭이 오른쪽 밖에 숨는다 — 보이는 자리로 당긴다. */
  useEffect(() => {
    currentTab.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [pathname, access.state]);

  /* 화면을 옮기면 펼친 창을 닫는다. */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const isHome = pathname === POP_HOME_PATH;
  /*
   * ⭐ 작업지시를 고른 뒤 거치는 화면(`workFlow`)은 탭에 두지 않는다(#291 · 사용자 승인 2026-11-17) —
   *    「작업지시 목록」 탭 아래 작업 단계 줄이 연다. 그 화면에 있을 때는 생산 묶음·작업지시 목록 탭이 켜진다.
   */
  const entryScreen = access.screens.find((screen) => screen.path === POP_WORK_ENTRY_PATH) ?? null;
  const inWorkFlow =
    current !== null && (current.workFlow !== undefined || current === entryScreen);
  const shownGroup =
    inWorkFlow && entryScreen !== null ? entryScreen.group : (current?.group ?? null);
  const tabPath =
    current?.workFlow !== undefined && entryScreen !== null ? entryScreen.path : pathname;
  const groups = POP_SCREEN_GROUPS.map((group) => {
    const all = access.screens.filter((screen) => screen.group === group.key);
    const screens = all.filter((screen) => screen.workFlow === undefined);
    const count = all.reduce((sum, screen) => sum + tabCount(screen), 0);
    return { ...group, screens, count };
  }).filter((group) => group.screens.length > 0);
  const tabs = groups.find((group) => group.key === shownGroup) ?? null;
  const reason =
    access.state === 'unknown' ? nav.unknown : access.state === 'empty' ? nav.empty : null;

  return (
    <div className="pop-nav">
      <TopBar
        terminalCode={terminalCode}
        printer={printer}
        statusRef={statusRef}
        printerRef={printerRef}
        onReRegister={onReRegister}
        onLogin={onLogin}
      />
      <div className="pop-nav-groups">
        <nav className="pop-nav-groups__list" aria-label={nav.groupsLabel}>
          <button
            type="button"
            className="pop-nav-group pop-nav-group--home"
            aria-current={isHome ? 'page' : undefined}
            data-on={isHome ? 'true' : undefined}
            onClick={() => {
              if (!isHome) void navigate(POP_HOME_PATH);
            }}
          >
            {HOME_ICON}
            {nav.home}
          </button>
          {groups.map((group) => (
            <button
              key={group.key}
              type="button"
              className="pop-nav-group"
              disabled={isLocked}
              aria-pressed={shownGroup === group.key}
              data-on={shownGroup === group.key ? 'true' : undefined}
              aria-label={group.count > 0 ? nav.groupCount(group.name, group.count) : undefined}
              onClick={() => {
                /*
                 * 묶음을 누르면 그 묶음의 첫 화면(첫 탭)으로 간다(사용자 지시 2026-11-17) — 탭만
                 * 바꾸면 화면은 홈에 남아 무엇이 열렸는지 헷갈린다. 이미 그 묶음 화면이면 그대로 둔다.
                 */
                const first = group.screens[0];
                if (shownGroup !== group.key && first !== undefined) go(first);
              }}
            >
              {GROUP_ICONS[group.key]}
              {group.name}
              <WorkBadge count={group.count} max={TAB_COUNT_MAX} />
            </button>
          ))}
          {reason !== null && <span className="pop-nav-groups__reason">{reason}</span>}
        </nav>
        <div className="pop-remaining">
          <button
            type="button"
            className="pop-remaining__button"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={remainingText.buttonLabel(total)}
            disabled={isLocked || access.state !== 'ready'}
            onClick={() => {
              /* 창을 열 때 다시 센다 — 마지막 주기 뒤에 생긴 일도 보인다. */
              if (!open) workCounts.refresh();
              setOpen(!open);
            }}
          >
            {remainingText.button}
            <span className="pop-remaining__total" aria-hidden="true">
              {total}
            </span>
            {CHEVRON}
          </button>
          {open && (
            <>
              <div
                className="pop-remaining__scrim"
                aria-hidden="true"
                onClick={() => {
                  setOpen(false);
                }}
              />
              <div
                className="pop-remaining__panel"
                role="dialog"
                aria-label={remainingText.title(total)}
              >
                <div className="pop-remaining__head">
                  <strong>{remainingText.title(total)}</strong>
                  <button
                    type="button"
                    className="pop-remaining__close"
                    aria-label={remainingText.close}
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    ✕
                  </button>
                </div>
                {pending.length === 0 ? (
                  <p className="pop-remaining__none">{remainingText.none}</p>
                ) : (
                  <>
                    <p className="pop-remaining__hint">{remainingText.hint}</p>
                    {pending.map(({ screen, count }) => (
                      <button
                        key={screen.path}
                        type="button"
                        className="pop-remaining__item"
                        aria-label={remainingText.count(screen.name, count)}
                        aria-current={screen.path === pathname ? 'page' : undefined}
                        onClick={() => {
                          setOpen(false);
                          go(screen);
                        }}
                      >
                        <span className="pop-remaining__name">
                          <strong>{screen.name}</strong>
                          <small>
                            {POP_SCREEN_GROUPS.find((group) => group.key === screen.group)?.name}
                          </small>
                        </span>
                        <WorkBadge count={count} />
                        <span className="pop-remaining__move">{remainingText.move}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {tabs !== null && (
        <nav className="pop-nav-tabs" aria-label={nav.screensLabel(tabs.name)}>
          {tabs.screens.map((screen) => {
            const count = tabCount(screen);
            const on = screen.path === tabPath;
            return (
              <button
                key={screen.path}
                ref={on ? currentTab : undefined}
                type="button"
                className="pop-nav-tab"
                aria-current={on ? 'page' : undefined}
                data-on={on ? 'true' : undefined}
                aria-label={count > 0 ? remainingText.count(screen.name, count) : undefined}
                onClick={() => {
                  go(screen);
                }}
              >
                {screen.name}
                <WorkBadge count={count} max={TAB_COUNT_MAX} />
              </button>
            );
          })}
        </nav>
      )}
      {inWorkFlow && (
        <PopWorkSteps
          entry={entryScreen}
          steps={access.screens.filter((screen) => screen.workFlow === 'step')}
          during={access.screens.filter((screen) => screen.workFlow === 'during')}
          pathname={pathname}
          search={search}
          go={go}
        />
      )}
    </div>
  );
};
