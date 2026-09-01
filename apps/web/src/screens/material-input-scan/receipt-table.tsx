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
  /** 품목 번호를 코드로 옮긴다. 못 옮기면 번호가 그대로 선다. */
  describeItem: (itemId: number) => string;
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
 * **품목은 코드로 낸다**(스펙 §3의 `MAT-A`). 계약이 번호만 주므로 이름 풀이를 따로 걸고,
 * 풀지 못하면 번호를 그대로 낸다 — 옮기지 못한 것과 값이 없는 것은 다르다.
 *
 * ⚠ LOT은 번호 그대로다. 계약의 수령 라인이 `lotId`만 주고 LOT 번호를 얻으려면 자재LOT을
 * 줄마다 다시 조회해야 하는데, 이 표는 **계획 대비 수령을 견주는 자리**이지 LOT을 특정하는
 * 자리가 아니다 — 특정은 스캔이 한다.
 */
export const ReceiptTable = ({
  lines,
  isLoading,
  hasWorkOrder,
  describeItem,
}: ReceiptTableProps) => {
  /*
   * **여섯 열을 모두 가운데로 맞춘다.** 현장 단말은 멀리서 훑어보는 화면이라, 열마다 정렬이
   * 갈리면 눈이 좌우로 튄다 — 숫자를 오른쪽에 붙이는 관행은 자릿수를 견주는 표의 것이고
   * 이 표는 줄 사이 크기 비교가 목적이 아니다.
   */
  const columns: Column<ReceiptLineView>[] = [
    {
      key: 'itemId',
      header: t.table.item,
      align: 'center',
      render: (row) => describeItem(row.itemId),
    },
    { key: 'lotId', header: t.table.lot, align: 'center', render: (row) => String(row.lotId) },
    {
      key: 'issuedQty',
      header: t.table.issuedQty,
      align: 'center',
      render: (row) => renderQty(row.issuedQty),
    },
    {
      key: 'receivedQty',
      header: t.table.receivedQty,
      align: 'center',
      render: (row) => renderQty(row.receivedQty),
    },
    {
      key: 'varianceQty',
      header: t.table.varianceQty,
      align: 'center',
      render: (row) => renderQty(row.varianceQty),
    },
    {
      key: 'status',
      header: t.table.status,
      width: '120px',
      align: 'center',
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
