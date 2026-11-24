import { messages } from '@omf-mes/i18n';
import { useMemo, useRef } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { plantToday } from '../../patterns/plant-time';
import {
  PaneListHead,
  PaneSplitter,
  useFitToViewport,
  usePaneSplit,
} from '../../patterns/po-board';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { excessTabHref, readLegacyExcessEntry, type ExcessEntry } from './excess-entry';
import { excessesByLine } from './excess-match';
import {
  EXCESS_PAGE_SIZE,
  excessKeys,
  isExcessUnavailable,
  useUnallocatedLines,
} from './excess-queries';
import type { UnallocatedLine } from './excess-types';
import { ScheduleFilterBar } from './filter-bar';
import {
  clearFilter,
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  type ScheduleFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import { WORK_RECORD_PATH } from './lot-row';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemNames,
  usePlantOptions,
  useStorageLocationNames,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { readInboundLotEntry, readLotEntry } from './post-entry';
import {
  isProgressUnavailable,
  useInboundLotFirstLot,
  useInboundProgress,
  useInboundStageCounts,
} from './progress-queries';
import { QuickLookupBar, QuickToggles, type QuickLookupHandle } from './quick-lookup-bar';
import { toPageView } from './pagination';
import {
  defaultPeriod,
  readPeriod,
  toPeriodQuery,
  validatePeriod,
  type PeriodInput,
} from './period';
import { LineTable } from './line-table';
import { OrderTable } from './order-table';
import { usePurchaseOrderLines, usePurchaseOrderSummaries } from './queries';
import { progressByLine } from './stage';
import { StageChips } from './stage-chips';
import type {
  InboundScheduleLine,
  PurchaseOrderSummary,
  PurchaseOrderSummaryQuery,
  SelectOption,
} from './types';

const t = messages.inboundSchedule;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: PurchaseOrderSummary[] = [];
const EMPTY_LINES: InboundScheduleLine[] = [];
const NO_ITEM_IDS: readonly number[] = [];
const NO_EXCESSES: UnallocatedLine[] = [];
/** 고른 발주를 풀었다는 `po` 값 — 결과가 하나뿐이어도 저절로 고르지 않는다. */
const PO_CLEARED = 'none';

/** 왼쪽 표 한 쪽 20줄(사용자 지시 2026-10-20). 서버 기본(50)보다 작게 실어 보낸다 — 상한은 200. */
export const LIST_PAGE_SIZE = 20;

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 발주의 이름을 풀기 위해서인데, 그 발주들을 **조건으로 찾으려면**
 * 선택지에도 있어야 한다. 표식은 저장소 관례를 따른다(W-CO-02의 「(미사용)」).
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/**
 * W-01-09 컨테이너 — 「입고 관리」 화면이다(사이드바 한 줄 · 탭 없음 — 2026-10-23 탭 합치기). 이름은 화면 막대에
 * 한 번만 세우고 **경로 표시를 두지 않는다**(사용자 지시 2026-10-21 — 이름이 두 곳에 서지 않게).
 *
 * **입하 예정 = 아직 다 들어오지 않은 P/O 다**(omf-mes-server#741 · #762). 고객사가 ASN 을 쓰지 않는다.
 *
 * **두 표다**(사용자 결정 2026-10-20) — 왼쪽은 P/O 묶음(발주·공급사·납기·진행·남은 라인), 오른쪽은
 * 고른 P/O 의 라인(품목·수량). 발주 하나에 라인이 수십 줄이라 한 표에 두면 같은 발주번호·공급사가
 * 줄마다 되풀이돼 「어느 업체의 어떤 발주가 들어오나」가 읽히지 않았다.
 *
 * 고른 발주는 주소(`po`)에 둔다. 결과가 하나뿐이면 저절로 고른다 — 품목코드 스캔이 발주 하나로 좁혀지면
 * 곧바로 라인이 보인다.
 *
 * 조회 조건과 쪽은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다. 조건이 바뀌면 쪽은
 * 첫 쪽으로 돌아간다(`applyQuery`).
 *
 * **입하·입고 일을 이 화면으로 모은다**(사용자 지시 2026-10-21). 일마다 오른쪽 창이 열리고, 창은 주소가 연다.
 *
 * - **입고 처리**(W-01-10) — **009 부터 웹에서 하지 않는다**(FR-003 · omf-all-around#294). 구매 입하 자재는 PDA
 *   「적치·입고 완료」(M-01-05)에서 적치할 때 그 LOT 하나씩 입고된다. 입고 가능 LOT 은 「적치 대기 · PDA에서 적치」로 보이고,
 *   적치한 LOT 은 위치와 적치 방식(지정 위치 · 미지정 위치 · 임시 적치)이 선다.
 * - **입하 등록**(W-01-03) — **005 부터 웹에서 받지 않는다**(FR-036 · T059). 입하는 PDA 입하 등록(M-01-01)에서 자재 관리
 *   LOT 라벨을 스캔해 한다 — 라인 표 위에 그 안내 한 줄만 선다(screens/W-01-09.md). 옛 「초과 입하 분리」 주소는
 *   `register-redirect.tsx` 가 이 화면으로 옮겨 준다.
 * - **초과분 발주 연결**(`excess=1` · 서버 장부 P-115) — 막대 끝의 「초과분 연결」과, 고른 발주의 라인에 맞는
 *   초과분이 있을 때만 서는 「초과분」 칸이 연다. 입하 등록 알림의 「초과분 연결」도 이 창으로 온다.
 *   권한이 없거나(403) 서버가 그 경로를 모르면(404) 두 길 모두 서지 않는다.
 */
export const InboundScheduleScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { splitRef, aboveRef } = useFitToViewport();
  const { session } = useSession();
  const split = usePaneSplit('omf-mes:inbound-schedule:split', 0.4);
  const quickRef = useRef<QuickLookupHandle>(null);

  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   */
  const today = plantToday();
  const fallbackPeriod = useMemo<PeriodInput>(() => defaultPeriod(today), [today]);
  const period = useMemo<PeriodInput>(
    () => readPeriod(searchParams, fallbackPeriod),
    [searchParams, fallbackPeriod],
  );
  const filters = useMemo<ScheduleFilters>(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  /*
   * **조건이 하나도 없어도 조회한다.** 조회를 멈추는 것은 보내면 반드시 400 `INVALID`가 되는
   * 기간뿐이다(없는 날짜·뒤집힌 기간) — 그런 값은 서버로 보내지 않는다.
   */
  const periodReason = filters.overdueOnly ? null : validatePeriod(period);
  /*
   * 「적치 대기」 알림(피처 009)은 입하 LOT 을 가리킨다 — 그 입하 LOT 의 자재 관리 LOT 하나로 `lot=` 과 같이 좁힌다. 찾는 동안은
   * 목록을 묻지 않는다(조건 없는 목록이 잠깐 섰다가 바뀌지 않게). 찾지 못하면 조건 없이 연다.
   */
  const inboundLotEntry = readInboundLotEntry(searchParams);
  const inboundLotLot = useInboundLotFirstLot(inboundLotEntry);
  const resolvingInboundLot = inboundLotEntry !== null && inboundLotLot.isPending;
  const lotEntry = readLotEntry(searchParams) ?? inboundLotLot.data ?? null;
  const listQuery: PurchaseOrderSummaryQuery | null = resolvingInboundLot
    ? null
    : lotEntry !== null
      ? { lotId: lotEntry, openOnly: false, size: LIST_PAGE_SIZE }
      : periodReason === null
        ? {
            /* 지연은 납기 기간과 상관없이 늦은 발주 전부다(사용자 지시 2026-10-21) — 기간을 싣지 않는다. */
            ...(filters.overdueOnly ? {} : toPeriodQuery(period)),
            ...toFilterQuery(filters),
            ...(page > 1 ? { page } : {}),
            size: LIST_PAGE_SIZE,
          }
        : null;

  const list = usePurchaseOrderSummaries(listQuery);
  /** 목록 접기 — 제목 줄 「목록 접기」 · 막대 · 접힌 탭이 함께 쓴다(#350). */
  const listCollapse = {
    collapsed: split.collapsed,
    onToggle: split.toggleCollapsed,
    collapseLabel: t.listCollapse,
    expandLabel: t.listExpand,
    count: list.data?.page.total,
  };
  const rows = list.data?.items ?? EMPTY_ROWS;

  /*
   * 탭 줄 칩의 묶음별 LOT 수(C-17 머리 건수) — 목록과 같은 조건이되 **쪽과 단계 조건은 빼고** 센다. 칩은 조건 전체의 수를
   * 말해야 하고, 단계 칩을 눌러 좁힌 뒤에도 다른 칩의 수가 남아 있어야 옮겨 갈 수 있다. 서버가 모르면(404) 칩을 세우지 않는다.
   */
  const stageCounts = useInboundStageCounts(
    lotEntry === null && periodReason === null
      ? {
          ...(filters.overdueOnly ? {} : toPeriodQuery(period)),
          ...toFilterQuery({ ...filters, stage: '', sort: null }),
        }
      : null,
  );
  const stageAvailable = stageCounts.isSuccess && !isProgressUnavailable(stageCounts.error);
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /*
   * 고른 발주. 주소의 `po` 가 이 쪽 결과에 있으면 그것, 없고 결과가 하나뿐이면 그것이다.
   * 주소의 발주가 결과에 없으면(조건을 바꿔 빠졌다) 오른쪽을 비운다 — 보이지 않는 발주의 라인을 내면
   * 왼쪽과 어긋난다.
   */
  const poParam = Number(searchParams.get('po') ?? '');
  const selectedOrder =
    rows.find((row) => row.purchaseOrderId === poParam) ??
    (rows.length === 1 && searchParams.get('po') !== PO_CLEARED ? (rows[0] ?? null) : null);
  const lines = usePurchaseOrderLines(selectedOrder?.purchaseOrderId ?? null);

  /*
   * 고른 발주의 LOT 진행. 서버가 경로를 모르면(404)·권한이 없으면(403) 라인만 선다 — 지금의 두 표 그대로다.
   * 다른 실패는 라인 아래 한 줄로 알리고 라인은 그대로 둔다.
   */
  const progress = useInboundProgress(selectedOrder?.purchaseOrderId ?? null);
  const progressUnavailable = progress.isError && isProgressUnavailable(progress.error);
  const lotsByLine = useMemo(
    () => (progress.data === undefined ? undefined : progressByLine(progress.data.items)),
    [progress.data],
  );

  const plants = usePlantOptions();
  const storageLocationNameOf = useStorageLocationNames();

  /* 품목 이름은 **걸린 품목 조건만** 번호로 묻는다 — 표의 이름은 라인 응답에 함께 온다(#762). */
  const appliedItemId = filters.item === '' ? null : Number(filters.item);
  const itemNames = useItemNames(appliedItemId === null ? NO_ITEM_IDS : [appliedItemId]);

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 는다.
   * **조건이 바뀌면 쪽을 첫 쪽으로 되돌린다** — 3쪽을 보다가 조건을 좁히면 결과가 3쪽에 못 미쳐
   * 「조건을 좁혔더니 아무것도 없다」로 보인다.
   */
  const applyQuery = (
    nextPeriod: PeriodInput,
    nextFilters: ScheduleFilters,
    nextPage = 1,
  ): void => {
    setSearchParams(toSearchParams(nextPeriod, nextFilters, nextPage, fallbackPeriod));
  };

  /*
   * 초과분 — 미연결 전부(진입 단추의 수 · 라인 칸). 연결 창과 같은 캐시 키라 창을 열어도 다시 부르지 않는다.
   * 연결한 것은 아직 보이지 않는다 — 「연결한 초과분」 목록이 서버에 없다(사용자 결정 2026-10-27 「해제는 나중에」).
   */
  const unlinkedExcesses = useUnallocatedLines({ size: EXCESS_PAGE_SIZE });
  const excessAvailable =
    unlinkedExcesses.isSuccess && !isExcessUnavailable(unlinkedExcesses.error);
  const lineRows = lines.data?.items ?? EMPTY_LINES;
  const lineExcesses = useMemo(
    () =>
      excessesByLine(
        lineRows,
        excessAvailable ? (unlinkedExcesses.data?.items ?? NO_EXCESSES) : NO_EXCESSES,
      ),
    [lineRows, excessAvailable, unlinkedExcesses.data],
  );

  /*
   * 초과분 연결은 **둘째 탭**이다(사용자 지시 2026-10-28 — 옛 오른쪽 창을 탭으로 뗐다). 라인 표의 「초과분」 칸 · 입하 등록
   * 결과의 「초과분 연결」은 그 탭을 초과분 · 라인을 고른 채로 연다. 보던 발주는 함께 넘겨 후보에 표식을 단다.
   */
  const navigate = useNavigate();
  const openExcess = (entry: Partial<ExcessEntry> = {}): void => {
    void navigate(
      excessTabHref({ ...entry, purchaseOrderId: selectedOrder?.purchaseOrderId ?? null }),
    );
  };

  /*
   * 단계 칩 — 탭 막대 오른쪽(셸의 일 단추 자리). 누르면 그 묶음의 LOT 이 있는 발주만 남는다(조건이 바뀌니 첫 쪽으로).
   * 서버가 묶음 수를 셀 수 없으면(404·403) 세우지 않는다 — 조건·머리 건수·행 칩은 같은 기준이어야 한다(C-17).
   */
  const hubActions = useHubActionsTarget();
  const stageChips =
    stageAvailable && stageCounts.data !== undefined ? (
      <div className="po-board-bar-tools">
        <StageChips
          counts={stageCounts.data.counts}
          active={filters.stage}
          onChange={(next) => {
            applyQuery(period, { ...filters, stage: next });
          }}
        />
      </div>
    ) : null;

  /** 발주를 고른다 — 조건·쪽은 그대로 두고 `po` 만 바꾼다. 앞 발주의 입고 결과·실패는 걷는다. */
  const selectOrder = (purchaseOrderId: number): void => {
    const next = toSearchParams(period, filters, page, fallbackPeriod);
    next.set('po', String(purchaseOrderId));
    setSearchParams(next);
  };

  /** 고른 발주를 다시 누르면 고르기를 푼다 — 결과가 하나뿐일 때 저절로 다시 고르지 않게 `po` 를 비운 표시로 둔다. */
  const clearOrder = (): void => {
    const next = toSearchParams(period, filters, page, fallbackPeriod);
    next.set('po', PO_CLEARED);
    setSearchParams(next);
  };

  /* 옛 「초과분 연결」 창 주소(`excess=1`)는 탭으로 옮긴다 — 즐겨찾기 · 공유한 주소가 죽지 않게. */
  const legacyExcess = readLegacyExcessEntry(searchParams);
  if (legacyExcess !== null) return <Navigate to={excessTabHref(legacyExcess)} replace />;

  return (
    <>
      {/*
       * 이름 「입고 관리」와 「초과분 발주 연결」은 셸의 탭 막대가 세운다(2026-10-28 탭 묶음). 단계 칩은 그 막대 오른쪽 자리에
       * 넣는다 — 셸이 자리를 그리지 않았으면(화면만 그린 시험) 서지 않는다.
       */}
      {hubActions !== null && stageChips !== null && (
        <HubActions target={hubActions}>{stageChips}</HubActions>
      )}

      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 자료가 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      {/*
       * 조건과 목록을 다른 구획에 둔다 — 한 상자에 있으면 조건 줄의 끝과 표의 시작이 갈리지 않는다.
       * 결과가 없어도 조건 구획은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다.
       */}
      <section ref={aboveRef} className="pane po-board-filter" aria-label={t.panes.filter}>
        <ScheduleFilterBar
          appliedPeriod={period}
          appliedFilters={filters}
          fallbackPeriod={fallbackPeriod}
          plantOptions={toSelectOptions(plants)}
          chipNames={{
            plant: describeReference(
              toReference(plants, filters.plant === '' ? null : Number(filters.plant)),
            ),
            item: appliedItemId === null ? '' : describeReference(itemNames.of(appliedItemId)),
          }}
          plantNote={lookupNote(plants)}
          onSearch={(nextPeriod, nextFilters) => {
            /* 품목코드 칸에 친 값이 남아 있으면 「조회」도 Enter 와 같이 그 품목을 찾는다(2026-10-21 보고). */
            if (quickRef.current?.submit(nextPeriod, nextFilters) === true) return;
            applyQuery(nextPeriod, nextFilters);
          }}
          onRemoveFilter={(key) => {
            applyQuery(period, clearFilter(filters, key));
          }}
          onReset={() => {
            applyQuery(fallbackPeriod, DEFAULT_FILTERS);
          }}
          quick={
            <QuickLookupBar
              ref={quickRef}
              appliedPeriod={period}
              appliedFilters={filters}
              onApply={(nextPeriod, nextFilters) => {
                applyQuery(nextPeriod, nextFilters);
              }}
            />
          }
          quickMore={
            <QuickToggles
              appliedPeriod={period}
              appliedFilters={filters}
              today={today}
              fallbackPeriod={fallbackPeriod}
              onApply={(nextPeriod, nextFilters) => {
                applyQuery(nextPeriod, nextFilters);
              }}
            />
          }
        />
      </section>

      {/* 왼쪽 표를 접으면(사용자 지시 2026-10-24) 오른쪽 구획이 폭을 다 쓴다 — 나란히 설 때만(app.css). */}
      <div
        ref={splitRef}
        className="po-board-split"
        style={split.style}
        data-left-collapsed={split.collapsed ? 'true' : undefined}
      >
        <section className="pane po-board-pane" aria-label={t.panes.orders}>
          <PaneListHead title={t.panes.orders} collapse={listCollapse} />
          {!list.isError && (
            <>
              <OrderTable
                rows={rows}
                isLoading={(list.isPending && listQuery !== null) || resolvingInboundLot}
                hasQuery={listQuery !== null || resolvingInboundLot}
                isBeyondLast={pageView.isBeyondLast}
                today={today}
                selectedId={selectedOrder?.purchaseOrderId ?? null}
                onSelect={selectOrder}
                onClearSelection={clearOrder}
                onFirstPage={() => {
                  applyQuery(period, filters);
                }}
                sort={filters.sort}
                onSortChange={(next) => {
                  /*
                   * 순서가 바뀌면 쪽의 뜻도 바뀐다 — 첫 쪽부터 다시 받는다. 고른 발주는 남긴다 — 정렬은 결과를 바꾸지 않는다
                   * (첫 쪽에 없으면 오른쪽은 「발주를 고르세요」다 — 조건을 바꿀 때와 같다).
                   */
                  const nextParams = toSearchParams(
                    period,
                    { ...filters, sort: next },
                    1,
                    fallbackPeriod,
                  );
                  const po = searchParams.get('po');
                  if (po !== null) nextParams.set('po', po);
                  setSearchParams(nextParams);
                }}
              />
              {listQuery !== null && !list.isPending && (
                <PageNav
                  view={pageView}
                  onChange={(nextPage) => {
                    applyQuery(period, filters, nextPage);
                  }}
                />
              )}
            </>
          )}
        </section>

        <PaneSplitter
          label={t.splitter}
          ratio={split.ratio}
          onChange={split.commit}
          collapse={listCollapse}
        />

        <section className="pane po-board-pane" aria-label={t.panes.lines}>
          {lines.isError ? (
            <LoadErrorBanner
              error={lines.error}
              onRetry={() => {
                void lines.refetch();
              }}
            />
          ) : (
            <LineTable
              order={selectedOrder}
              rows={lineRows}
              isLoading={lines.isPending}
              storageLocationNameOf={storageLocationNameOf}
              matchedItemId={appliedItemId}
              lineExcesses={lineExcesses}
              onOpenExcess={openExcess}
              {...(progressUnavailable || lotsByLine === undefined ? {} : { lots: lotsByLine })}
              progressFailed={progress.isError && !progressUnavailable}
              canOpenWorkRecord={toWebAccess(session?.permissions).allows(WORK_RECORD_PATH)}
            />
          )}
        </section>
      </div>
    </>
  );
};
