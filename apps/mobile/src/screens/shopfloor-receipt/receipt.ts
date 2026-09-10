import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type GoodsIssue = components['schemas']['GoodsIssue'];
export type GoodsIssueLine = components['schemas']['GoodsIssueLine'];
export type ShopfloorReceiptCreate = components['schemas']['ShopfloorReceiptCreate'];
export type ShopfloorReceiptLineCreate = components['schemas']['ShopfloorReceiptLineCreate'];

/**
 * 담는 경로의 이름.
 *
 * 담는 쪽과 세는 쪽이 이 상수를 함께 쓴다. 문자열을 양쪽에 적으면 한쪽만 고쳐졌을 때 셈이
 * 조용히 0 이 되고, 오프라인에서 같은 출고를 두 번 받는 것을 막지 못한다.
 */
export const RECEIPT_LABEL = messages.shopfloorReceipt.record.received;

/** 화면이 든 한 라인. 수량을 글자로 받으므로 수로 바꾸는 자리를 여기 둔다. */
export interface DraftLine {
  goodsIssueLineId: number;
  itemId: number;
  lotId: number;
  issuedQty: number;
  uomId: number;
  receivedQty: string;
  reasonCode: string;
}

export type QtyProblem = 'notNumber' | 'negative' | 'overIssued';

/**
 * 수령 수량 하나를 본다.
 *
 * 0 을 막지 않는다 - 하나도 못 받은 라인이 있을 수 있고 그것도 수령 결과다. 다만 출고한 것보다
 * 많이 받을 수는 없다: 데이터베이스가 이미 막고 있어(ck_shopfloor_receipt_qty) 화면이 통과시키면
 * 확정이 서버에서 되돌아온다.
 */
export const qtyProblemOf = (line: DraftLine): QtyProblem | null => {
  const trimmed = line.receivedQty.trim();

  if (trimmed === '') {
    return null;
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return 'notNumber';
  }

  if (value < 0) {
    return 'negative';
  }

  return value > line.issuedQty ? 'overIssued' : null;
};

const receivedOf = (line: DraftLine): number => Number(line.receivedQty.trim()) || 0;

/**
 * 출고한 것과 받은 것의 차이.
 *
 * 서버가 저장 시점에 스스로 만드는 값이라 확정 본문에 싣지 않는다. 화면은 사람이 보고 사유를
 * 적을 수 있도록 보이기만 한다.
 */
export const varianceOf = (line: DraftLine): number => line.issuedQty - receivedOf(line);

/** 적은 라인. 아무것도 안 적은 라인은 이번 수령에 넣지 않는다. */
const filled = (lines: DraftLine[]): DraftLine[] =>
  lines.filter((line) => line.receivedQty.trim() !== '');

/**
 * 이 라인이 모자란가.
 *
 * 출고보다 많이 받은 것은 모자란 것이 아니다. 부호를 보지 않고 차이로 뭉치면 초과일 때
 * 모자란 양이 음수로 적히고, 이미 막힌 라인에 사유까지 묻게 된다.
 */
export const isShort = (line: DraftLine): boolean =>
  line.receivedQty.trim() !== '' && qtyProblemOf(line) === null && varianceOf(line) > 0;

/**
 * 사유를 물어야 하는 라인.
 *
 * 데이터베이스는 사유를 비워 두게 두지만 화면은 요구한다 - 왜 모자란지를 아는 사람은 물건을
 * 받은 그 자리에 있고, 전표만 남으면 수량이 왜 갈렸는지가 사라진다.
 *
 * 다만 고를 것이 없으면 요구하지 않는다. 사유는 고객이 늘리는 값이라 현장에서 비어 올 수
 * 있는데, 그때도 요구하면 부족 수령을 영영 확정하지 못한다 - 물건은 이미 와 있다.
 */
export const needsReason = (line: DraftLine, hasReasonOptions: boolean): boolean =>
  hasReasonOptions && isShort(line) && line.reasonCode === '';

export const canConfirm = (
  issue: GoodsIssue | null,
  lines: DraftLine[],
  hasWorker: boolean,
  alreadyReceived: boolean,
  queuedReceipts: number,
  hasReasonOptions: boolean,
): boolean => {
  if (issue === null || !hasWorker || alreadyReceived || queuedReceipts > 0) {
    return false;
  }

  const entered = filled(lines);

  return (
    entered.length > 0 &&
    entered.every((line) => qtyProblemOf(line) === null && !needsReason(line, hasReasonOptions))
  );
};

/**
 * 이 출고 전표를 이 단말이 이미 받아 큐에 담아 두었는가.
 *
 * 서버 응답에는 아직 안 간 건이 없다. 오프라인에서 같은 전표를 두 번 받으면 둘 다 통과해
 * 수령이 두 번 서는데, 수령 전표는 출고 전표와 1:1 이라 뒤엣것이 반드시 되돌아온다.
 */
export const queuedReceiptsFor = (entries: { body?: unknown }[], goodsIssueId: number): number =>
  entries.filter(
    (entry) => (entry.body as { goodsIssueId?: number } | undefined)?.goodsIssueId === goodsIssueId,
  ).length;

export const toReceiptDraft = (
  issue: GoodsIssue,
  workOrderId: number,
  destinationLocationId: number,
  lines: DraftLine[],
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const body: ShopfloorReceiptCreate = {
    goodsIssueId: issue.goodsIssueId,
    workOrderId,
    destinationLocationId,
    receivedAt: now.toISOString(),
    /* 오프라인에서 늦게 닿아도 언제 한 일인지가 남아야 수불이 그날로 선다. */
    businessDate: now.toISOString().slice(0, 10),
    occurredAt: now.toISOString(),
    lines: filled(lines).map((line): ShopfloorReceiptLineCreate => ({
      goodsIssueLineId: line.goodsIssueLineId,
      itemId: line.itemId,
      lotId: line.lotId,
      issuedQty: line.issuedQty,
      receivedQty: receivedOf(line),
      uomId: line.uomId,
      varianceReasonCode: line.reasonCode === '' ? null : line.reasonCode,
    })),
  };

  return {
    label: RECEIPT_LABEL,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: '/logistics/shopfloor-receipts',
    body,
    occurredAt: now.toISOString(),
    confirmation: 'pending',
  };
};
