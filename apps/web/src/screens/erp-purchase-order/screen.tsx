import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { BoardFrame } from '../../patterns/board-frame';
import { ErpPurchaseOrderDetailPane, type DetailState } from './detail-pane';
import { ErpPurchaseOrderFilterBar } from './filter-bar';
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
import { ErpPurchaseOrderListPane } from './list-pane';
import {
  useCodeLookup,
  useItemNames,
  usePlantLookup,
  useStatusLookup,
  useSupplierLookup,
  useUomLookup,
} from './lookups';
import { toPageView } from './pagination';
import { usePurchaseOrderDetail, usePurchaseOrderList } from './queries';
import type { PurchaseOrder } from './types';

const t = messages.erpPurchaseOrder;
const EMPTY_ROWS: PurchaseOrder[] = [];

/**
 * 구매발주 조회(ERP) — ERP 가 내려 준 P/O(구매오더)를 **읽기만** 한다.
 *
 * 입고 관리 짜임이다(사용자 지시 2026-10-27): 위에 조건 줄, 왼쪽 헤더 목록 | 오른쪽 고른 건의 상세·라인. 조건·쪽·고른
 * 건은 전부 주소가 소유한다. **쓰기 조작이 하나도 없다** — ERP 에서 온 P/O 는 서버가 수정을 거절한다(읽기 전용 안내
 * 문구는 두지 않는다 — 사용자 지시 2026-10-27).
 */
export const ErpPurchaseOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedId = readSelectedId(searchParams);

  const list = usePurchaseOrderList(toListQuery(filters, page));
  const detail = usePurchaseOrderDetail(selectedId);
  const suppliers = useSupplierLookup();
  const plants = usePlantLookup();
  const status = useStatusLookup();
  const uoms = useUomLookup(selectedId !== null);
  /* ERP 원본 코드 칸(서버 #737 · P-67)의 이름. 창고는 라인에만 있어 고른 뒤에 부른다. */
  const orderTypes = useCodeLookup('ORDER_TYPE');
  const purchaseGroups = useCodeLookup('PUR_GROUP');
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
      splitKey="omf-mes:erp-purchase-order:split"
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
              <ErpPurchaseOrderFilterBar
                appliedFilters={filters}
                supplierOptions={suppliers.options}
                plantOptions={plants.options}
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
          <ErpPurchaseOrderListPane
            rows={rows}
            isLoading={list.isPending}
            page={pageView}
            selectedId={selectedId}
            supplierNameOf={suppliers.nameOf}
            plantNameOf={plants.nameOf}
            statusNameOf={status.nameOf}
            orderTypeNameOf={orderTypes.nameOf}
            purchaseGroupNameOf={purchaseGroups.nameOf}
            onSelect={(id) => setSearchParams(toSelectionSearchParams(searchParams, id))}
            onChangePage={(nextPage) => setSearchParams(toSearchParams(filters, nextPage))}
          />
        ),
      }}
      detail={{
        label: t.panes.detail,
        content: (
          <ErpPurchaseOrderDetailPane
            state={detailState}
            supplierNameOf={suppliers.nameOf}
            plantNameOf={plants.nameOf}
            statusNameOf={status.nameOf}
            itemNameOf={itemNameOf}
            uomNameOf={uoms.nameOf}
            orderTypeNameOf={orderTypes.nameOf}
            purchaseGroupNameOf={purchaseGroups.nameOf}
            storageLocationNameOf={storageLocations.nameOf}
          />
        ),
      }}
    />
  );
};
