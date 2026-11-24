import { Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PageNav, type PageNavMeta } from '../../patterns/page-nav';
import { OneLine } from '../../patterns/po-board';
import { ErpListTable } from '../erp-item/erp-data-parts';
import { LIST_PAGE_SIZES, type ListPageSize } from './filters';
import { ProgressChip } from './progress';
import type { SalesOrder } from './types';

const t = messages.erpSalesOrder;

export interface ErpSalesOrderListPaneProps {
  rows: SalesOrder[];
  isLoading: boolean;
  /** 서버가 준 쪽 정보. */
  meta: PageNavMeta;
  selectedId: number | null;
  partnerNameOf: (id: number) => string;
  /** 수주 상태(공통코드 `SALES_ORDER_STATUS` · 서버 장부 P-68) */
  statusNameOf: (code: string) => string;
  /** ERP 수주 유형(공통코드 `SO_TYPE`) — 서버 #737 · P-67 */
  orderTypeNameOf: (code: string | null | undefined) => string;
  /** ERP 영업그룹(공통코드 `SALE_GROUP`) — 서버 #737 · P-67 */
  salesGroupNameOf: (code: string | null | undefined) => string;
  onSelect: (salesOrderId: number) => void;
  /** 고른 줄을 다시 누르면 고르기를 푼다. */
  onUnselect: () => void;
  onChangePage: (page: number) => void;
  onChangeSize: (size: ListPageSize) => void;
}

/**
 * 수주 목록 — 목록 상자 내용. 줄 어디를 눌러도 그 건을 고른다. 수주 유형 · 영업 그룹도 목록에서 본다(되살림 · 사용자
 * 지시 2026-11-24). 행 고르기 말고는 조작이 없다 — 읽기 전용 화면이다.
 */
export const ErpSalesOrderListPane = ({
  rows,
  isLoading,
  meta,
  selectedId,
  partnerNameOf,
  statusNameOf,
  orderTypeNameOf,
  salesGroupNameOf,
  onSelect,
  onUnselect,
  onChangePage,
  onChangeSize,
}: ErpSalesOrderListPaneProps) => {
  const columns: Column<SalesOrder>[] = [
    { key: 'salesOrderNo', header: t.fields.salesOrderNo, width: '152px' },
    {
      key: 'customerId',
      header: t.fields.customer,
      width: '168px',
      render: (row) => <OneLine text={partnerNameOf(row.customerId)} />,
    },
    /* 수주 유형 · 영업 그룹 — 목록에서도 본다(되살림 · 사용자 지시 2026-11-24). */
    {
      key: 'erpOrderTypeCode',
      header: t.fields.orderType,
      width: '96px',
      render: (row) => <OneLine text={orderTypeNameOf(row.erpOrderTypeCode)} />,
    },
    {
      key: 'erpSalesGroupCode',
      header: t.fields.salesGroup,
      width: '96px',
      render: (row) => <OneLine text={salesGroupNameOf(row.erpSalesGroupCode)} />,
    },
    { key: 'orderDate', header: t.fields.orderDate, width: '104px' },
    {
      key: 'shipStatusCode',
      header: t.fields.progress,
      width: '96px',
      render: (row) => <ProgressChip code={row.shipStatusCode} />,
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      width: '88px',
      render: (row) => (
        <Chip variant="status" size="sm">
          {statusNameOf(row.statusCode)}
        </Chip>
      ),
    },
  ];
  const isBeyondLast = meta.total > 0 && meta.page > Math.ceil(meta.total / Math.max(1, meta.size));

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  return (
    <>
      <ErpListTable
        label={t.panes.list}
        storageKey="omf-mes:erp-sales-order:columns:orders"
        /* 열 일곱 — 줄여 잘리지 않게 가로로 구른다(사용자 지시 2026-11-24 열 되살림). */
        scrollX
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.salesOrderId)}
        pick={{
          currentId: selectedId === null ? null : String(selectedId),
          onPick: (row) => {
            onSelect(row.salesOrderId);
          },
          onUnpick: onUnselect,
        }}
        empty={
          <EmptyState size="sm" live title={isBeyondLast ? t.empty.beyondTitle : t.empty.title} />
        }
      />
      <PageNav<ListPageSize>
        meta={meta}
        sizes={LIST_PAGE_SIZES}
        buttonSize="md"
        onChangePage={onChangePage}
        onChangeSize={onChangeSize}
      />
    </>
  );
};
