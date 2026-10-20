import { Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { SalesOrder } from './types';

const t = messages.erpSalesOrder;

const displayOr = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.missing : value;

export interface ErpSalesOrderListPaneProps {
  rows: SalesOrder[];
  isLoading: boolean;
  page: PageView;
  selectedId: number | null;
  partnerNameOf: (id: number) => string;
  /** 수주 상태(공통코드 `SALES_ORDER_STATUS` · 서버 장부 P-68) */
  statusNameOf: (code: string) => string;
  /** ERP 수주 유형(공통코드 `SO_TYPE`) — 서버 #737 · P-67 */
  orderTypeNameOf: (code: string | null | undefined) => string;
  /** ERP 영업그룹(공통코드 `SALE_GROUP`) — 서버 #737 · P-67 */
  salesGroupNameOf: (code: string | null | undefined) => string;
  onSelect: (salesOrderId: number) => void;
  onChangePage: (page: number) => void;
}

/** 수주 목록. 행 고르기 말고는 조작이 없다 — 읽기 전용 화면이다. */
export const ErpSalesOrderListPane = ({
  rows,
  isLoading,
  page,
  selectedId,
  partnerNameOf,
  statusNameOf,
  orderTypeNameOf,
  salesGroupNameOf,
  onSelect,
  onChangePage,
}: ErpSalesOrderListPaneProps) => {
  const columns: Column<SalesOrder>[] = [
    {
      key: 'salesOrderNo',
      header: t.fields.salesOrderNo,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={t.actions.select(row.salesOrderNo)}
          aria-current={selectedId === row.salesOrderId ? true : undefined}
          onClick={() => {
            onSelect(row.salesOrderId);
          }}
        >
          {row.salesOrderNo}
        </button>
      ),
    },
    {
      key: 'erpSalesOrderNo',
      header: t.fields.erpSalesOrderNo,
      render: (row) => displayOr(row.erpSalesOrderNo),
    },
    {
      key: 'customerId',
      header: t.fields.customer,
      render: (row) => partnerNameOf(row.customerId),
    },
    {
      key: 'shipToPartnerId',
      header: t.fields.shipTo,
      render: (row) => partnerNameOf(row.shipToPartnerId),
    },
    { key: 'orderDate', header: t.fields.orderDate },
    {
      key: 'erpOrderTypeCode',
      header: t.fields.orderType,
      render: (row) => orderTypeNameOf(row.erpOrderTypeCode),
    },
    {
      key: 'erpSalesGroupCode',
      header: t.fields.salesGroup,
      render: (row) => salesGroupNameOf(row.erpSalesGroupCode),
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
          getRowId={(row) => String(row.salesOrderId)}
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
