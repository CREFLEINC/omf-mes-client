import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';

import { usePopIdentity } from '../../patterns/pop-identity';
import { POP_ENTRY_SCREEN_PATH, type PopScreen } from '../../patterns/pop-screen-catalog';
import { countOf, GROUP_ICONS, navIcon, usePopNavigation } from '../../patterns/pop-screen-nav';
import {
  PuButton,
  PuChip,
  PuCount,
  PuEmpty,
  PuIcon,
  PuNote,
  PuPager,
  PuScreen,
  PuSection,
  PuSeg,
  puCx,
  puToast,
  useClientPage,
  useFitCount,
} from '../../patterns/pop-uniform';
import { useWorkerSession } from '../../patterns/worker-session';
import { HOME_STATUS_CODES, useHomeWorkOrders, useHomeWorkStatus } from './queries';
import {
  DEFAULT_SHORTCUT_PATHS,
  MAX_SHORTCUTS,
  readShortcutPaths,
  writeShortcutPaths,
} from './shortcuts';
import type { WorkStartEntryState } from '../work-start/entry-state';
import './uniform.css';

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
/** [편집] 앞 연필(시안). 공통 아이콘에 연필이 없어 이 화면에 둔다. */
const PENCIL_ICON = (
  <svg
    className="pu-ic"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

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
  const scopeEquipmentId = equipment === null || allEquipment ? null : equipment.equipmentId;
  const isAsked = equipment !== null || terminalId !== null;
  const status = useHomeWorkStatus(scopeEquipmentId, isAsked);
  const data = status.data;
  const stats = [
    /* 공통 상태 색(#295 규칙 10): 진행 중 파랑 · 대기 회색 · 완료 초록. */
    { key: 'run', label: t.inProgress, value: data?.inProgress, icon: PLAY_ICON, tone: 'info' },
    { key: 'wait', label: t.waiting, value: data?.waiting, icon: CLOCK_ICON, tone: 'idle' },
    { key: 'done', label: t.done, value: data?.done, icon: CHECK_ICON, tone: 'ok' },
  ] as const;
  /*
   * 칸을 누르면 그 상태의 작업지시를 아래에 보인다(사용자 지시 2026-11-19) — 처음에는 진행 중.
   * 줄은 카드 높이에 들어가는 만큼, 넘칠 때만 쪽 넘김(남은 작업과 같은 방식 · 구획 안 스크롤 없음).
   */
  const [view, setView] = useState<(typeof stats)[number]['key']>('run');
  const [page, setPage] = useState(1);
  const listRef = useRef<HTMLDivElement>(null);
  const fit = useFitCount(listRef, { fallback: 3 });
  const viewTotal =
    data === undefined
      ? undefined
      : { run: data.inProgress, wait: data.waiting, done: data.done }[view];
  /* 넘치면 한 자리를 쪽 넘김에 내준다. 한 줄 자리뿐이면(작은 화면의 [편집] 중) 쪽 넘김 없이 한 줄만. */
  const hasPager = fit >= 2 && (viewTotal === undefined || viewTotal > fit);
  const size = hasPager ? fit - 1 : fit;
  /* 칸의 수를 안 뒤에 묻는다 — 쪽 넘김 자리(줄 수)가 정해져야 한 번에 맞는 쪽을 받는다. */
  const list = useHomeWorkOrders(
    scopeEquipmentId,
    HOME_STATUS_CODES[view],
    page,
    size,
    isAsked && viewTotal !== undefined,
  );
  const listTotal = list.data?.page.total ?? 0;
  const pages = Math.max(1, Math.ceil(listTotal / size));
  /* 줄 수가 바뀌어 쪽이 줄면 마지막 쪽으로 당긴다. */
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);
  const next = data?.next ?? null;

  return (
    <PuSection
      labelId={titleId}
      title={t.statusTitle}
      className="home-status"
      meta={
        equipment !== null ? (
          <PuSeg
            label={t.statusScopeLabel}
            value={allEquipment ? 'all' : 'mine'}
            onChange={(value) => {
              setAllEquipment(value === 'all');
              setPage(1);
            }}
            options={[
              {
                value: 'mine',
                label: t.statusMyEquipment(
                  equipment.equipmentName ??
                    equipment.equipmentCode ??
                    `#${String(equipment.equipmentId)}`,
                ),
              },
              { value: 'all', label: t.statusEveryEquipment },
            ]}
          />
        ) : terminalId !== null ? (
          t.statusAllEquipment
        ) : undefined
      }
    >
      {status.isError ? (
        <PuNote tone="bad">{t.statusFailed}</PuNote>
      ) : (
        <div className="home-stats">
          {stats.map((stat) => (
            <button
              key={stat.key}
              type="button"
              className={puCx('home-stat', stat.tone, view === stat.key && 'is-on')}
              aria-pressed={view === stat.key}
              onClick={() => {
                setView(stat.key);
                setPage(1);
              }}
            >
              <span className="ico">{stat.icon}</span>
              <span>
                <small>{stat.label}</small>
                <strong>{stat.value === undefined ? '–' : t.statusCount(stat.value)}</strong>
              </span>
            </button>
          ))}
          <button
            type="button"
            className="home-next"
            disabled={onNext === null || next === null}
            onClick={() => {
              if (next !== null) onNext?.(next.workOrderId, equipment === null || allEquipment);
            }}
          >
            <span className="txt">
              <small>{t.nextTitle}</small>
              {next === null ? (
                <span className="sub">{data === undefined ? '–' : t.nextNone}</span>
              ) : (
                <>
                  <b className="pu-mono">{next.workOrderNo}</b>
                  <span className="sub">
                    {t.nextPlan(
                      next.itemCode ?? `#${String(next.itemId)}`,
                      next.orderQty.toLocaleString(),
                    )}
                  </span>
                </>
              )}
            </span>
            {next !== null && onNext !== null && <PuIcon name="chevr" />}
          </button>
        </div>
      )}
      {!status.isError &&
        (list.isError ? (
          <PuNote tone="bad">{t.statusFailed}</PuNote>
        ) : list.data !== undefined && list.data.items.length === 0 ? (
          <PuEmpty icon="list" title={t.listEmpty} />
        ) : (
          <div ref={listRef} className="home-rows pu-fit">
            {(list.data?.items ?? []).map((order) => (
              <button
                key={order.workOrderId}
                type="button"
                className="home-row-link home-wo"
                disabled={onNext === null}
                onClick={() => {
                  onNext?.(order.workOrderId, equipment === null || allEquipment);
                }}
              >
                <b className="pu-mono">{order.workOrderNo}</b>
                <span className="item">{order.itemCode ?? `#${String(order.itemId)}`}</span>
                <strong>
                  {order.progress === undefined
                    ? t.listPlan(order.orderQty.toLocaleString())
                    : t.listQty(
                        order.progress.goodQty.toLocaleString(),
                        order.orderQty.toLocaleString(),
                      )}
                </strong>
                {onNext !== null && <PuIcon name="chevr" />}
              </button>
            ))}
            {hasPager && pages > 1 && (
              <PuPager
                total={listTotal}
                page={Math.min(page, pages)}
                pages={pages}
                label={t.listPageNav}
                onPage={setPage}
              />
            )}
          </div>
        ))}
    </PuSection>
  );
};

/**
 * 남은 작업 구획 — 구획은 화면 높이만큼 늘고, 들어가는 만큼 줄을 보인다. 다 들어가면 쪽 넘김을 두지 않고,
 * 넘칠 때만 아래에 ‹ › 를 둔다(#295 규칙 15 · 구획 안 스크롤 없음 · 사용자 지시 2026-11-19).
 *
 * ⭐ 줄과 쪽 넘김을 한 칸(`home-rows`)에 둬서 «칸 전체에 들어가는 줄 수»를 잰다 — 쪽 넘김이 서고 빠져도 잰
 *    값이 흔들리지 않는다. 넘치면 한 자리를 쪽 넘김에 내준다(쪽 넘김 높이는 줄보다 낮다).
 */
const RemainingCard = ({ titleId }: { titleId: string }) => {
  const { pending, total, go } = usePopNavigation();
  const listRef = useRef<HTMLDivElement>(null);
  const fit = useFitCount(listRef, { fallback: 3 });
  /* 한 줄 자리뿐이면 쪽 넘김 없이 한 줄만(작업 현황 목록과 같다). */
  const hasPager = fit >= 2 && pending.length > fit;
  const shown = useClientPage(pending, hasPager ? fit - 1 : fit);

  return (
    <PuSection
      labelId={titleId}
      title={t.remainingTitle}
      className="home-remaining"
      head={total > 0 ? <span className="home-rem-badge">{total}</span> : undefined}
    >
      {pending.length === 0 ? (
        <PuEmpty icon="ok" title={t.remainingNone} />
      ) : (
        <div ref={listRef} className="home-rows pu-fit">
          {shown.items.map(({ screen, count }) => (
            <button
              key={screen.path}
              type="button"
              className="home-row-link"
              aria-label={messages.popChrome.remaining.count(screen.name, count)}
              onClick={() => {
                go(screen);
              }}
            >
              <span>{screen.name}</span>
              <strong>{t.remainingCount(count)}</strong>
              <PuIcon name="chevr" />
            </button>
          ))}
          {hasPager && shown.pages > 1 && (
            <PuPager
              total={shown.total}
              page={shown.page}
              pages={shown.pages}
              label={t.remainingPageNav}
              onPage={shown.setPage}
            />
          )}
        </div>
      )}
    </PuSection>
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
  const { access, workCounts, go } = usePopNavigation();
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
    <PuScreen className="home-u" labelledBy={titleId}>
      <h1 id={titleId} className="pop-visually-hidden">
        {t.title}
      </h1>
      <div className="home-greet">
        <h2>{name === '' ? t.greetingAnonymous : t.greeting(name)}</h2>
        <span className="when">
          <PuIcon name="clock" />
          {clock}
        </span>
        <p>{t.greetingSub}</p>
      </div>

      <div className="home-top">
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
        <RemainingCard titleId={`${titleId}-rem`} />
      </div>

      <PuSection
        labelId={`${titleId}-sc`}
        title={t.shortcutsTitle}
        grow={false}
        className="home-shortcuts"
        head={
          isEditing ? (
            <>
              <PuChip tone="info">{t.editCount(shortcuts.length, MAX_SHORTCUTS)}</PuChip>
              <span className="home-hint">{t.editHint(MAX_SHORTCUTS)}</span>
            </>
          ) : undefined
        }
        meta={
          isEditing ? (
            <>
              <PuButton
                size="sm"
                onClick={() => {
                  savePaths(null);
                }}
              >
                {t.editReset}
              </PuButton>
              <PuButton
                size="sm"
                variant="primary"
                onClick={() => {
                  setIsEditing(false);
                  puToast(t.editSaved);
                }}
              >
                {t.editDone}
              </PuButton>
            </>
          ) : (
            <PuButton
              size="sm"
              className="home-edit"
              onClick={() => {
                setIsEditing(true);
              }}
            >
              {PENCIL_ICON}
              {t.edit}
            </PuButton>
          )
        }
      >
        {isEditing ? (
          <div className="home-tiles is-edit">
            {access.screens.map((screen) => {
              const picked = paths.includes(screen.path);
              const isFull = !picked && shortcuts.length >= MAX_SHORTCUTS;
              return (
                <button
                  key={screen.path}
                  type="button"
                  className={puCx('home-tile', picked && 'is-on')}
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
                  {picked && (
                    <span className="chk">
                      <PuIcon name="ok" />
                    </span>
                  )}
                  {iconOf(screen)}
                  <span className="name">{screen.name}</span>
                </button>
              );
            })}
          </div>
        ) : (
          shortcuts.length > 0 && (
            <div className="home-tiles">
              {shortcuts.map((screen) => {
                const count = countOf(screen, workCounts.counts);
                return (
                  <button
                    key={screen.path}
                    type="button"
                    className="home-tile"
                    aria-label={
                      count > 0 ? messages.popChrome.remaining.count(screen.name, count) : undefined
                    }
                    onClick={() => {
                      go(screen);
                    }}
                  >
                    {count > 0 && (
                      <span className="cnt" aria-hidden="true">
                        <PuCount>{count}</PuCount>
                      </span>
                    )}
                    {iconOf(screen)}
                    <span className="name">{screen.name}</span>
                  </button>
                );
              })}
            </div>
          )
        )}
      </PuSection>
    </PuScreen>
  );
};
