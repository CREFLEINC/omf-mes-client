import { Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { BoardTable } from '../../patterns/board-table';
import { OneLine } from '../../patterns/po-board';
import { PageNav } from './page-nav';
import type { PageView } from './pagination';
import type { SalesOrder } from './types';

const t = messages.erpSalesOrder;

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

/**
 * 수주 목록 — 화면 틀(`BoardFrame`)의 왼쪽 구획 내용. 줄 어디를 눌러도 그 건을 고른다(입고 관리의 발주 목록과 같다).
 * 행 고르기 말고는 조작이 없다 — 읽기 전용 화면이다.
 */
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
    /* 고르는 단추 자리(`BoardTable` 의 `pick`). */
    { key: 'salesOrderNo', header: t.fields.salesOrderNo, width: '128px' },
    {
      key: 'customerId',
      header: t.fields.customer,
      render: (row) => <OneLine text={partnerNameOf(row.customerId)} />,
    },
    { key: 'orderDate', header: t.fields.orderDate, width: '104px' },
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

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  return (
    <>
      <BoardTable
        label={t.panes.list}
        widthKey="omf-mes:erp-sales-order:columns:orders"
        minWidth="42rem"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.salesOrderId)}
        pick={{
          columnKey: 'salesOrderNo',
          label: (row) => t.actions.select(row.salesOrderNo),
          currentId: selectedId === null ? null : String(selectedId),
          onPick: (row) => {
            onSelect(row.salesOrderId);
          },
        }}
        sort={null}
        empty={
          <EmptyState
            size="sm"
            live
            title={page.isBeyondLast ? t.empty.beyondTitle : t.empty.title}
          />
        }
      />
      <PageNav view={page} onChange={onChangePage} />
    </>
  );
};
