import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { ErpProductionOrderFilterBar } from './filter-bar';
import {
  DEFAULT_FILTERS,
  LIST_PAGE_SIZE,
  readFilters,
  readPage,
  toListQuery,
  toSearchParams,
} from './filters';
import { ErpProductionOrderListPane } from './list-pane';
import { useItemNames, useStatusLookup, useStorageLocationNames, useUomLookup } from './lookups';
import { toPageView } from './pagination';
import { useErpProductionOrderList } from './queries';
import type { ErpProductionOrder } from './types';

const t = messages.erpProductionOrder;
const EMPTY_ROWS: ErpProductionOrder[] = [];

/**
 * ERP W/O 조회(W-06-23 · 시스템 관리 > ERP 연동 현황·이력의 한 탭) — ERP 가 보낸 W/O 를
 * **받은 그대로 읽기만** 한다. 탭 줄은 셸이 그린다.
 *
 * 입고 관리 짜임이다(사용자 지시 2026-10-27): 위에 조건 줄, 아래에 ERP W/O 목록 한 구획. 상세는 두지 않는다 — 상세가
 * 목록 줄과 겹쳐 두지 않는다(사용자 지시 2026-10-27). 그래서 줄을 고르는 일도 없다. 조건·쪽은 전부 주소가 소유한다.
 * **쓰기 조작도, 계획(전개·편성)으로 넘어가는 길도 없다** — 그 일은 MES 작업 화면(W-02-01)이 한다. 읽기 전용 안내
 * 문구는 두지 않는다(사용자 지시 2026-10-27).
 */
export const ErpProductionOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);

  const list = useErpProductionOrderList(toListQuery(filters, page));
  const status = useStatusLookup();
  const storageLocationOf = useStorageLocationNames();
  const uoms = useUomLookup();

  const rows = list.data?.items ?? EMPTY_ROWS;
  const itemNameOf = useItemNames(rows.map((row) => row.itemId));
  const pageView = toPageView(
    list.data?.page ?? { page, size: LIST_PAGE_SIZE, total: 0 },
    rows.length,
  );

  return (
    <BoardFrame
      above={{
        label: t.panes.filters,
        content: (
          <>
            {/* 조회에 실패했으면 표도 빈 상태도 내지 않는다 — 실패를 「없습니다」로 보이면 안 된다. */}
            {list.isError && (
              <AlertBanner variant="error" title={t.listLoadFailedTitle}>
                {t.loadFailedDescription}
              </AlertBanner>
            )}
            <div className="pane po-board-filter">
              <ErpProductionOrderFilterBar
                appliedFilters={filters}
                statusOptions={status.options}
                onSearch={(next) => setSearchParams(toSearchParams(next, 1))}
                onReset={() => setSearchParams(toSearchParams(DEFAULT_FILTERS, 1))}
              />
            </div>
          </>
        ),
      }}
      list={{
        label: t.panes.list,
        content: list.isError ? null : (
          <ErpProductionOrderListPane
            rows={rows}
            isLoading={list.isPending}
            page={pageView}
            itemNameOf={itemNameOf}
            uomNameOf={uoms.nameOf}
            storageLocationOf={storageLocationOf}
            statusNameOf={status.nameOf}
            onChangePage={(nextPage) => setSearchParams(toSearchParams(filters, nextPage))}
          />
        ),
      }}
    />
  );
};
