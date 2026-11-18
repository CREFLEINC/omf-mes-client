import { Badge } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { POP_ENTRY_SCREEN_PATH, type PopScreen } from '../../patterns/pop-screen-catalog';
import { countOf, GROUP_ICONS, navIcon, usePopNavigation } from '../../patterns/pop-screen-nav';
import { useWorkerSession } from '../../patterns/worker-session';
import { useHomeWorkStatus } from './queries';
import {
  DEFAULT_SHORTCUT_PATHS,
  MAX_SHORTCUTS,
  readShortcutPaths,
  writeShortcutPaths,
} from './shortcuts';
import type { WorkStartEntryState } from '../work-start/entry-state';

const t = messages.popChrome.home;

/** 바로가기 타일 아이콘(#291 확정 시안). 여기 없는 화면은 업무 묶음 아이콘을 쓴다. */
const SHORTCUT_ICONS: readonly { path: string; icon: ReactNode }[] = [
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

const PLAY_ICON = navIcon(<path d="M7 4v16l13-8z" />);
const CLOCK_ICON = navIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>,
);
const CHECK_ICON = navIcon(<path d="m5 12 5 5L20 7" />);
const PEN_ICON = navIcon(<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />);

const iconOf = (screen: PopScreen): ReactNode =>
  SHORTCUT_ICONS.find((entry) => entry.path === screen.path)?.icon ?? GROUP_ICONS[screen.group];

/** 오늘 작업 현황 카드 — 진행 중 · 대기 · 완료 · 다음 작업. */
const StatusCard = ({
  titleId,
  onNext,
}: {
  titleId: string;
  /**
   * 다음 작업을 누르면 그 W/O 를 고른 채로 작업 지시 목록을 연다(사용자 지시 2026-11-17 · #291) —
   * 바로 [작업 시작]을 누를 수 있게. `allEquipment` 는 홈에서 보던 설비 범위다. 그 화면에 못 가면 `null`.
   */
  onNext: ((workOrderId: number, allEquipment: boolean) => void) | null;
}) => {
  const { equipment, terminalId } = usePopIdentity();
  /*
   * 설비가 지정된 단말은 「지정 설비」와 「전체 설비」를 골라 본다(사용자 지시 2026-11-17 · #291).
   * 처음에는 지정 설비 — 이 단말에서 할 일이 먼저다. 설비가 없는 단말은 전체 설비뿐이다.
   */
  const [allEquipment, setAllEquipment] = useState(false);
  const status = useHomeWorkStatus(
    equipment === null || allEquipment ? null : equipment.equipmentId,
    equipment !== null || terminalId !== null,
  );
  const data = status.data;
  const stats = [
    { key: 'run', label: t.inProgress, value: data?.inProgress, icon: PLAY_ICON, tone: 'run' },
    { key: 'wait', label: t.waiting, value: data?.waiting, icon: CLOCK_ICON, tone: 'wait' },
    { key: 'done', label: t.done, value: data?.done, icon: CHECK_ICON, tone: 'done' },
  ] as const;
  const next = data?.next ?? null;

  return (
    <section className="pop-home__panel pop-home__status" aria-labelledby={titleId}>
      <h2 id={titleId} className="pop-home__heading">
        {t.statusTitle}
        {terminalId !== null && equipment === null && (
          <span className="pop-home__scope">{t.statusAllEquipment}</span>
        )}
      </h2>
      {equipment !== null && (
        <div className="pop-home__scope-toggle" role="group" aria-label={t.statusScopeLabel}>
          {[
            {
              all: false,
              label: t.statusMyEquipment(
                equipment.equipmentName ??
                  equipment.equipmentCode ??
                  `#${String(equipment.equipmentId)}`,
              ),
            },
            { all: true, label: t.statusEveryEquipment },
          ].map((option) => (
            <button
              key={String(option.all)}
              type="button"
              aria-pressed={allEquipment === option.all}
              onClick={() => {
                setAllEquipment(option.all);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
      {status.isError ? (
        <p className="pop-home__none">{t.statusFailed}</p>
      ) : (
        <div className="pop-home__stats">
          {stats.map((stat) => (
            <div key={stat.key} className="pop-home__stat" data-tone={stat.tone}>
              <span className="pop-home__stat-icon">{stat.icon}</span>
              <span className="pop-home__stat-text">
                <small>{stat.label}</small>
                <strong>{stat.value === undefined ? '–' : t.statusCount(stat.value)}</strong>
              </span>
            </div>
          ))}
          <button
            type="button"
            className="pop-home__next"
            disabled={onNext === null || next === null}
            onClick={() => {
              if (next !== null) onNext?.(next.workOrderId, equipment === null || allEquipment);
            }}
          >
            <span className="pop-home__next-text">
              <small>{t.nextTitle}</small>
              {next === null ? (
                <span>{data === undefined ? '–' : t.nextNone}</span>
              ) : (
                <>
                  <b>{next.workOrderNo}</b>
                  <span>
                    {t.nextPlan(
                      next.itemCode ?? `#${String(next.itemId)}`,
                      next.orderQty.toLocaleString(),
                    )}
                  </span>
                </>
              )}
            </span>
            {next !== null && onNext !== null && RIGHT_ICON}
          </button>
        </div>
      )}
    </section>
  );
};

/**
 * **홈**(#291) — 사번 확인 뒤 처음 서는 화면. 오늘 작업 현황, 남은 작업, 바로가기를 보여 주고, 누르면
 * 그 화면으로 간다. 이동 길은 공통 메뉴와 같은 것을 쓴다(`usePopNavigation`) — 남은 작업 수도 같은 값이다.
 *
 * ⭐ 바로가기는 [편집]으로 이 단말에 맞게 고른다(최대 6개 · 단말에 저장).
 */
export const PopHomeScreen = (): ReactNode => {
  const titleId = useId();
  const { workerNo } = usePopIdentity();
  const session = useWorkerSession();
  const { access, workCounts, pending, total, go } = usePopNavigation();
  const navigate = useNavigate();
  const clock = useClock();
  const [pickedPaths, setPickedPaths] = useState<string[] | null>(readShortcutPaths);
  const [isEditing, setIsEditing] = useState(false);
  const workerName =
    session !== null && session.worker.workerNo === workerNo ? session.worker.workerName : null;
  const name = workerName ?? workerNo ?? '';
  const paths = pickedPaths ?? DEFAULT_SHORTCUT_PATHS;
  const shortcuts = paths.flatMap((path) => {
    const screen = access.screens.find((candidate) => candidate.path === path);
    return screen === undefined ? [] : [screen];
  });
  const workStart = access.screens.find((screen) => screen.path === '/pop/work-start') ?? null;

  const savePaths = (next: string[] | null) => {
    setPickedPaths(next);
    writeShortcutPaths(next);
  };

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

      <div className="pop-home__row pop-fixed">
        <StatusCard
          titleId={`${titleId}-status`}
          onNext={
            workStart === null
              ? null
              : (workOrderId, allEquipment) => {
                  const state: WorkStartEntryState = { workOrderId, allEquipment };
                  void navigate(workStart.path, { state });
                }
          }
        />

        <section className="pop-home__panel pop-home__remaining" aria-labelledby={`${titleId}-rem`}>
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
      </div>

      <section className="pop-home__panel pop-fixed" aria-labelledby={`${titleId}-sc`}>
        <div className="pop-home__shortcuts-head">
          <h2 id={`${titleId}-sc`} className="pop-home__heading">
            {BOLT_ICON}
            {t.shortcutsTitle}
          </h2>
          <p>{isEditing ? t.editHint(MAX_SHORTCUTS) : t.shortcutsHint}</p>
          <span className="pop-home__edit-tools">
            {isEditing && (
              <button
                type="button"
                className="pop-home__edit"
                onClick={() => {
                  savePaths(null);
                }}
              >
                {t.editReset}
              </button>
            )}
            <button
              type="button"
              className="pop-home__edit"
              aria-pressed={isEditing}
              onClick={() => {
                setIsEditing(!isEditing);
              }}
            >
              {!isEditing && PEN_ICON}
              {isEditing ? t.editDone : t.edit}
            </button>
          </span>
        </div>

        {isEditing ? (
          <div className="pop-home__tiles pop-home__tiles--edit">
            {access.screens.map((screen) => {
              const picked = paths.includes(screen.path);
              const isFull = !picked && shortcuts.length >= MAX_SHORTCUTS;
              return (
                <button
                  key={screen.path}
                  type="button"
                  className="pop-home__tile"
                  aria-pressed={picked}
                  aria-label={picked ? t.editPicked(screen.name) : screen.name}
                  disabled={isFull}
                  onClick={() => {
                    const visible = shortcuts.map((entry) => entry.path);
                    savePaths(
                      picked
                        ? visible.filter((path) => path !== screen.path)
                        : [...visible, screen.path],
                    );
                  }}
                >
                  {picked && <span className="pop-home__tile-check">{CHECK_ICON}</span>}
                  {iconOf(screen)}
                  <span>{screen.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          shortcuts.length > 0 && (
            <div className="pop-home__tiles">
              {shortcuts.map((screen) => {
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
                    {iconOf(screen)}
                    <span>{screen.name}</span>
                  </button>
                );
              })}
            </div>
          )
        )}
      </section>
    </main>
  );
};
