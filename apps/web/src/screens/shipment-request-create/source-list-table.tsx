import { Button, Chip, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import type { SalesOrderView } from './types';

const t = messages.shipmentRequestCreate;

/**
 * 열 폭. **좌 칸(2fr, 최소 320px)에 놓이는 표라 `.wide-table`을 붙이지 않는다** — 그 최소 폭은
 * 928px이라 이 칸에서는 언제나 가로 스크롤이 생긴다(`docs/layout-conventions.md` W-CO-02가
 * 이미 같은 판정을 남겼다: 좌 칸의 표에는 붙이지 않는다).
 */
const WIDTH = {
  status: '96px',
  orderDate: '112px',
} as const;

export interface SourceListTableProps {
  rows: SalesOrderView[];
  isLoading: boolean;
  isBeyondLast: boolean;
  /** 지금 편성 폼이 겨눈 지시서. `null`이면 아무것도 고르지 않았거나 단독 생성 중이다. */
  selectedSalesOrderId: number | null;
  customerLookup: LookupSource;
  onSelect: (salesOrderId: number) => void;
  onFirstPage: () => void;
}

/**
 * 좌측 출하지시서 목록 — 지시서번호를 누르면 그 지시서로 편성 폼이 선다(완료 조건 C2).
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const SourceListTable = ({
  rows,
  isLoading,
  isBeyondLast,
  selectedSalesOrderId,
  customerLookup,
  onSelect,
  onFirstPage,
}: SourceListTableProps) => {
  const columns: Column<SalesOrderView>[] = [
    {
      key: 'salesOrderNo',
      header: t.table.salesOrderNo,
      render: (row) => (
        <Button
          variant="text"
          aria-label={t.table.selectRow(row.salesOrderNo)}
          aria-pressed={row.salesOrderId === selectedSalesOrderId}
          onClick={() => {
            onSelect(row.salesOrderId);
          }}
        >
          {row.salesOrderNo}
        </Button>
      ),
    },
    {
      key: 'customer',
      header: t.table.customer,
      render: (row) => lookupDisplayLabel(customerLookup, row.customerId),
    },
    {
      key: 'orderDate',
      header: t.table.orderDate,
      width: WIDTH.orderDate,
      render: (row) => row.orderDate,
    },
    {
      key: 'statusCode',
      header: t.table.status,
      width: WIDTH.status,
      /* 값 목록이 확정되지 않아(omf-mes#145) 중립 배지 하나로만 낸다 — 뜻을 지어내지 않는다. */
      render: (row) => (
        <Chip variant="status" size="sm">
          {row.statusCode}
        </Chip>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.sourceList}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const emptySlot = (): ReactNode => {
    if (isBeyondLast) {
      return (
        <EmptyState
          size="sm"
          live
          title={t.empty.beyondLastTitle}
          description={t.empty.beyondLastDescription}
          action={
            <Button variant="outlined" onClick={onFirstPage}>
              {t.actions.goFirstPage}
            </Button>
          }
        />
      );
    }

    return (
      <EmptyState
        size="sm"
        live
        title={t.empty.noResultTitle}
        description={t.empty.noResultDescription}
      />
    );
  };

  return (
    <Table
      density="compact"
      columns={columns}
      rows={rows}
      getRowId={(row) => String(row.salesOrderId)}
      empty={emptySlot()}
    />
  );
};
