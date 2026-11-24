import { Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PageNav, type PageNavMeta } from '../../patterns/page-nav';
import { OneLine } from '../../patterns/po-board';
import { ErpListTable } from '../erp-item/erp-data-parts';
import { LIST_PAGE_SIZES, type ListPageSize } from './filters';
import { ProgressChip } from './progress';
import type { PurchaseOrderListItem } from './types';

const t = messages.erpPurchaseOrder;

export interface ErpPurchaseOrderListPaneProps {
  rows: PurchaseOrderListItem[];
  isLoading: boolean;
  /** 서버가 준 쪽 정보. */
  meta: PageNavMeta;
  selectedId: number | null;
  supplierNameOf: (id: number) => string;
  statusNameOf: (code: string) => string;
  onSelect: (purchaseOrderId: number) => void;
  /** 고른 줄을 다시 누르면 고르기를 푼다. */
  onUnselect: () => void;
  onChangePage: (page: number) => void;
  onChangeSize: (size: ListPageSize) => void;
}

/**
 * 헤더 목록 — 목록 상자 내용. 줄 어디를 눌러도 그 건을 고른다. 식별 칸만 두고(#358) 공장 · 발주 유형 · 구매그룹 ·
 * 입고예정일은 오른쪽 상세에서 본다. 행 고르기 말고는 조작이 없다 — 읽기 전용 화면이다.
 */
export const ErpPurchaseOrderListPane = ({
  rows,
  isLoading,
  meta,
  selectedId,
  supplierNameOf,
  statusNameOf,
  onSelect,
  onUnselect,
  onChangePage,
  onChangeSize,
}: ErpPurchaseOrderListPaneProps) => {
  const columns: Column<PurchaseOrderListItem>[] = [
    { key: 'purchaseOrderNo', header: t.fields.purchaseOrderNo, width: '152px' },
    {
      key: 'supplierId',
      header: t.fields.supplier,
      width: '168px',
      render: (row) => <OneLine text={supplierNameOf(row.supplierId)} />,
    },
    { key: 'orderDate', header: t.fields.orderDate, width: '104px' },
    {
      key: 'receiptStatusCode',
      header: t.fields.progress,
      width: '96px',
      render: (row) => <ProgressChip code={row.receiptStatusCode} />,
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
        storageKey="omf-mes:erp-purchase-order:columns:orders"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.purchaseOrderId)}
        pick={{
          currentId: selectedId === null ? null : String(selectedId),
          onPick: (row) => {
            onSelect(row.purchaseOrderId);
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
