import { messages } from '@omf-mes/i18n';
import { useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router';

import { plantToday } from '../../patterns/plant-time';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { ScheduleFilterBar } from './filter-bar';
import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  toFilterQuery,
  toSearchParams,
  type ScheduleFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemNames,
  usePlantOptions,
  useStorageLocationNames,
  useSupplierOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { QuickLookupBar, type QuickLookupHandle } from './quick-lookup-bar';
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
 * W-01-09 컨테이너 — 「입고 관리」 허브의 첫 탭이다. **제목·경로 표시를 두지 않는다** — 탭 이름과 겹친다
 * (사용자 지시 2026-10-21).
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
 * 조회 전용이라 편집 폼이 없다. 조회 조건과 쪽은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가
 * 같은 결과를 낸다. 조건이 바뀌면 쪽은 첫 쪽으로 돌아간다(`applyQuery`).
 */
export const InboundScheduleScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { splitRef, aboveRef } = useFitToViewport();
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
  const listQuery: PurchaseOrderSummaryQuery | null =
    periodReason === null
      ? {
          /* 지연은 납기 기간과 상관없이 늦은 발주 전부다(사용자 지시 2026-10-21) — 기간을 싣지 않는다. */
          ...(filters.overdueOnly ? {} : toPeriodQuery(period)),
          ...toFilterQuery(filters),
          ...(page > 1 ? { page } : {}),
          size: LIST_PAGE_SIZE,
        }
      : null;

  const list = usePurchaseOrderSummaries(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /*
   * 고른 발주. 주소의 `po` 가 이 쪽 결과에 있으면 그것, 없고 결과가 하나뿐이면 그것이다.
   * 주소의 발주가 결과에 없으면(조건을 바꿔 빠졌다) 오른쪽을 비운다 — 보이지 않는 발주의 라인을 내면
   * 왼쪽과 어긋난다.
   */
  const poParam = Number(searchParams.get('po') ?? '');
  const selectedOrder =
    rows.find((row) => row.purchaseOrderId === poParam) ??
    (rows.length === 1 ? (rows[0] ?? null) : null);
  const lines = usePurchaseOrderLines(selectedOrder?.purchaseOrderId ?? null);

  const suppliers = useSupplierOptions();
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

  /** 발주를 고른다 — 조건·쪽은 그대로 두고 `po` 만 바꾼다. */
  const selectOrder = (purchaseOrderId: number): void => {
    const next = toSearchParams(period, filters, page, fallbackPeriod);
    next.set('po', String(purchaseOrderId));
    setSearchParams(next);
  };

  return (
    <>
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
            supplier: describeReference(
              toReference(suppliers, filters.supplier === '' ? null : Number(filters.supplier)),
            ),
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
            applyQuery(period, { ...filters, [key]: '' });
          }}
          onReset={() => {
            applyQuery(fallbackPeriod, DEFAULT_FILTERS);
          }}
          quick={
            <QuickLookupBar
              ref={quickRef}
              appliedPeriod={period}
              appliedFilters={filters}
              today={today}
              fallbackPeriod={fallbackPeriod}
              supplierOptions={toSelectOptions(suppliers)}
              supplierNote={lookupNote(suppliers)}
              onApply={(nextPeriod, nextFilters) => {
                applyQuery(nextPeriod, nextFilters);
              }}
            />
          }
        />
      </section>

      <div ref={splitRef} className="po-board-split" style={split.style}>
        <section className="pane po-board-pane" aria-label={t.panes.orders}>
          {!list.isError && (
            <>
              <OrderTable
                rows={rows}
                isLoading={list.isPending && listQuery !== null}
                hasQuery={listQuery !== null}
                isBeyondLast={pageView.isBeyondLast}
                today={today}
                selectedId={selectedOrder?.purchaseOrderId ?? null}
                onSelect={selectOrder}
                onFirstPage={() => {
                  applyQuery(period, filters);
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

        <PaneSplitter label={t.splitter} ratio={split.ratio} onChange={split.commit} />

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
              rows={lines.data?.items ?? EMPTY_LINES}
              isLoading={lines.isPending}
              storageLocationNameOf={storageLocationNameOf}
              matchedItemId={appliedItemId}
            />
          )}
        </section>
      </div>
    </>
  );
};
