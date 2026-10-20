import { Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { PurchaseOrder } from './types';

const t = messages.erpPurchaseOrder;

const displayOr = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.missing : value;

export interface ErpPurchaseOrderListPaneProps {
  rows: PurchaseOrder[];
  isLoading: boolean;
  page: PageView;
  selectedId: number | null;
  supplierNameOf: (id: number) => string;
  plantNameOf: (id: number) => string;
  statusNameOf: (code: string) => string;
  /** ERP 발주 유형(공통코드 `ORDER_TYPE`) — 서버 #737 · P-67 */
  orderTypeNameOf: (code: string | null | undefined) => string;
  /** ERP 구매그룹(공통코드 `PUR_GROUP`) — 서버 #737 · P-67 */
  purchaseGroupNameOf: (code: string | null | undefined) => string;
  onSelect: (purchaseOrderId: number) => void;
  onChangePage: (page: number) => void;
}

/** 헤더 목록. 행 고르기 말고는 조작이 없다 — 읽기 전용 화면이다. */
export const ErpPurchaseOrderListPane = ({
  rows,
  isLoading,
  page,
  selectedId,
  supplierNameOf,
  plantNameOf,
  statusNameOf,
  orderTypeNameOf,
  purchaseGroupNameOf,
  onSelect,
  onChangePage,
}: ErpPurchaseOrderListPaneProps) => {
  const columns: Column<PurchaseOrder>[] = [
    {
      key: 'purchaseOrderNo',
      header: t.fields.purchaseOrderNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.select(row.purchaseOrderNo)}
          aria-current={selectedId === row.purchaseOrderId ? true : undefined}
          onClick={() => {
            onSelect(row.purchaseOrderId);
          }}
        >
          {row.purchaseOrderNo}
        </button>
      ),
    },
    {
      key: 'erpPurchaseOrderNo',
      header: t.fields.erpPurchaseOrderNo,
      render: (row) => displayOr(row.erpPurchaseOrderNo),
    },
    {
      key: 'supplierId',
      header: t.fields.supplier,
      render: (row) => supplierNameOf(row.supplierId),
    },
    { key: 'plantId', header: t.fields.plant, render: (row) => plantNameOf(row.plantId) },
    {
      key: 'erpOrderTypeCode',
      header: t.fields.orderType,
      render: (row) => orderTypeNameOf(row.erpOrderTypeCode),
    },
    {
      key: 'erpPurchaseGroupCode',
      header: t.fields.purchaseGroup,
      render: (row) => purchaseGroupNameOf(row.erpPurchaseGroupCode),
    },
    { key: 'orderDate', header: t.fields.orderDate },
    {
      key: 'expectedReceiptDate',
      header: t.fields.expectedReceiptDate,
      render: (row) => displayOr(row.expectedReceiptDate),
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      render: (row) => (
        <Chip variant="status" size="sm">
          {statusNameOf(row.statusCode)}
        </Chip>
      ),
    },
  ];

  if (isLoading) {
    return (
      <section className="pane" aria-label={t.panes.list}>
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={4} />
        </div>
      </section>
    );
  }

  return (
    <section className="pane" aria-label={t.panes.list}>
      <h2>{t.panes.list}</h2>
      <div className="wide-table">
        <Table
          caption={<span className="erp-data-table-caption">{t.panes.list}</span>}
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.purchaseOrderId)}
          sort={null}
          empty={
            <EmptyState
              size="sm"
              live
              title={page.isBeyondLast ? t.empty.beyondTitle : t.empty.title}
              description={page.isBeyondLast ? t.empty.beyondDescription : t.empty.description}
            />
          }
        />
      </div>
      <PageNav view={page} onChange={onChangePage} />
    </section>
  );
};
