import { Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { BoardTable } from '../../patterns/board-table';
import { OneLine } from '../../patterns/po-board';
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

/**
 * 헤더 목록 — 화면 틀(`BoardFrame`)의 왼쪽 구획 내용. 줄 어디를 눌러도 그 건을 고른다(입고 관리의 발주 목록과 같다).
 * 행 고르기 말고는 조작이 없다 — 읽기 전용 화면이다.
 */
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
    /* 고르는 단추 자리(`BoardTable` 의 `pick`). */
    { key: 'purchaseOrderNo', header: t.fields.purchaseOrderNo, width: '128px' },
    {
      key: 'supplierId',
      header: t.fields.supplier,
      render: (row) => <OneLine text={supplierNameOf(row.supplierId)} />,
    },
    {
      key: 'plantId',
      header: t.fields.plant,
      width: '88px',
      render: (row) => <OneLine text={plantNameOf(row.plantId)} />,
    },
    {
      key: 'erpOrderTypeCode',
      header: t.fields.orderType,
      width: '96px',
      render: (row) => <OneLine text={orderTypeNameOf(row.erpOrderTypeCode)} />,
    },
    {
      key: 'erpPurchaseGroupCode',
      header: t.fields.purchaseGroup,
      width: '96px',
      render: (row) => <OneLine text={purchaseGroupNameOf(row.erpPurchaseGroupCode)} />,
    },
    { key: 'orderDate', header: t.fields.orderDate, width: '104px' },
    {
      key: 'expectedReceiptDate',
      header: t.fields.expectedReceiptDate,
      width: '104px',
      render: (row) => displayOr(row.expectedReceiptDate),
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
        widthKey="omf-mes:erp-purchase-order:columns:orders"
        minWidth="54rem"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.purchaseOrderId)}
        pick={{
          columnKey: 'purchaseOrderNo',
          label: (row) => t.actions.select(row.purchaseOrderNo),
          currentId: selectedId === null ? null : String(selectedId),
          onPick: (row) => {
            onSelect(row.purchaseOrderId);
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
