import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type PickingOrder = components['schemas']['PickingOrder'];
export type PickingLine = components['schemas']['PickingLine'];
export type PickingLinePick = components['schemas']['PickingLinePick'];
export type GoodsIssueCreate = components['schemas']['GoodsIssueCreate'];
export type GoodsIssueLineUpsert = components['schemas']['GoodsIssueLineUpsert'];

/**
 * 출고 원천 문서의 유형.
 *
 * 이 화면의 출고는 피킹 지시에서 나온다. 값 목록이 아직 확정되지 않아 자리표시로 두고, 화면이
 * 그 사실을 적는다 - 지어낸 값을 소리 없이 실으면 값이 정해지는 날 전부 거부된다.
 */
export const SOURCE_DOCUMENT_TYPE = 'PICKING_ORDER';

/** 생산 투입 출고의 도착은 위치다. 계약이 값을 닫아 두었다. */
export const DESTINATION_TYPE = 'LOCATION';

/** 출고 유형 값 목록을 받는 그룹. */
export const ISSUE_TYPE = 'ISSUE_TYPE';

export type LineProblem = 'held' | 'done';

/**
 * 이 라인을 지금 집을 수 있는가.
 *
 * 보류는 서버가 표시해 내려준다 - 화면이 따로 판정하지 않는다. 판정 정본이 하나여야 오프라인
 * 에서 화면이 다르게 판단하는 일이 없다.
 */
export const lineProblemOf = (line: PickingLine): LineProblem | null => {
  if (line.held === true) {
    return 'held';
  }

  return line.pickedQty >= line.plannedQty ? 'done' : null;
};

export const remainingQtyOf = (line: PickingLine): number => line.plannedQty - line.pickedQty;

export type QtyProblem = 'notNumber' | 'notPositive' | 'overPlanned';

export const qtyProblemOf = (text: string, line: PickingLine): QtyProblem | null => {
  const trimmed = text.trim();
  const value = Number(trimmed);

  if (trimmed === '' || !Number.isFinite(value)) {
    return 'notNumber';
  }

  if (value <= 0) {
    return 'notPositive';
  }

  return value > remainingQtyOf(line) ? 'overPlanned' : null;
};

/**
 * 스캔한 LOT 이 이 라인의 것인가.
 *
 * 라인이 가리키는 LOT 번호를 응답이 함께 내려준다 - 번호를 되짚어 부르지 않는다. 다른 LOT 을
 * 집으면 계획과 어긋난 채로 출고가 나가고, 서버도 그것을 400 으로 막는다.
 */
export const isScannedLotOf = (line: PickingLine, scanned: string): boolean =>
  line.lotNo !== undefined && line.lotNo === scanned;

/** 선출 순서를 지켰는가. 서버가 매긴 순위를 화면이 다시 계산하지 않는다. */
export const isOutOfSequence = (line: PickingLine, lines: PickingLine[]): boolean => {
  const rank = line.pickSequenceRank;

  if (rank === null || rank === undefined) {
    return false;
  }

  return lines.some(
    (each) =>
      each.itemId === line.itemId &&
      lineProblemOf(each) === null &&
      each.pickSequenceRank !== null &&
      each.pickSequenceRank !== undefined &&
      each.pickSequenceRank < rank,
  );
};

export const canPick = (
  line: PickingLine | null,
  scanned: string | null,
  qty: string,
  hasWorker: boolean,
): boolean => {
  if (!hasWorker || line === null || scanned === null) {
    return false;
  }

  if (lineProblemOf(line) !== null || !isScannedLotOf(line, scanned)) {
    return false;
  }

  return qtyProblemOf(qty, line) === null;
};

/** 한 건이라도 집었으면 출고를 확정할 수 있다. 모자란 만큼은 부분 출고로 남는다. */
export const canConfirmIssue = (lines: PickingLine[], hasWorker: boolean): boolean =>
  hasWorker && lines.some((line) => line.pickedQty > 0);

const pad = (value: number): string => String(value).padStart(2, '0');

export const businessDateOf = (now: Date): string =>
  `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

export const toPickDraft = (
  order: PickingOrder,
  line: PickingLine,
  qty: string,
  batchId: string,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const body: PickingLinePick = {
    pickedQty: Number(qty.trim()),
    lotId: line.lotId,
    businessDate: businessDateOf(now),
    occurredAt,
  };

  return {
    label: messages.materialPicking.record.picked,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: `/logistics/picking-orders/${String(order.pickingOrderId)}/lines/${String(line.pickingLineId)}:pick`,
    body,
    batchId,
    occurredAt,
    confirmation: 'pending',
  };
};

/**
 * 출고 확정.
 *
 * 등록과 전기를 한 요청으로 보낸다 - 둘로 나누면 오프라인 큐에 중간 상태가 남는다.
 *
 * 도착지를 비운다. 계약이 선택으로 두었고, 이 화면에는 그 위치를 받을 경로가 없다 - 지어낸
 * 값을 실으면 엉뚱한 자리로 나간 것으로 기록된다.
 */
export const toIssueDraft = (
  order: PickingOrder,
  lines: PickingLine[],
  issueTypeCode: string,
  batchId: string,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  /* 집은 만큼만 나간다. 안 집은 라인은 부족분으로 남는다. */
  const issued: GoodsIssueLineUpsert[] = lines
    .filter((line) => line.pickedQty > 0)
    .map((line) => ({
      pickingLineId: line.pickingLineId,
      itemId: line.itemId,
      lotId: line.lotId,
      issueQty: line.pickedQty,
      uomId: line.uomId,
      sourceLocationId: line.locationId,
    }));

  const body: GoodsIssueCreate = {
    issueTypeCode,
    sourceDocumentTypeCode: SOURCE_DOCUMENT_TYPE,
    sourceDocumentId: order.pickingOrderId,
    sourceWarehouseId: order.warehouseId,
    issuedAt: occurredAt,
    sendToErp: true,
    /* 나누면 큐에 중간 상태가 남는다. */
    postImmediately: true,
    businessDate: businessDateOf(now),
    occurredAt,
    lines: issued,
  };

  return {
    label: messages.materialPicking.record.issued,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: '/logistics/goods-issues',
    body,
    batchId,
    occurredAt,
    confirmation: 'pending',
  };
};
