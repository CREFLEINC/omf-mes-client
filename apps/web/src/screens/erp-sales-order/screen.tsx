import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { ErpSalesOrderDetailPane, type DetailState } from './detail-pane';
import { ErpSalesOrderFilterBar } from './filter-bar';
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
import { ErpSalesOrderListPane } from './list-pane';
import {
  useCodeLookup,
  useItemNames,
  usePartnerLookup,
  useSalesOrderStatusLookup,
  useUomLookup,
} from './lookups';
import { toPageView } from './pagination';
import { useSalesOrderDetail, useSalesOrderList } from './queries';
import type { SalesOrder } from './types';

const t = messages.erpSalesOrder;
const EMPTY_ROWS: SalesOrder[] = [];

/**
 * 수주정보 조회(ERP) — ERP 가 내려 준 수주를 **읽기만** 한다.
 *
 * 입고 관리 짜임이다(사용자 지시 2026-10-27): 위에 조건 줄, 왼쪽 수주 목록 | 오른쪽 고른 건의 상세·라인. 조건·쪽·고른
 * 건은 전부 주소가 소유한다. **쓰기 조작이 하나도 없다** — 수주는 연계가 채우고 MES 에는 고치는 경로가 없다(읽기
 * 전용 안내 문구는 두지 않는다 — 사용자 지시 2026-10-27).
 * 출하지시를 만드는 일은 출하요청 화면이 진다 — 이 화면은 원천을 보여 줄 뿐이다.
 */
export const ErpSalesOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedId = readSelectedId(searchParams);

  const list = useSalesOrderList(toListQuery(filters, page));
  const detail = useSalesOrderDetail(selectedId);
  const partners = usePartnerLookup();
  const uoms = useUomLookup(selectedId !== null);
  const status = useSalesOrderStatusLookup();
  /* ERP 원본 코드 칸(서버 #737 · P-67)의 이름. 창고는 라인에만 있어 고른 뒤에 부른다. */
  const orderTypes = useCodeLookup('SO_TYPE');
  const salesGroups = useCodeLookup('SALE_GROUP');
  const storageLocations = useCodeLookup('SL_TYPE', selectedId !== null);
  const lines = detail.data?.lines ?? [];
  const itemNameOf = useItemNames(lines.map((line) => line.itemId));

  const rows = list.data?.items ?? EMPTY_ROWS;
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
    <BoardFrame
      splitKey="omf-mes:erp-sales-order:split"
      initialRatio={0.55}
      splitter={{ label: t.splitter, collapseLabel: t.listCollapse, expandLabel: t.listExpand }}
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
              <ErpSalesOrderFilterBar
                appliedFilters={filters}
                customerOptions={partners.options}
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
          <ErpSalesOrderListPane
            rows={rows}
            isLoading={list.isPending}
            page={pageView}
            selectedId={selectedId}
            partnerNameOf={partners.nameOf}
            statusNameOf={status.nameOf}
            orderTypeNameOf={orderTypes.nameOf}
            salesGroupNameOf={salesGroups.nameOf}
            onSelect={(id) => setSearchParams(toSelectionSearchParams(searchParams, id))}
            onChangePage={(nextPage) => setSearchParams(toSearchParams(filters, nextPage))}
          />
        ),
      }}
      detail={{
        label: t.panes.detail,
        content: (
          <ErpSalesOrderDetailPane
            state={detailState}
            partnerNameOf={partners.nameOf}
            itemNameOf={itemNameOf}
            uomNameOf={uoms.nameOf}
            statusNameOf={status.nameOf}
            orderTypeNameOf={orderTypes.nameOf}
            salesGroupNameOf={salesGroups.nameOf}
            storageLocationNameOf={storageLocations.nameOf}
          />
        ),
      }}
    />
  );
};
