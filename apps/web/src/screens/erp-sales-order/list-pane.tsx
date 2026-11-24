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
  onSelect: (salesOrderId: number) => void;
  onChangePage: (page: number) => void;
  onChangeSize: (size: ListPageSize) => void;
}

/**
 * 수주 목록 — 목록 상자 내용. 줄 어디를 눌러도 그 건을 고른다. 식별 칸만 두고(#358) 수주 유형 · 영업그룹은 오른쪽
 * 상세에서 본다. 행 고르기 말고는 조작이 없다 — 읽기 전용 화면이다.
 */
export const ErpSalesOrderListPane = ({
  rows,
  isLoading,
  meta,
  selectedId,
  partnerNameOf,
  statusNameOf,
  onSelect,
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
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.salesOrderId)}
        pick={{
          currentId: selectedId === null ? null : String(selectedId),
          onPick: (row) => {
            onSelect(row.salesOrderId);
          },
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
