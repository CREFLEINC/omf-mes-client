import { AlertBanner, Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { ErpProductionOrderDetailPane, type DetailState } from './detail-pane';
import { ErpProductionOrderFilterBar } from './filter-bar';
import {
  DEFAULT_FILTERS,
  LIST_PAGE_SIZE,
  readFilters,
  readPage,
  readSelectedId,
  toListQuery,
  toSearchParams,
  toSelectionSearchParams,
} from './filters';
import { ErpProductionOrderListPane } from './list-pane';
import {
  useBusinessUnitLookup,
  useItemNames,
  usePlantLookup,
  useStatusLookup,
  useStorageLocationNames,
  useUomLookup,
} from './lookups';
import { toPageView } from './pagination';
import { useErpProductionOrderDetail, useErpProductionOrderList } from './queries';
import type { ErpProductionOrder } from './types';

const t = messages.erpProductionOrder;
const EMPTY_ROWS: ErpProductionOrder[] = [];

/**
 * ERP W/O 조회(W-06-23 · 시스템 관리 > ERP 연동 현황·이력의 한 탭) — ERP 가 보낸 W/O 를
 * **받은 그대로 읽기만** 한다. 탭 줄은 셸이 그린다.
 *
 * 위에서 아래로 조건 줄 → 목록 → 고른 건의 상세. 조건·쪽·고른 건은 전부 주소가 소유한다.
 * **쓰기 조작도, 계획(전개·편성)으로 넘어가는 길도 없다** — 그 일은 MES 작업 화면(W-02-01)이 한다.
 */
export const ErpProductionOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedId = readSelectedId(searchParams);

  const list = useErpProductionOrderList(toListQuery(filters, page));
  const detail = useErpProductionOrderDetail(selectedId);
  const status = useStatusLookup();
  const storageLocationOf = useStorageLocationNames();
  const uoms = useUomLookup();
  const businessUnits = useBusinessUnitLookup(selectedId !== null);
  const plants = usePlantLookup(selectedId !== null);

  const rows = list.data?.items ?? EMPTY_ROWS;
  const itemNameOf = useItemNames([
    ...rows.map((row) => row.itemId),
    ...(detail.data === undefined ? [] : [detail.data.itemId]),
  ]);
  const pageView = toPageView(
    list.data?.page ?? { page, size: LIST_PAGE_SIZE, total: 0 },
    rows.length,
  );

  const detailState: DetailState =
    selectedId === null
      ? { kind: 'idle' }
      : detail.isError
        ? { kind: 'failed' }
        : detail.data === undefined
          ? { kind: 'loading' }
          : { kind: 'ready', data: detail.data };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <section className="pane" aria-label={t.panes.filters}>
        <h2>{t.panes.filters}</h2>
        <p className="field-note">{t.readOnlyNote}</p>
        <ErpProductionOrderFilterBar
          appliedFilters={filters}
          statusOptions={status.options}
          onSearch={(next) => setSearchParams(toSearchParams(next, 1))}
          onReset={() => setSearchParams(toSearchParams(DEFAULT_FILTERS, 1))}
        />
      </section>

      {/* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다. */}
      {list.isError ? (
        <AlertBanner variant="error" title={t.listLoadFailedTitle}>
          {t.loadFailedDescription}
        </AlertBanner>
      ) : (
        <ErpProductionOrderListPane
          rows={rows}
          isLoading={list.isPending}
          page={pageView}
          selectedId={selectedId}
          itemNameOf={itemNameOf}
          uomNameOf={uoms.nameOf}
          storageLocationOf={storageLocationOf}
          statusNameOf={status.nameOf}
          onSelect={(id) => setSearchParams(toSelectionSearchParams(searchParams, id))}
          onChangePage={(nextPage) => setSearchParams(toSearchParams(filters, nextPage))}
        />
      )}

      <ErpProductionOrderDetailPane
        state={detailState}
        businessUnitNameOf={businessUnits.nameOf}
        plantNameOf={plants.nameOf}
        itemNameOf={itemNameOf}
        uomNameOf={uoms.nameOf}
        storageLocationOf={storageLocationOf}
        statusNameOf={status.nameOf}
      />
    </>
  );
};
