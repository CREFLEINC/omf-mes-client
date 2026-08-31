import {
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
  type SortState,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import {
  lookupDisplayLabel,
  selectableLookupOptions,
  type LookupSource,
} from '../../patterns/lookup-display';
import { formatAsOf } from './as-of';
import { BalanceFilterBar } from './balance-filter-bar';
import { BalanceTable } from './balance-table';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  readSelectedLotId,
  readSortParam,
  readViewParam,
  SELECTION_KEYS,
  toBalanceFilterQuery,
  toSearchParams,
  type BalanceFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  useItemOptions,
  useLocationOptions,
  useLotOptions,
  useWarehouseOptions,
  type ReferenceOptionsResult,
} from './lookups';
import { LotDetailPane } from './lot-detail-pane';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { useBalanceList, useLotDetail, type BalanceListQuery } from './queries';
import { nextSortKey, readSortKey, toSortQuery, type SortKey } from './sort';
import { SummaryPanel } from './summary-panel';
import type { BalanceView } from './types';
import { resolveViewAxis, toGroupByQuery, type ViewAxis } from './view-axis';

const t = messages.productStockStatus;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: BalanceView[] = [];

/** 조건 문자열을 참조 조회에 쓸 번호로 옮긴다. 비어 있으면 그 참조를 부르지 않는다. */
const toLookupId = (value: string): number | null => (value === '' ? null : Number(value));

/** 선택칸 아래 안내. 실패가 잘림보다 앞선다 — 실패한 목록은 낡은 것으로 읽혀야 한다. */
const lookupNote = (result: {
  isError: boolean;
  data?: ReferenceOptionsResult;
}): string | undefined => {
  if (result.isError) return t.filters.lookupFailed;
  if (result.data?.isTruncated === true) return t.filters.lookupTruncated;

  return undefined;
};

/**
 * W-04-08 컨테이너 — 완제품 재고·Lot Status 조회. 창고를 고르면 목록+요약을 내려받고,
 * 「묶기」로 품목별·LOT별·위치별을 오간다. LOT을 고르면 아래 구획에 해제되지 않은 보류가 열린다.
 *
 * **W-01-07(재고 현황·상태 조회)의 골격을 따르되 계획이 정한 대로 크게 좁혔다** —
 * 위치·LOT·품질 상태·소유 구분 조건, 수불 이력 구획, 6종 참조 훅이 없다. 대신 이 화면이
 * 쓰는 API 타입에 아직 이름 인라인이 없어(`types.ts`) 품목·LOT·위치 이름 참조 셋은 그대로
 * 남았다.
 *
 * 조회 조건·보기·정렬·쪽은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 */
export const ProductStockStatusScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가
   * 달라, 이 값을 되돌림 기준으로 삼는 조건 줄이 부모가 다시 그려질 때마다 입력을 덮어쓴다.
   */
  const filters = useMemo<BalanceFilters>(() => readFilters(searchParams), [searchParams]);

  const warehouseId = toLookupId(filters.warehouse);
  const itemId = toLookupId(filters.item);

  /*
   * **보기를 조건보다 뒤에 읽는다.** LOT별 보기가 품목에 매달리므로(`view-axis.ts`) 어느
   * 보기를 열 수 있는지는 조건이 정한다.
   */
  const view = resolveViewAxis(readViewParam(searchParams), itemId !== null);
  const sortKey = readSortKey(readSortParam(searchParams), view);
  const page = readPage(searchParams);

  /*
   * 고른 LOT도 읽는 자리에서 뜻을 판정한다 — 가리킬 줄이 있으려면 LOT별 보기이고 창고가
   * 있어야 한다(창고가 없으면 목록 요청이 0회라 고른 줄이 영영 오지 않는다).
   */
  const selectedLotId =
    view === 'lot' && warehouseId !== null ? readSelectedLotId(searchParams) : null;

  /**
   * **창고를 고르기 전에는 조회하지 않는다.** 계약은 「창고·품목·LOT 중 적어도 하나」를
   * 요구하지만, 이 화면은 그보다 좁게 창고를 필수로 둔다 — 전 창고 조회는 무겁다.
   */
  const listQuery: BalanceListQuery | null =
    warehouseId === null
      ? null
      : {
          ...toGroupByQuery(view),
          ...toBalanceFilterQuery(filters),
          ...toSortQuery(sortKey),
          warehouseId,
          ...(page > 1 ? { page } : {}),
        };

  const list = useBalanceList(listQuery);
  const rows = list.data?.items ?? EMPTY_ROWS;
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /** 고른 줄. 목록 응답에서 찾는다 — 상세 구획의 이름 표시가 이 줄의 `lotId`에서 온다. */
  const selectedRow = rows.find((row) => row.lotId === selectedLotId) ?? null;

  const lotDetail = useLotDetail(selectedLotId);

  /*
   * **기준 시각은 응답이 도착한 시각이다.** 렌더 시각을 쓰면 아무것도 안 했는데 시각이
   * 계속 바뀌어, 사용자가 자료가 갱신되고 있다고 읽는다.
   */
  const asOf = formatAsOf(list.data === undefined ? null : list.dataUpdatedAt);

  /**
   * LOT별 보기는 품목을 고른 뒤에만 연다(`view-axis.ts`) — 품목이 LOT 이름을 풀 범위를
   * 정한다.
   */
  const canUseLotView = itemId !== null;

  const warehouses = useWarehouseOptions();
  const items = useItemOptions();
  /* 매달림은 `enabled`로만 표현한다 — 화면이 조건을 다시 계산하면 두 곳이 어긋난다. */
  const locations = useLocationOptions(warehouseId);
  const lots = useLotOptions(itemId, view === 'lot');

  const warehouseSource: LookupSource = {
    entries: warehouses.data?.entries ?? [],
    isError: warehouses.isError,
    isLoading: warehouses.isPending,
  };
  const itemSource: LookupSource = {
    entries: items.data?.entries ?? [],
    isError: items.isError,
    isLoading: items.isPending,
  };
  const locationSource: LookupSource = {
    entries: locations.data?.entries ?? [],
    isError: locations.isError,
    /* 부르지 않는 동안을 「아직 오지 않았다」로 두지 않는다 — 창고를 고르기 전의 표는 애초에 그려지지 않는다. */
    isLoading: warehouseId !== null && locations.isPending,
  };
  const lotSource: LookupSource = {
    entries: lots.data?.entries ?? [],
    isError: lots.isError,
    isLoading: view === 'lot' && itemId !== null && lots.isPending,
  };

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 는다.
   */
  const apply = (
    nextView: ViewAxis,
    nextFilters: BalanceFilters,
    nextSort: SortKey | null,
    nextPage = 1,
  ): void => {
    setSearchParams(toSearchParams(nextView, nextFilters, nextSort, nextPage));
  };

  /**
   * 묶기 전환. 조건은 그대로 두고 쪽을 첫 쪽으로 되돌린다. `toSearchParams`가 `sel`을
   * 만들지 않으므로 고른 LOT도 함께 풀린다. 정렬 열은 모든 보기가 `availableQty` 하나를
   * 공유해(`sort.ts`) 그대로 유지해도 유효하다.
   */
  const changeView = (nextView: ViewAxis): void => {
    if (nextView === view) return;

    apply(nextView, filters, sortKey);
  };

  /** 정렬 열 변경·해제 — 첫 쪽으로 되돌린다. 서버가 전체 결과를 다시 정렬해 쪽을 나눈다. */
  const changeSort = (next: SortState | null): void => {
    apply(view, filters, nextSortKey(sortKey, next, view));
  };

  /**
   * LOT 고르기·해제. **보이는 줄을 바꾸지 않는다** — 조건·보기·정렬·쪽을 그대로 두고
   * `sel`만 넣고 뺀다.
   */
  const toggleSelectLot = (lotId: number): void => {
    const next = toSearchParams(view, filters, sortKey, page);

    if (lotId !== selectedLotId) next.set(SELECTION_KEYS.lot, String(lotId));

    setSearchParams(next);
  };

  /*
   * 갱신된 결과에 고른 LOT이 없으면 `sel`을 주소에서 뗀다. 정리를 클릭 핸들러가 아니라
   * 고른 식별자에 묶는다 — 뒤로가기·앞으로가기·주소 직접 편집은 핸들러를 거치지 않는다.
   * `replace`로 바꿔 정리가 뒤로가기 기록을 늘리지 않게 한다.
   */
  useEffect(() => {
    if (selectedLotId === null) return;
    if (list.data === undefined) return;
    if (list.data.items.some((row) => row.lotId === selectedLotId)) return;

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);

        next.delete(SELECTION_KEYS.lot);

        return next;
      },
      { replace: true },
    );
  }, [selectedLotId, list.data, setSearchParams]);

  const retryFilterReferences = (): void => {
    void warehouses.refetch();
    void items.refetch();
  };

  /** 부르지 않는 참조를 다시 부르지 않는다 — 비활성 쿼리의 `refetch`는 `queryFn`을 그대로 실행한다. */
  const retryListReferences = (): void => {
    void items.refetch();
    if (view === 'lot' && itemId !== null) void lots.refetch();
    if (warehouseId !== null) void locations.refetch();
  };

  const listReferencesFailed = items.isError || lots.isError || locations.isError;

  const balancePane = list.isError ? null : (
    <>
      <BalanceTable
        view={view}
        rows={rows}
        isLoading={list.isPending && listQuery !== null}
        hasQuery={listQuery !== null}
        isBeyondLast={pageView.isBeyondLast}
        sortKey={sortKey}
        selectedLotId={selectedLotId}
        onSortChange={changeSort}
        onFirstPage={() => {
          apply(view, filters, sortKey);
        }}
        onToggleSelect={toggleSelectLot}
        itemLookup={itemSource}
        lotLookup={lotSource}
        locationLookup={locationSource}
        onRetryReferences={retryListReferences}
        referencesFailed={listReferencesFailed}
      />
      {listQuery !== null && !list.isPending && (
        <PageNav
          view={pageView}
          onChange={(nextPage) => {
            apply(view, filters, sortKey, nextPage);
          }}
        />
      )}
    </>
  );

  /**
   * LOT 상세 구획. 넷 중 하나만 낸다 — 사용자가 할 조치가 서로 다르다. **상세가 실패해도
   * 위 목록은 그대로 둔다** — 실패한 것은 고른 LOT 한 벌뿐이다.
   */
  const detailPane = (): ReactNode => {
    if (selectedLotId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noSelectionTitle}
          description={t.empty.noSelectionDescription}
        />
      );
    }

    if (lotDetail.isError) {
      return (
        <LoadErrorBanner
          error={lotDetail.error}
          onRetry={() => {
            void lotDetail.refetch();
          }}
        />
      );
    }

    /*
     * 고른 번호는 있는데 그 줄이나 상세가 아직 없다 — 기다리는 중이다. 정리 effect가 결과를
     * 보고 판정할 때까지 「고르지 않았다」로 되돌리지 않는다.
     */
    if (selectedRow === null || lotDetail.data === undefined) {
      return (
        <div role="status" aria-label={t.loading.lotDetail}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return <LotDetailPane row={selectedRow} detail={lotDetail.data} lotLookup={lotSource} />;
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <>
            {asOf !== null && (
              <span data-testid="as-of" className="field-note">
                {t.asOf(asOf)}
              </span>
            )}
            <Button
              variant="outlined"
              size="sm"
              disabled={listQuery === null}
              onClick={() => {
                /*
                 * 화면이 보고 있는 조회를 전부 다시 한다. 조건·보기·정렬·쪽·선택은 하나도
                 * 바꾸지 않는다.
                 */
                void list.refetch();

                if (selectedLotId !== null) void lotDetail.refetch();
              }}
            >
              {t.actions.refresh}
            </Button>
          </>
        }
      />

      {/* 조회 실패는 빈 상태로 오인시키지 않는다 — 「없습니다」로 내면 자료가 없는 줄 안다. */}
      {list.isError && (
        <LoadErrorBanner
          error={list.error}
          onRetry={() => {
            void list.refetch();
          }}
        />
      )}

      <SummaryPanel />

      <section className="pane" aria-label={t.panes.list}>
        <BalanceFilterBar
          appliedFilters={filters}
          view={view}
          canUseLotView={canUseLotView}
          onViewChange={changeView}
          warehouseOptions={selectableLookupOptions(warehouseSource, filters.warehouse)}
          itemOptions={selectableLookupOptions(itemSource, filters.item)}
          chipNames={{
            warehouse: lookupDisplayLabel(warehouseSource, warehouseId),
            item: lookupDisplayLabel(itemSource, itemId),
          }}
          warehouseNote={lookupNote(warehouses)}
          itemNote={lookupNote(items)}
          referencesFailed={warehouses.isError || items.isError}
          onRetryReferences={retryFilterReferences}
          onSearch={(nextFilters) => {
            apply(view, nextFilters, sortKey);
          }}
          onRemoveFilter={(key) => {
            apply(view, { ...filters, [key]: key === 'availableOnly' ? false : '' }, sortKey);
          }}
          onReset={() => {
            apply(view, EMPTY_FILTERS, null);
          }}
        />

        {balancePane}
      </section>

      {/*
       * LOT별 보기에서만 낸다 — 다른 두 보기에는 고를 대상 자체가 없다. 목록이 실패하면
       * 내지 않는다 — 상세는 고른 잔액 줄에서 이름을 받으므로 낼 것이 없다.
       */}
      {view === 'lot' && !list.isError && (
        <section className="pane" aria-label={t.panes.detail}>
          {detailPane()}
        </section>
      )}
    </>
  );
};
