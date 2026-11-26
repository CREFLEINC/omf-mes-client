import { Chip, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { PageNav, type PageNavMeta } from '../../patterns/page-nav';
import { OneLine } from '../../patterns/po-board';
import { ErpListTable } from '../erp-item/erp-data-parts';
import { LIST_PAGE_SIZES, type ListPageSize, type ListSort, SORTABLE_KEYS } from './filters';
import { ProgressChip } from './progress';
import type { PurchaseOrderListItem } from './types';

const t = messages.erpPurchaseOrder;

const displayOr = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === '' ? t.values.missing : value;

export interface ErpPurchaseOrderListPaneProps {
  rows: PurchaseOrderListItem[];
  isLoading: boolean;
  /** 서버가 준 쪽 정보. */
  meta: PageNavMeta;
  selectedId: number | null;
  supplierNameOf: (id: number) => string;
  plantNameOf: (id: number) => string;
  /** ERP 발주 유형(공통코드 `ORDER_TYPE`) — 서버 #737 · P-67 */
  orderTypeNameOf: (code: string | null | undefined) => string;
  /** ERP 구매그룹(공통코드 `PUR_GROUP`) — 서버 #737 · P-67 */
  purchaseGroupNameOf: (code: string | null | undefined) => string;
  statusNameOf: (code: string) => string;
  onSelect: (purchaseOrderId: number) => void;
  /** 고른 줄을 다시 누르면 고르기를 푼다. */
  onUnselect: () => void;
  onChangePage: (page: number) => void;
  onChangeSize: (size: ListPageSize) => void;
  /** 일자 열 정렬(서버 정렬 · 주소 `sort`). null 이면 서버 기본(발주일 최신순). */
  sort: ListSort | null;
  onChangeSort: (sort: ListSort | null) => void;
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
  plantNameOf,
  orderTypeNameOf,
  purchaseGroupNameOf,
  statusNameOf,
  onSelect,
  onUnselect,
  onChangePage,
  onChangeSize,
  sort,
  onChangeSort,
}: ErpPurchaseOrderListPaneProps) => {
  const columns: Column<PurchaseOrderListItem>[] = [
    { key: 'purchaseOrderNo', header: t.fields.purchaseOrderNo, width: '152px' },
    {
      key: 'supplierId',
      header: t.fields.supplier,
      width: '168px',
      render: (row) => <OneLine text={supplierNameOf(row.supplierId)} />,
    },
    /* 공장 · 발주 유형 · 구매 그룹 · 입고 예정일 — 목록에서도 본다(되살림 · 사용자 지시 2026-11-24). */
    {
      key: 'plantId',
      header: t.fields.plant,
      width: '112px',
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
    { key: 'orderDate', header: t.fields.orderDate, width: '112px', sortable: true },
    {
      key: 'expectedReceiptDate',
      header: t.fields.expectedReceiptDate,
      width: '128px',
      sortable: true,
      render: (row) => displayOr(row.expectedReceiptDate),
    },
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
        /* 열 9개 — 줄여 잘리지 않게 가로로 구른다(사용자 지시 2026-11-24 열 되살림). */
        scrollX
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.purchaseOrderId)}
        sort={
          sort === null
            ? null
            : {
                key: sort.split(',')[0] ?? '',
                direction: sort.endsWith(',asc') ? 'ascending' : 'descending',
              }
        }
        onSortChange={(next) => {
          const key = SORTABLE_KEYS.find((sortable) => sortable === next?.key);
          onChangeSort(
            next === null || key === undefined
              ? null
              : `${key},${next.direction === 'ascending' ? 'asc' : 'desc'}`,
          );
        }}
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
