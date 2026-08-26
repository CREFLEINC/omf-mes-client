import {
  Chip,
  type ChipStatus,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { ReceiptLineStatus, ReceiptLineView } from './types';

const t = messages.materialInputScan;

/**
 * 수령 상태 → 칩의 시맨틱 색.
 *
 * ⚠ **`none`을 `error`로 칠하되 그것이 「막혔다」는 뜻은 아니다.** 부족·미수령은 투입을 막지
 * 않는다(스펙 §6) — 색은 눈에 먼저 걸리라는 것이고, 막지 않는다는 사실은 표 아래 안내가 말한다.
 */
const STATUS_TONE: Record<ReceiptLineStatus, ChipStatus> = {
  matched: 'success',
  short: 'warning',
  none: 'error',
};

const STATUS_LABEL: Record<ReceiptLineStatus, string> = {
  matched: t.receiptStatus.matched,
  short: t.receiptStatus.short,
  none: t.receiptStatus.none,
};

export interface ReceiptTableProps {
  lines: ReceiptLineView[];
  isLoading: boolean;
  /** 조회가 실제로 나갔는가. 거짓이면 「없습니다」로 말하지 않는다 — 작업지시가 없으면 요청이 나가지 않는다. */
  hasWorkOrder: boolean;
}

/** 수량은 숫자 그대로 낸다 — 단위 환산은 서버 몫이고(§5-6) 화면이 자릿수를 지어내지 않는다. */
const renderQty = (value: number): ReactNode => String(value);

/**
 * 계획 대비 수령 표.
 *
 * **열이 여섯이다**(스펙 §4-A 그대로): 품목·LOT·출고·수령·차이·상태.
 * 차이 수량은 **서버가 계산한 값을 옮긴다** — 화면이 빼지 않는다(공유계약 L-2).
 *
 * 품목·LOT은 이 슬라이스에서 **번호를 그대로 낸다.** 이름 풀이는 뒤 슬라이스에서 스캔이
 * 붙을 때 함께 들인다 — 여기서 좁힌 조회로 이름을 풀면 좁힘 밖의 정상 자료가 「알 수 없음」으로
 * 보인다(#47).
 */
export const ReceiptTable = ({ lines, isLoading, hasWorkOrder }: ReceiptTableProps) => {
  const columns: Column<ReceiptLineView>[] = [
    { key: 'itemId', header: t.table.item, render: (row) => String(row.itemId) },
    { key: 'lotId', header: t.table.lot, render: (row) => String(row.lotId) },
    {
      key: 'issuedQty',
      header: t.table.issuedQty,
      align: 'end',
      render: (row) => renderQty(row.issuedQty),
    },
    {
      key: 'receivedQty',
      header: t.table.receivedQty,
      align: 'end',
      render: (row) => renderQty(row.receivedQty),
    },
    {
      key: 'varianceQty',
      header: t.table.varianceQty,
      align: 'end',
      render: (row) => renderQty(row.varianceQty),
    },
    {
      key: 'status',
      header: t.table.status,
      width: '120px',
      render: (row) => (
        <Chip variant="status" size="sm" status={STATUS_TONE[row.status]}>
          {STATUS_LABEL[row.status]}
        </Chip>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div role="status" aria-label={t.loading.receipt}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  return (
    <>
      <Table
        density="comfortable"
        columns={columns}
        rows={lines}
        /*
         * 지정하지 않으면 인덱스가 React key가 되어, 앞 줄이 사라질 때 그 자리의 DOM 노드가
         * 대신 지워진다 — 스캔이 붙는 뒤 슬라이스에서 포커스가 남의 줄로 옮겨 붙는 형태가 된다.
         */
        getRowId={(row) => String(row.shopfloorReceiptLineId)}
        empty={
          hasWorkOrder ? (
            <EmptyState
              size="sm"
              live
              title={t.empty.receiptTitle}
              description={t.empty.receiptDescription}
            />
          ) : (
            <EmptyState size="sm" title={t.empty.notQueriedTitle} />
          )
        }
      />

      <p className="field-note">{t.notes.shortAllowed}</p>
    </>
  );
};
