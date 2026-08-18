import { Breadcrumb, Button, EmptyState, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import {
  DEFAULT_FILTERS,
  clearFilter,
  readFilters,
  readPage,
  readSelectedRuleId,
  toSearchParams,
  toSelectionSearchParams,
  type FilterKey,
} from './filters';
import { LoadErrorBanner } from './load-error-banner';
import {
  describeLocation,
  describeReference,
  lookupNote,
  nameLookupTruncatedNote,
  toLocation,
  toReference,
  toSelectOptions,
  useItemLookup,
  useLocationLookup,
  useUomLookup,
  useWarehouseLookup,
} from './lookups';
import { toPageView } from './pagination';
import { useRuleList, useUncoveredItems } from './queries';
import { RuleFilterBar } from './rule-filter-bar';
import { RuleListPane } from './rule-list-pane';
import { UncoveredItemsPane } from './uncovered-items-pane';
import { toRuleView, type PutawayRule, type RuleFilters, type UncoveredItem } from './types';

const t = messages.putawayRule;

/** 참조가 매 렌더 새로 만들어지면 이 값을 읽는 판정이 매번 달라 보인다. */
const EMPTY_RULES: PutawayRule[] = [];
const EMPTY_UNCOVERED: UncoveredItem[] = [];

/**
 * W-06-14 적치 규칙 마스터 — **목록 회차**.
 *
 * ## 이 회차가 하는 것과 하지 않는 것
 *
 * 등록·수정·끄기·켜기와 현재 적재량은 **이 회차에 없다.** 라우트도 열지 않는다 — 끄지 못하는
 * 마스터를 먼저 노출하면 사용자가 잘못 만든 규칙을 지울 수도 끌 수도 없다. 그래서 이 화면은
 * 아직 사용자에게 보이지 않고, 관찰은 시험으로 한다.
 *
 * ## 단계 전이 표
 *
 * | 단계 | 아는 근거 | 보이는 것 | 나가는 요청 |
 * | :-: | --- | --- | --- |
 * | **S0** 창고를 고르기 전 | `wh`가 없다 | 조건 줄 · 「창고를 고르세요」 안내 | **창고 목록뿐** |
 * | **S1** 창고를 골랐다 | `wh`가 있다 | 위 + 목록 표 + 규칙 없는 품목 | 목록 · 규칙 없는 품목 · 위치·품목·단위 이름 |
 * | **S2** 규칙을 골랐다 | `rule`이 있다 | 위 + 그 행에 고름 표시 | S1과 같다(상세는 다음 회차) |
 *
 * **S0에서 아무 조회도 나가지 않는 것이 이 화면의 규율이다.** 계약은 `warehouseId`를 목록
 * 쿼리의 선택 조건으로 두었지만, 창고 없이 부르면 전 창고의 규칙이 섞여 오고 그 목록은 어느
 * 창고의 사실도 아니다 — 위치 이름도, 규칙 없는 품목 수도 창고 하나를 전제로 선다.
 *
 * ## 조작별 상태 표
 *
 * | # | 조작 | 조건 | `page` | `rule` |
 * | :-: | --- | :-: | :-: | :-: |
 * | 1 | 창고 변경 | 바뀐다(품목은 **함께 비운다**) | **첫 쪽** | **비운다** |
 * | 2 | 품목 변경 · 사용 중만 토글 | 바뀐다 | **첫 쪽** | **비운다** |
 * | 3 | 조건 칩 × · 초기화 | 바뀐다 | 첫 쪽 | 비운다 |
 * | 4 | 쪽 이동 | 유지 | 옮긴 쪽 | **비운다** |
 * | 5 | 규칙 고르기 | 유지 | **유지** | 넣는다 |
 * | 6 | 다시 조회 | 유지 | 유지 | **유지** |
 * | 7 | 응답 도착 | 유지 | 유지 | 유지 |
 *
 * **1~4행이 선택을 비우는 이유**: 보이는 행이 달라지므로 고른 규칙이 목록에 없을 수 있다.
 * 목록에 없는 규칙이 골라진 채로 남으면 그것이 어디서 왔는지 화면이 설명할 수 없다.
 * 그 규칙은 `toSearchParams`가 선택 자리를 **만들지 않는 것**으로 한 곳에 모여 있다.
 *
 * **6행이 목록과 규칙 없는 품목을 함께 부르는 이유**: 한쪽만 부르면 갱신된 값과 낡은 값이
 * 한 화면에 섞이고, 규칙을 등록·중지하면 규칙 없는 품목 수도 함께 달라진다.
 */
export const PutawayRuleScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedRuleId = readSelectedRuleId(searchParams);

  /** 창고를 골랐는가. 이 화면의 거의 모든 조회가 이 하나에 걸린다. */
  const warehouseId = filters.warehouseId === '' ? null : Number(filters.warehouseId);

  const list = useRuleList(filters, page);
  const uncovered = useUncoveredItems(warehouseId);

  /* 창고 선택지는 첫 진입에 받는다 — 이 화면은 창고를 고르는 것으로 시작한다. */
  const warehouses = useWarehouseLookup();
  const locations = useLocationLookup(warehouseId);
  const items = useItemLookup(warehouseId !== null);
  const uoms = useUomLookup(warehouseId !== null);

  const rules = useMemo(() => (list.data?.items ?? EMPTY_RULES).map(toRuleView), [list.data]);
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rules.length);

  const warehouseLabelOf = (id: string): string =>
    describeReference(toReference(warehouses, id === '' ? null : Number(id)));
  const itemLabelOf = (itemId: number): string => describeReference(toReference(items, itemId));
  const uomLabelOf = (uomId: number): string => describeReference(toReference(uoms, uomId));
  const locationLabelOf = (locationId: number | null): string =>
    describeLocation(toLocation(locations, locationId));

  /**
   * 조건이 바뀌면 **첫 쪽으로 가고 선택이 사라진다.** 보이는 행이 달라지므로 지금 쪽도 고른
   * 규칙도 그대로 둘 수 없다 — 선택을 지우는 일은 `toSearchParams`가 그 자리를 만들지 않는
   * 것으로 이뤄진다.
   */
  const applyFilters = (next: RuleFilters): void => {
    setSearchParams(toSearchParams(next, 1));
  };

  const handleRemoveFilter = (key: FilterKey): void => {
    applyFilters(clearFilter(filters, key));
  };

  /** 쪽 이동도 보이는 행을 바꾼다 — 선택을 함께 비운다. */
  const handleChangePage = (nextPage: number): void => {
    setSearchParams(toSearchParams(filters, nextPage));
  };

  /** 규칙을 고르는 것은 보이는 행을 바꾸지 않는다 — 조건과 쪽을 그대로 둔다. */
  const handleSelect = (putawayRuleId: number): void => {
    setSearchParams(toSelectionSearchParams(filters, page, putawayRuleId));
  };

  const reloadList = (): void => {
    void list.refetch();
  };

  /**
   * **둘을 함께 부른다.** 규칙을 고치면 규칙 없는 품목 수도 달라지므로 한쪽만 부르면
   * 갱신된 값과 낡은 값이 한 화면에 섞인다.
   */
  const handleReload = (): void => {
    reloadList();
    void uncovered.refetch();
  };

  const listSlot = () => {
    /* 창고를 고르기 전에는 **빈 표가 아니라 안내다** — 빈 표는 「규칙이 없다」로 읽힌다. */
    if (warehouseId === null) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.noWarehouseTitle}
          description={t.empty.noWarehouseDescription}
        />
      );
    }

    return (
      <RuleListPane
        rules={rules}
        isLoading={list.isPending}
        pageView={pageView}
        onChangePage={handleChangePage}
        selectedRuleId={selectedRuleId}
        onSelect={handleSelect}
        itemLabel={itemLabelOf}
        locationLabel={locationLabelOf}
        uomLabel={uomLabelOf}
        /*
         * **위치·단위의 잘림은 표만이 말할 수 있다** — 이 둘은 고르는 칸이 없어
         * `lookupNote`(선택칸 아래 안내)가 닿을 자리가 없다. 창고·품목은 자기 선택칸이 말한다.
         */
        nameLookupNote={nameLookupTruncatedNote(locations, uoms)}
        loadError={
          list.isError ? <LoadErrorBanner error={list.error} onRetry={reloadList} /> : null
        }
      />
    );
  };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
        actions={
          <Button variant="outlined" onClick={handleReload}>
            {t.actions.reload}
          </Button>
        }
      />

      <div className="pane-stack">
        <section className="pane" aria-label={t.panes.list}>
          <RuleFilterBar
            appliedFilters={filters}
            warehouseOptions={toSelectOptions(warehouses)}
            warehouseNote={lookupNote(warehouses)}
            itemOptions={toSelectOptions(items)}
            itemNote={lookupNote(items)}
            warehouseLabel={warehouseLabelOf}
            itemLabel={(itemId) => itemLabelOf(Number(itemId))}
            onApply={applyFilters}
            onRemoveFilter={handleRemoveFilter}
            onReset={() => {
              applyFilters(DEFAULT_FILTERS);
            }}
          />
          {listSlot()}
        </section>

        {/*
         * 창고를 고르기 전에는 셀 범위가 없다 — 계약도 창고를 필수로 요구한다.
         * 구획째 두지 않는 것이 「0건」으로 보이는 것보다 정확하다.
         */}
        {warehouseId !== null && (
          <UncoveredItemsPane
            items={uncovered.data?.items ?? EMPTY_UNCOVERED}
            total={uncovered.data?.page.total ?? 0}
            isLoading={uncovered.isPending}
            loadError={
              uncovered.isError ? (
                <LoadErrorBanner
                  error={uncovered.error}
                  onRetry={() => {
                    void uncovered.refetch();
                  }}
                />
              ) : null
            }
          />
        )}
      </div>
    </>
  );
};
