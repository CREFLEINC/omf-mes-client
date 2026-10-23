import { Button, type Column, EmptyState, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { useColumnWidths } from '../../patterns/column-resize';
import { StageGroupChip } from './lot-row';
import { isOrderOverdue } from './overdue';
import { formatDate } from './period';
import { OneLine, orEmpty, OrderStateCell } from './receipt-status';
import { hasStageCounts, stageLead } from './stage';
import type { PurchaseOrderSummary } from './types';

const t = messages.inboundSchedule;

export interface OrderTableProps {
  rows: PurchaseOrderSummary[];
  isLoading: boolean;
  /** 조회가 실제로 나갔는가. 거짓이면 「결과가 없다」로 말하지 않는다. */
  hasQuery: boolean;
  isBeyondLast: boolean;
  today: string;
  selectedId: number | null;
  onSelect: (purchaseOrderId: number) => void;
  onFirstPage: () => void;
}

/**
 * 「진행」 칸 — 그 발주 LOT 들의 **가장 뒤처진** 단계 묶음과 수, 나머지 묶음은 「외 N」(C-17 「첫 사유와 외 N」).
 * LOT 이 하나도 없으면 미착수는 「입하 전」, 그 밖(모두 끝남)은 「—」. 묶음 수를 싣지 않은 줄도 「—」.
 */
const ProgressCell = ({ row }: { row: PurchaseOrderSummary }) => {
  const counts = row.inboundStageCounts;

  if (counts === undefined) return t.values.empty;

  const lead = stageLead(counts);

  if (lead === null) {
    return row.receiptStatusCode === 'NOT_STARTED' ? (
      <span className="po-board-lot-meta">{t.stage.beforeReceipt}</span>
    ) : (
      t.values.empty
    );
  }

  return (
    <span className="po-board-progress">
      <StageGroupChip group={lead.group} count={lead.count} />
      {lead.others > 0 && (
        <span className="po-board-progress-others">{t.stage.others(lead.others)}</span>
      )}
    </span>
  );
};

/**
 * 왼쪽 표 — **P/O 묶음 한 줄**(server #762). 발주·공급사처럼 묶음 단위로 말할 수 있는 것만 둔다.
 * 품목·수량의 낱낱은 오른쪽 표가 낸다. 정렬은 서버 순서 그대로다 — 쪽을 넘는 정렬은 화면이 할 수 없다.
 *
 * 공급사 코드·남은 수량은 두지 않는다 — 오른쪽 발주 상세가 낸다(사용자 지시 2026-10-21).
 *
 * 아래는 기본 폭이다 — 머리칸 오른쪽 끝을 끌어 바꿀 수 있다(`patterns/column-resize.tsx`).
 *
 * | 열 | 폭 | 근거 |
 * | --- | ---: | --- |
 * | 상태 | 64px | 칩 「지연」·「정상」 36px + 여백(끝난 발주는 「—」) |
 * | 납기 | 104px | `YYYY.MM.DD` 75px + 여백 |
 * | 발주번호 | 120px | 10자 ASCII 80px + 여백. 이 칸이 고르는 단추다 |
 * | 진행 | 132px · 서버가 묶음 수를 실을 때만 | 칩 「검사 대기 4」 + 「외 2」. 가장 뒤처진 단계 하나만 — 칸 하나에 칩 둘 이상이면 줄이 넘친다(C-17) |
 * | **공급사명** | **미지정** | 남는 폭을 흡수한다. 넘치면 말줄임 |
 * | 미입고 품목 | 96px | 「99 / 99」 + 여백 |
 * | 발주일 | 104px | `YYYY.MM.DD` + 여백 |
 * | 합 | 488px + 흡수 | `.po-board-orders` 최소 폭 `38rem`(608px) | `.po-board-orders` 최소 폭 `36rem`(576px) |
 */
export const OrderTable = ({
  rows,
  isLoading,
  hasQuery,
  isBeyondLast,
  today,
  selectedId,
  onSelect,
  onFirstPage,
}: OrderTableProps) => {
  const columns: Column<PurchaseOrderSummary>[] = [
    {
      key: 'receiptStatusCode',
      header: t.table.receiptStatus,
      width: '64px',
      render: (row) => (
        <OrderStateCell code={row.receiptStatusCode} overdue={isOrderOverdue(row, today)} />
      ),
    },
    {
      key: 'expectedReceiptDate',
      header: t.table.expectedReceiptDate,
      width: '104px',
      render: (row) =>
        row.expectedReceiptDate == null ? t.values.noDueDate : formatDate(row.expectedReceiptDate),
    },
    {
      key: 'purchaseOrderNo',
      header: t.table.purchaseOrderNo,
      width: '120px',
      /* 고르는 단추. 고른 줄은 `aria-current` 로 알리고 줄 배경이 따라간다(app.css). */
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-current={selectedId === row.purchaseOrderId ? true : undefined}
          aria-label={t.actions.selectOrder(row.purchaseOrderNo)}
          data-po-id={row.purchaseOrderId}
        >
          {row.purchaseOrderNo}
        </button>
      ),
    },
    /* 「진행」은 발주번호 바로 뒤 — 가로로 넘기지 않아도 보인다. 서버가 묶음 수를 실을 때만 선다(앞선 서버는 열이 없다). */
    ...(hasStageCounts(rows)
      ? [
          {
            key: 'inboundStage',
            header: t.table.progress,
            width: '132px',
            render: (row: PurchaseOrderSummary) => <ProgressCell row={row} />,
          } satisfies Column<PurchaseOrderSummary>,
        ]
      : []),
    {
      key: 'supplierName',
      header: t.table.supplierName,
      render: (row) => <OneLine text={orEmpty(row.supplierName)} />,
    },
    {
      key: 'openLineCount',
      header: t.table.openLines,
      width: '96px',
      align: 'end',
      render: (row) =>
        typeof row.openLineCount === 'number' && typeof row.lineCount === 'number'
          ? t.values.lineRatio(row.openLineCount, row.lineCount)
          : t.values.empty,
    },
    {
      key: 'orderDate',
      header: t.table.orderDate,
      width: '104px',
      render: (row) => formatDate(row.orderDate),
    },
  ];
  const resizable = useColumnWidths('omf-mes:inbound-schedule:columns:orders', columns);

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.list}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  /** 조회 전 → 범위 밖 쪽 → 결과 없음 순서로 하나만 낸다. 셋은 사용자가 할 조치가 서로 다르다. */
  const emptySlot = (): ReactNode => {
    if (!hasQuery) {
      return (
        <EmptyState
          size="sm"
          title={t.empty.notQueriedTitle}
          description={t.empty.notQueriedDescription}
        />
      );
    }

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
    /*
     * **줄 어디를 눌러도 고른다**(사용자 지시 2026-10-21). 표 부품에 줄 클릭이 없어 감싼 상자가 받는다 —
     * 누른 줄 안의 발주번호 단추(`data-po-id`)로 어느 발주인지 안다. 키보드는 그 단추가 받는다(Enter·Space 가
     * 단추의 click 을 내어 여기로 올라온다).
     */
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="wide-table po-board-table po-board-orders"
      style={resizable.style}
      onClick={(event) => {
        const row = (event.target as HTMLElement).closest('tbody tr');
        const id = row?.querySelector<HTMLElement>('[data-po-id]')?.dataset.poId;
        if (id !== undefined) onSelect(Number(id));
      }}
    >
      <Table
        density="compact"
        caption={<span className="erp-data-table-caption">{t.panes.orders}</span>}
        columns={resizable.columns}
        rows={rows}
        getRowId={(row) => String(row.purchaseOrderId)}
        empty={emptySlot()}
      />
    </div>
  );
};
