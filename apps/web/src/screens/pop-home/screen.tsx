import { Badge } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { POP_ENTRY_SCREEN_PATH } from '../../patterns/pop-screen-catalog';
import { countOf, navIcon, usePopNavigation } from '../../patterns/pop-screen-nav';
import { useWorkerSession } from '../../patterns/worker-session';

const t = messages.popChrome.home;

/**
 * 바로가기 타일(#291 확정 시안)과 그 아이콘. 이 단말이 갈 수 없는 화면은 빼고 보인다.
 *
 * ⛔ 편집(작업자가 고르기)·즐겨찾기 별은 두지 않는다 — 고른 것을 둘 자리(서버·단말 저장)가 아직 없다.
 */
const SHORTCUTS: readonly { path: string; icon: ReactNode }[] = [
  {
    path: '/pop/production-result',
    icon: navIcon(
      <>
        <path d="M3 21V10l5 3v-3l5 3V6l5-3v18z" />
        <path d="M3 21h18" />
      </>,
    ),
  },
  {
    path: '/pop/work-start',
    icon: navIcon(
      <>
        <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </>,
    ),
  },
  {
    path: '/pop/packing',
    icon: navIcon(
      <>
        <path d="M21 8 12 3 3 8v8l9 5 9-5z" />
        <path d="m3 8 9 5 9-5M12 13v8" />
      </>,
    ),
  },
  {
    path: '/pop/pqc-inspection',
    icon: navIcon(
      <>
        <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </>,
    ),
  },
  {
    path: '/pop/work-hold',
    icon: navIcon(
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M10 9v6M14 9v6" />
      </>,
    ),
  },
  {
    path: '/pop/material-input',
    icon: navIcon(<path d="M12 3v12m-5-5 5 5 5-5M5 21h14" />),
  },
];

const CALENDAR_ICON = navIcon(
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>,
);
const BOLT_ICON = navIcon(<path d="M13 2 4 14h7l-1 8 9-12h-7z" />);
const RIGHT_ICON = navIcon(<path d="m9 6 6 6-6 6" />);

const pad = (value: number) => String(value).padStart(2, '0');

/** 「2026-11-17 (화) 11:58」 — 분이 바뀔 때마다 다시 그린다. */
const useClock = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} (${
    t.weekdays[now.getDay()] ?? ''
  }) ${pad(now.getHours())}:${pad(now.getMinutes())}`;
};

/**
 * **홈**(#291) — 사번 확인 뒤 처음 서는 화면. 남은 작업과 바로가기를 보여 주고, 누르면 그 화면으로
 * 간다. 이동 길은 공통 메뉴와 같은 것을 쓴다(`usePopNavigation`) — 남은 작업 수도 같은 값이다.
 *
 * ⛔ 「오늘 작업 현황」(진행·대기·완료 수)은 두지 않는다 — 서버가 그 수를 주지 않는다(화면 작업에서
 *    서버를 고치지 않는다).
 */
export const PopHomeScreen = () => {
  const titleId = useId();
  const { workerNo } = usePopIdentity();
  const session = useWorkerSession();
  const { access, workCounts, pending, total, go } = usePopNavigation();
  const clock = useClock();
  const workerName =
    session !== null && session.worker.workerNo === workerNo ? session.worker.workerName : null;
  const name = workerName ?? workerNo ?? '';
  const shortcuts = SHORTCUTS.flatMap(({ path, icon }) => {
    const screen = access.screens.find((candidate) => candidate.path === path);
    return screen === undefined ? [] : [{ screen, icon }];
  });

  /*
   * 사번이 없으면 홈 대신 사번 입력 «화면»으로 보낸다(사용자 지시 2026-11-17 — 팝업이 아니라 화면).
   * 그 화면에서 사번을 확인하면 다시 홈으로 온다.
   */
  if (workerNo === null) return <Navigate to={POP_ENTRY_SCREEN_PATH} replace />;

  return (
    <main className="pop-ui pop-home" aria-labelledby={titleId}>
      <h1 id={titleId} className="pop-visually-hidden pop-fixed">
        {t.title}
      </h1>
      <section className="pop-home__hello pop-fixed">
        <div>
          <h2>{name === '' ? t.greetingAnonymous : t.greeting(name)}</h2>
          <p>{t.sub}</p>
        </div>
        <span className="pop-home__clock">
          {CALENDAR_ICON}
          {clock}
        </span>
      </section>

      <section className="pop-home__panel pop-fixed" aria-labelledby={`${titleId}-rem`}>
        <h2 id={`${titleId}-rem`} className="pop-home__heading">
          {t.remainingTitle}
          {total > 0 && <span className="pop-home__total">{total}</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="pop-home__none">{t.remainingNone}</p>
        ) : (
          <div className="pop-home__remaining-list">
            {pending.map(({ screen, count }) => (
              <button
                key={screen.path}
                type="button"
                className="pop-home__remaining-item"
                aria-label={messages.popChrome.remaining.count(screen.name, count)}
                onClick={() => {
                  go(screen);
                }}
              >
                <span>{screen.name}</span>
                <strong>{t.remainingCount(count)}</strong>
                {RIGHT_ICON}
              </button>
            ))}
          </div>
        )}
      </section>

      {shortcuts.length > 0 && (
        <section className="pop-home__panel pop-fixed" aria-labelledby={`${titleId}-sc`}>
          <div className="pop-home__shortcuts-head">
            <h2 id={`${titleId}-sc`} className="pop-home__heading">
              {BOLT_ICON}
              {t.shortcutsTitle}
            </h2>
            <p>{t.shortcutsHint}</p>
          </div>
          <div className="pop-home__tiles">
            {shortcuts.map(({ screen, icon }) => {
              const count = countOf(screen, workCounts.counts);
              return (
                <button
                  key={screen.path}
                  type="button"
                  className="pop-home__tile"
                  aria-label={
                    count > 0 ? messages.popChrome.remaining.count(screen.name, count) : undefined
                  }
                  onClick={() => {
                    go(screen);
                  }}
                >
                  {count > 0 && (
                    <Badge
                      count={count}
                      max={9}
                      tone="neutral"
                      className="pop-work-badge"
                      aria-hidden="true"
                    />
                  )}
                  {icon}
                  <span>{screen.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
};
