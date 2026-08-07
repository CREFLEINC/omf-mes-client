import { Breadcrumb, Button, PageHeader, Tabs, type TabItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { formatAsOf } from './as-of';
import { BalanceFilterBar } from './balance-filter-bar';
import { BalanceTable } from './balance-table';
import {
  PLACEHOLDER_INVENTORY_STATUS_CODES,
  PLACEHOLDER_OWNERSHIP_TYPE_CODES,
  PLACEHOLDER_QUALITY_STATUS_CODES,
  toCodeOptions,
} from './code-options';
import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  readSortParam,
  readViewParam,
  toBalanceFilterQuery,
  toSearchParams,
  type BalanceFilters,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeReference,
  lookupNote,
  toReference,
  useItemOptions,
  useLocationOptions,
  useLotOptions,
  usePartnerOptions,
  useUomOptions,
  useWarehouseOptions,
  type LookupResult,
} from './lookups';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { useBalanceList, type BalanceListQuery } from './queries';
import { defaultSortKey, nextSortKey, readSortKey, toSortQuery, type SortKey } from './sort';
import type { BalanceView, SelectOption } from './types';
import { readViewAxis, toGroupByQuery, VIEW_AXES, type ViewAxis } from './view-axis';

const t = messages.stockStatus;

/** 참조가 매 렌더 새로 만들어지면 이 값을 의존성에 둔 계산이 멈추지 않는다. */
const EMPTY_ROWS: BalanceView[] = [];

/**
 * 참조 목록을 선택지로 옮긴다.
 *
 * **미사용 값을 빼지 않고 표식만 붙인다.** 참조를 `includeInactive=true`로 받는 이유는
 * 미사용 값을 참조하는 과거 재고의 이름을 풀기 위해서인데, 그 재고를 **조건으로 찾으려면**
 * 선택지에도 있어야 한다. 표식은 저장소 관례를 따른다(W-CO-02의 「(미사용)」).
 *
 * **표 칸에는 붙이지 않는다** — `ReferenceState`가 사용 여부를 나르지 않고, 표는 그 값의
 * 이름만 말하면 된다. 표식이 필요한 자리는 「고를 때」다.
 */
const toSelectOptions = (lookup: LookupResult): SelectOption[] =>
  lookup.entries.map((entry) => ({
    value: entry.value,
    label: entry.isActive ? entry.label : `${entry.label}${t.values.inactiveSuffix}`,
  }));

/** 조건 문자열을 참조 조회에 쓸 번호로 옮긴다. 비어 있으면 그 참조를 부르지 않는다. */
const toLookupId = (value: string): number | null => (value === '' ? null : Number(value));

/**
 * W-01-07 컨테이너 — **묶는 축을 바꿔 가며 보는 목록**이다.
 *
 * 조회 전용이라 편집 폼이 없다. 배치는 상하 1단이다(작업 1 기준) — 조건 줄 + 보기 탭 + 잔액 표.
 * 조회 조건·보기·정렬·쪽은 전부 주소가 소유한다 — 새로고침·뒤로가기·공유가 같은 결과를 낸다.
 *
 * **W-01-09(`inbound-schedule`)의 골격을 따르되 세 가지가 정반대다.** 베끼면 틀린다:
 *
 * | | W-01-09 | 이 화면 |
 * | --- | --- | --- |
 * | 조건 | 하나도 없어도 조회한다 | **창고가 필수다** — 없으면 요청이 0회 |
 * | 정렬 | 표가 현재 쪽 안에서 정렬한다 | **서버가 전체를 정렬**하고 정렬 변경이 쪽을 되돌린다 |
 * | 참조 | 넷을 조건 없이 늘 부른다 | **둘이 조건에 매달린다**(위치←창고, LOT←품목+보기) |
 */
export const StockStatusScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  /**
   * **주소 키의 수명 — 무엇이 바뀔 때 무엇을 비우는가.**
   *
   * 이 화면 최대의 위험 자리다. 「비운다」와 「비우지 않는다」를 이 표 한 곳에 모은다 —
   * 규칙이 흩어지면 한쪽만 고쳐져 비대칭이 생긴다(보기를 바꾸면 선택이 풀리는데 쪽을 옮기면
   * 안 풀리는 식).
   *
   * | # | 조작 | `view` | 조건 8종 | `sort` | `page` | `sel` | `hfrom`·`hto` | `tx` | 조건 줄 초안 |
   * | :-: | --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
   * | 1 | **보기 전환** | 바뀐다 | **유지** | **보기 기본값으로** | **첫 쪽** | **비운다** | 비운다 | 비운다 | **유지** |
   * | 2 | 조건 변경·조회 | 유지 | 바뀐다 | 유지 | **첫 쪽** | **비운다** | 비운다 | 비운다 | (적용됨) |
   * | 3 | 초기화 | 유지 | **비운다**(창고 포함) | 보기 기본값 | 첫 쪽 | 비운다 | 비운다 | 비운다 | 비운다 |
   * | 4 | 정렬 열 변경·해제 | 유지 | 유지 | 바뀐다 | **첫 쪽** | **비운다** | 비운다 | 비운다 | 유지 |
   * | 5 | 쪽 이동 | 유지 | 유지 | 유지 | 옮긴 쪽 | **비운다** | 비운다 | 비운다 | 유지 |
   * | 6 | LOT 고르기·해제 | 유지 | 유지 | 유지 | **유지** | 넣고 뺀다 | **기본 1개월로 채운다** | 비운다 | 유지 |
   * | 7 | 갱신 결과에 고른 LOT 없음 | 유지 | 유지 | 유지 | 유지 | **비운다** | 비운다 | 비운다 | 유지 |
   * | 8 | **새로고침**(재조회) | 유지 | 유지 | 유지 | 유지 | **유지** | **유지** | **유지** | 유지 |
   * | 9 | 이력 기간 변경·조회 | 유지 | 유지 | 유지 | 유지 | 유지 | 바뀐다 | **비운다** | (적용됨) |
   * | 10 | 거래 고르기·해제 | 유지 | 유지 | 유지 | 유지 | 유지 | 유지 | 넣고 뺀다 | 유지 |
   *
   * **왜 이렇게 정했는가**
   *
   * - **1행의 `sort`가 「유지」가 아닌 이유**: 정렬 열은 보기마다 있고 없다. 위치별 보기의
   *   `locationCode` 정렬을 품목별로 가져가면 계약은 받지만 표에 그 열이 없어 **정렬 표시가
   *   어디에도 나타나지 않는 상태**가 된다.
   * - **1행의 조건이 「유지」인 이유**: 계약 실측상 조건 전부가 세 `groupBy` 값에서 동일하게
   *   받아들여진다. 축을 바꿨다고 조건을 버리면 사용자가 방금 좁힌 범위가 사라진다.
   * - **4행이 첫 쪽으로 되돌아가는 이유**: 이 화면의 정렬은 **서버 정렬**이라 전체 순서가 바뀐다
   *   (W-01-09와 반대다 — 그쪽은 쪽 안 정렬이라 쪽을 건드리지 않았다). 3쪽의 뜻이 달라진다.
   * - **8행이 아무것도 비우지 않는 이유**: 새로고침은 **같은 조회를 다시 하는 것**이다.
   *   무언가를 비우면 새로고침이 조건 변경으로 둔갑한다.
   *
   * **구현 규칙 둘** — 이 둘이 표를 코드로 지킨다.
   *
   * 1. `toSearchParams(view, filters, sort, page)`가 **`sel`·`hfrom`·`hto`·`tx`를 만들지 않는다.**
   *    1~5행이 함께 지켜진다. 고르는 쪽만 덧붙인다(작업 2·3).
   * 2. 7행은 **고른 식별자에 묶인 effect 한 곳**이 한다(작업 2). 클릭 핸들러에 두면
   *    뒤로가기·앞으로가기·주소 직접 편집이 통째로 샌다.
   *
   * **비우는 자리는 이 열 줄뿐이고, 열한째가 생기면 이 표에 행을 먼저 더한다.**
   *
   * 6~10행은 작업 2·3(LOT 상세 · 수불 이력)의 몫이다. 표를 지금 다 적어 두는 이유는,
   * 나중에 더하는 사람이 이미 정해진 규칙을 다시 정하지 않게 하기 위해서다.
   */
  /*
   * **주소가 바뀔 때만 새 참조를 만든다.** 렌더마다 새 객체를 만들면 내용이 같아도 참조가 달라,
   * 이 값을 되돌림 기준으로 삼는 조건 줄이 **부모가 다시 그려질 때마다** 입력을 덮어쓴다(#43).
   * 조회 응답이 도착하는 순간(대기 → 성공)이 실제로 그 자리이며, 사용자에게는
   * 「고르던 값이 갑자기 사라졌다」로 나타난다. `searchParams`는 주소가 바뀔 때만 새 참조다.
   */
  const filters = useMemo<BalanceFilters>(() => readFilters(searchParams), [searchParams]);
  const view = readViewAxis(readViewParam(searchParams));
  const sortKey = readSortKey(readSortParam(searchParams), view);
  const page = readPage(searchParams);

  const warehouseId = toLookupId(filters.warehouse);
  const itemId = toLookupId(filters.item);

  /*
   * **창고를 고르기 전에는 조회하지 않는다**(계획 결정 5). 계약은 「창고·품목·LOT 중 적어도
   * 하나」를 요구하지만 이 화면은 그보다 좁게 창고를 필수로 둔다 —
   * **창고 필수는 이 화면의 규칙이지 계약의 규칙이 아니다.** 현장 단말(M-01-04)은 LOT만 들고
   * 같은 API로 들어오므로, 다음 화면이 이 코드를 보고 계약을 잘못 읽지 않게 여기에 적어 둔다.
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

  /*
   * **기준 시각은 응답이 도착한 시각이다.** 렌더 시각을 쓰면 아무것도 안 했는데 시각이
   * 계속 바뀌어, 사용자가 자료가 갱신되고 있다고 읽는다.
   */
  const asOf = formatAsOf(list.data === undefined ? null : list.dataUpdatedAt);

  /*
   * **LOT별 보기는 품목을 고른 뒤에만 연다**(계획 결정 11). 품목이 LOT 이름을 풀 범위를 정한다 —
   * 열어 두면 표의 LOT 칸이 거의 전부 「알 수 없음」이 되어 정상 값이 잘못된 값으로 보인다(#47).
   *
   * 위치 선택칸이 창고에 매달리는 것(결정 5)과 **같은 갈래의 규칙**이다.
   */
  const canUseLotView = itemId !== null;

  const warehouses = useWarehouseOptions();
  /* 매달림은 `enabled`로만 표현한다 — 화면이 조건을 다시 계산하면 두 곳이 어긋난다. */
  const locations = useLocationOptions(warehouseId);
  const items = useItemOptions();
  const lots = useLotOptions(itemId, view === 'lot');
  const uoms = useUomOptions();
  const partners = usePartnerOptions();

  /**
   * 조건을 주소에 반영한다. 주소가 정본이라 조회는 주소가 바뀐 결과로 일어난다.
   *
   * **주소 갱신은 한 번이다** — 조건과 쪽을 따로 갱신하면 뒤로가기 기록이 두 칸 늘어
   * 사용자가 뒤로 눌렀는데 같은 자리로 돌아온 것처럼 보인다.
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
   * 보기 전환(수명 표 1행).
   *
   * 조건은 그대로 두고 **정렬을 그 보기의 기본값으로, 쪽을 첫 쪽으로** 되돌린다.
   * `toSearchParams`가 `sel`을 만들지 않으므로 고른 LOT도 함께 풀린다(작업 2).
   */
  const changeView = (nextValue: string): void => {
    const nextView = readViewAxis(nextValue);

    if (nextView === view) return;

    apply(nextView, filters, defaultSortKey(nextView));
  };

  /**
   * 정렬 열 변경·해제(수명 표 4행).
   *
   * **첫 쪽으로 되돌린다** — 서버가 전체 결과를 다시 정렬해 쪽을 나누므로 지금 쪽 번호의 뜻이
   * 달라진다. 그대로 두면 사용자가 보던 것과 무관한 행이 온다.
   */
  const changeSort = (next: Parameters<typeof nextSortKey>[1]): void => {
    apply(view, filters, nextSortKey(sortKey, next, view));
  };

  /**
   * 참조 실패의 복구 경로 — **이름이 보이는 자리마다 하나씩** 둔다.
   *
   * 나누는 기준은 「그 이름이 어느 구획에서 보이는가」다. 실패 안내와 「다시 시도」는
   * 그 이름이 실제로 실패로 보이는 자리에 있어야 사용자가 무엇을 되살리는지 알 수 있고,
   * **안내 문구가 적은 대상과 다시 부르는 대상이 어긋나지 않는다** — 어긋나면 눌러도
   * 한쪽은 실패인 채로 남는데 문구는 둘 다 고쳐질 것처럼 말한다.
   *
   * | 참조 | 언제 부르나 | 이름이 보이는 자리 | 복구 |
   * | --- | --- | --- | --- |
   * | 창고 | 항상 | 조건 줄 선택칸 · 조건 칩 | **조건 줄** |
   * | 위치 | **창고를 고른 뒤** | 조건 줄 · 위치별 보기의 그룹 헤더·열 | **조건 줄** |
   * | 품목 | 항상 | 조건 줄 · 세 보기의 품목 열·그룹 헤더 | **조건 줄** |
   * | LOT | **품목 + LOT별 보기** | 조건 줄 · LOT별 보기의 LOT 열 | **조건 줄** |
   * | 단위 | 항상 | 세 보기의 단위 열 | **목록 구획** |
   * | 소유처 | 항상 | 세 보기의 소유 열 | **목록 구획** |
   *
   * 앞 넷이 조건 줄인 이유가 이 표의 요점이다 — 넷 다 **선택칸에 이름이 실린다.**
   * 뒤 둘은 조건에 없어 표에서만 보이므로 목록 구획이 소유한다.
   * **일곱째 참조가 생기면 이 표에 먼저 줄을 더한다.**
   */
  const filterReferences = [warehouses, locations, items, lots];
  const listReferences = [uoms, partners];

  const retryFilterReferences = (): void => {
    for (const reference of filterReferences) reference.refetch();
  };

  const retryListReferences = (): void => {
    for (const reference of listReferences) reference.refetch();
  };

  /**
   * 보기 탭. **활성 보기의 `content`에만 표를 담는다** — `Tabs`는 패널을 전부 렌더하고
   * 비활성만 감추므로, 세 패널에 표를 두면 같은 자료가 세 번 그려지고 접근성 트리에
   * 표가 셋이 된다.
   *
   * **조회에 실패하면 표를 그리지 않는다.** 행이 0건인 표는 「결과가 없습니다」를 내는데,
   * 실패를 그렇게 말하면 사용자가 자료가 없는 줄 알고 조건을 넓힌다 — 무엇을 해도 결과가 같다.
   * 배너가 사유와 「다시 시도」를 이미 내고 있다. 조건 줄과 보기 탭은 남긴다 —
   * 조건을 고칠 수단까지 사라지면 안 된다.
   */
  const balancePane = list.isError ? null : (
    <>
      <BalanceTable
        view={view}
        rows={rows}
        isLoading={list.isPending && listQuery !== null}
        hasQuery={listQuery !== null}
        isBeyondLast={pageView.isBeyondLast}
        sortKey={sortKey}
        onSortChange={changeSort}
        onFirstPage={() => {
          apply(view, filters, sortKey);
        }}
        itemLookup={items}
        lotLookup={lots}
        locationLookup={locations}
        uomLookup={uoms}
        partnerLookup={partners}
        onRetryReferences={retryListReferences}
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

  const tabItems: TabItem[] = VIEW_AXES.map((axis) => ({
    value: axis,
    label: t.views[axis],
    /* LOT별만 잠긴다. 사유는 탭 아래 안내가 밝힌다 — 잠긴 탭은 포커스를 받지 못한다. */
    disabled: axis === 'lot' && !canUseLotView,
    content: axis === view ? balancePane : null,
  }));

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <>
            {/*
             * 조회 시점 스냅샷임을 밝힌다 — 이 화면은 자동으로 갱신되지 않는다.
             * 조회하기 전에는 가리킬 시각이 없어 내지 않는다.
             */}
            {asOf !== null && (
              <output data-testid="as-of" className="field-note">
                {t.asOf(asOf)}
              </output>
            )}
            <Button
              variant="outlined"
              size="sm"
              disabled={listQuery === null}
              onClick={() => {
                void list.refetch();
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

      <section className="pane" aria-label={t.panes.list}>
        {/* 결과가 없어도 조건 줄은 감추지 않는다 — 조건을 고칠 수단이 사라지면 안 된다. */}
        <BalanceFilterBar
          appliedFilters={filters}
          warehouseOptions={toSelectOptions(warehouses)}
          itemOptions={toSelectOptions(items)}
          lotOptions={toSelectOptions(lots)}
          locationOptions={toSelectOptions(locations)}
          qualityStatusOptions={toCodeOptions(
            PLACEHOLDER_QUALITY_STATUS_CODES,
            rows,
            (row) => row.qualityStatusCode,
            filters.qualityStatus,
          )}
          inventoryStatusOptions={toCodeOptions(
            PLACEHOLDER_INVENTORY_STATUS_CODES,
            rows,
            (row) => row.inventoryStatusCode,
            filters.inventoryStatus,
          )}
          ownershipOptions={toCodeOptions(
            PLACEHOLDER_OWNERSHIP_TYPE_CODES,
            rows,
            (row) => row.ownershipTypeCode,
            filters.ownership,
          )}
          chipNames={{
            warehouse: describeReference(toReference(warehouses, warehouseId)),
            item: describeReference(toReference(items, itemId)),
            lot: describeReference(toReference(lots, toLookupId(filters.lot))),
            location: describeReference(toReference(locations, toLookupId(filters.location))),
          }}
          warehouseNote={lookupNote(warehouses)}
          itemNote={lookupNote(items)}
          /* 매달린 조건이 비어 선택지가 없는 것을 「그런 값이 없다」로 읽지 않게 한다. */
          lotNote={canUseLotView && view === 'lot' ? lookupNote(lots) : t.filters.lotNeedsItem}
          locationNote={
            warehouseId === null ? t.filters.locationNeedsWarehouse : lookupNote(locations)
          }
          referencesFailed={filterReferences.some((reference) => reference.isError)}
          onRetryReferences={retryFilterReferences}
          onSearch={(nextFilters) => {
            apply(view, nextFilters, sortKey);
          }}
          onRemoveFilter={(key) => {
            apply(view, { ...filters, [key]: key === 'includeZero' ? false : '' }, sortKey);
          }}
          onReset={() => {
            apply(view, EMPTY_FILTERS, defaultSortKey(view));
          }}
        />

        <Tabs aria-label={t.views.label} items={tabItems} value={view} onChange={changeView} />

        {/* 잠긴 탭은 포커스를 받지 못해 사유를 자기 안에 담을 수 없다. 탭 밖에 둔다. */}
        {!canUseLotView && <p className="field-note">{t.reasons.lotViewNeedsItem}</p>}
      </section>
    </>
  );
};
