import { Badge, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAccessiblePopScreens } from './pop-access';
import { usePopIdentity } from './pop-identity';
import {
  POP_ENTRY_SCREEN_PATH,
  POP_HOME_PATH,
  POP_SCREEN_GROUPS,
  type PopScreen,
  type PopScreenGroupKey,
} from './pop-screen-catalog';
import { usePopWorkCounts, type PopWorkCounts } from './pop-work-counts';
import { setWorkerSession, useWorkerSession } from './worker-session';

const nav = messages.popChrome.nav;
const remainingText = messages.popChrome.remaining;
const headerText = messages.popChrome.header;

/** 한 화면의 남은 수. 셀 수 없는 화면이거나 수를 모르면 0 — 0 은 어디에도 그리지 않는다. */
export const countOf = (screen: PopScreen, counts: PopWorkCounts['counts']): number =>
  screen.countKey === undefined ? 0 : (counts?.[screen.countKey] ?? 0);

/** 남은 작업 배지 — 1~9, 10 이상 「9+」, 중립색(빨강 쓰지 않음). 수는 숨은 글이 읽어 준다. */
const WorkBadge = ({ count }: { count: number }) =>
  count > 0 ? (
    <Badge count={count} max={9} tone="neutral" className="pop-work-badge" aria-hidden="true" />
  ) : null;

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
  if (screen.acceptsWorkOrderId !== true) return screen.path;

  const workOrderId = new URLSearchParams(search).get('workOrderId');
  if (workOrderId === null || workOrderId === '') return screen.path;

  return `${screen.path}?workOrderId=${encodeURIComponent(workOrderId)}`;
};

/**
 * 이동 메뉴가 쓰는 값 한 묶음 — 이동 가능한 화면, 남은 작업 수, 화면으로 가는 길.
 * 공통 메뉴와 홈 화면이 같은 값을 쓴다(둘이 따로 세면 숫자가 어긋난다).
 */
export const usePopNavigation = () => {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const access = useAccessiblePopScreens();
  const { workerNo } = usePopIdentity();
  /* 피처 002 — 사번이 확인되고 갈 화면이 정해진 뒤에만 센다(60초 주기). */
  const workCounts = usePopWorkCounts(workerNo !== null && access.state === 'ready');
  const pending = access.screens
    .map((screen) => ({ screen, count: countOf(screen, workCounts.counts) }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    pathname,
    access,
    workCounts,
    pending,
    total: pending.reduce((sum, entry) => sum + entry.count, 0),
    go: (screen: PopScreen) => {
      /* ⛔ 저장하지 않은 입력을 묻지 않는다(G-34) — 확인 창은 정작 물어야 할 자리의 확인까지 넘기게 만든다. */
      if (screen.path === pathname) return;
      void navigate(destinationOf(screen, search));
    },
  };
};

/** 메뉴·홈이 함께 쓰는 선 아이콘(24 격자). */
export const navIcon = (path: ReactNode) => (
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
  material: navIcon(
    <>
      <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
      <path d="m3 8 9 5 9-5M12 13v8" />
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
  facility: navIcon(
    <>
      <path d="M3 21V9l9-5 9 5v12" />
      <path d="M7 21v-8h10v8M7 17h10" />
    </>,
  ),
};

const CHEVRON = navIcon(<path d="m6 9 6 6 6-6" />);

const USER_ICON = navIcon(
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </>,
);

/** 맨 위 줄 — 제품 이름 · 단말 | 화면 상태 · 프린터 · 작업자 · [사용자 전환]. */
const TopBar = ({
  terminalCode,
  printer,
  statusRef,
}: {
  terminalCode: string | null;
  printer: ReactNode;
  statusRef?: (element: HTMLElement | null) => void;
}) => {
  const navigate = useNavigate();
  const { workerNo } = usePopIdentity();
  const session = useWorkerSession();
  /* 이름은 지금 사번과 같은 사람의 세션일 때만 붙인다 — 다른 사번의 이름을 빌려 오지 않는다. */
  const workerName =
    session !== null && session.worker.workerNo === workerNo ? session.worker.workerName : null;

  return (
    <div className="pop-nav-top">
      <span className="pop-nav-top__brand">{nav.brand}</span>
      {/* 단말은 제품 이름 바로 오른쪽(사용자 지시 2026-11-17). 나머지 상태·작업자는 오른쪽 끝에 모은다. */}
      <span className="pop-nav-top__chip pop-nav-top__terminal">
        {terminalCode === null
          ? headerText.terminalUnknown
          : headerText.terminalLabel(terminalCode)}
      </span>
      {/* 화면이 보내는 연결·전송 표시(`PopTopStatus`) 자리. */}
      <span className="pop-nav-top__status" ref={statusRef} />
      {printer !== null && <span className="pop-nav-top__printer">{printer}</span>}
      <span
        className="pop-nav-top__chip"
        title={workerNo === null ? undefined : headerText.workerTitle(workerNo, workerName)}
      >
        {workerNo === null ? headerText.workerUnset : headerText.workerLabel(workerNo, workerName)}
      </span>
      {/*
       * [사용자 전환] — 현재 활성 사번만 지우고 사번 입력 화면으로 간다. 저장 기록과 오프라인 큐의
       * 사번은 바꾸지 않는다(G-34 · D-5).
       */}
      <Button
        className="pop-logout"
        variant="outlined"
        size="md"
        onClick={() => {
          setWorkerSession(null);
          void navigate(POP_ENTRY_SCREEN_PATH, { replace: true });
        }}
      >
        {USER_ICON}
        {messages.popChrome.userSwitch}
      </Button>
    </div>
  );
};

/**
 * **POP 공통 이동 메뉴**(#291) — 맨 위 줄, 업무 묶음 줄(+ [남은 작업]), 화면 탭 줄.
 *
 * ⭐ 단말에는 주소창도 뒤로가기도 없다. 화면을 옮기는 길이 화면마다 따로 있으면 작업자가
 *    「여기서는 어디로 갈 수 있나」를 화면마다 새로 배워야 하므로 셸(`app/pop-main`)에서 한 번만 그린다.
 *
 * ⭐ 묶음을 누르면 **화면 탭 줄만 바뀐다** — 화면은 탭을 눌러야 옮겨 간다. 묶음만으로 옮기면
 *    「묶음의 첫 화면」이 원치 않게 열린다.
 *
 * ⚠ 못 갈 때는 감추지 않고 사유를 보인다(G-2). 묶음이 통째로 사라지면 「원래 이동이 안 되는
 *    단말인가」와 「지금 확인이 안 되는가」를 구별할 수 없다.
 *
 * ⛔ 진입 화면(사번 입력)에서는 그리지 않는다 — 사번 없이 다른 화면으로 가는 길이 생긴다.
 *
 * `terminalCode` 는 셸이 단말 등록에서 읽어 넘긴다(모르면 `null`). `printer` 는 셸이 넘기는 프린터
 * 연결 표시다 — 사번 입력 화면 머리줄과 같은 것(`HeaderPrinter`)이고, 없으면 그리지 않는다.
 */
export const PopScreenNav = ({
  terminalCode,
  printer = null,
  statusRef,
}: {
  terminalCode: string | null;
  printer?: ReactNode;
  /** 맨 위 줄 화면 상태 자리를 셸에 알린다(`PopTopStatusTarget`). */
  statusRef?: (element: HTMLElement | null) => void;
}) => {
  const navigate = useNavigate();
  const { pathname, access, workCounts, pending, total, go } = usePopNavigation();
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

  if (pathname === POP_ENTRY_SCREEN_PATH) return null;

  const isHome = pathname === POP_HOME_PATH;
  const shownGroup = current?.group ?? null;
  const groups = POP_SCREEN_GROUPS.map((group) => {
    const screens = access.screens.filter((screen) => screen.group === group.key);
    const count = screens.reduce((sum, screen) => sum + countOf(screen, workCounts.counts), 0);
    return { ...group, screens, count };
  }).filter((group) => group.screens.length > 0);
  const tabs = groups.find((group) => group.key === shownGroup) ?? null;
  const reason =
    access.state === 'unknown' ? nav.unknown : access.state === 'empty' ? nav.empty : null;

  return (
    <div className="pop-nav">
      <TopBar terminalCode={terminalCode} printer={printer} statusRef={statusRef} />
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
              <WorkBadge count={group.count} />
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
            disabled={access.state !== 'ready'}
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
            const count = countOf(screen, workCounts.counts);
            const on = screen.path === pathname;
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
                <WorkBadge count={count} />
              </button>
            );
          })}
        </nav>
      )}
    </div>
  );
};
