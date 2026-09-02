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

/** 출고 유형 값 목록을 받는 그룹. */
export const ISSUE_TYPE = 'ISSUE_TYPE';

/** 큐에 담긴 피킹 한 건. 경로와 본문에서 뽑아 낸다. */
export interface QueuedPick {
  pickingLineId: number;
  pickedQty: number;
}

const PICK_PATH = /\/logistics\/picking-orders\/(\d+)\/lines\/(\d+):pick$/;

/**
 * 큐에 담긴 것 중 이 지시의 피킹만 골라 낸다.
 *
 * 큐는 화면을 가리지 않고 한 줄로 쌓이므로 다른 지시의 건이 섞여 있다. 경로에서 지시와 라인을
 * 읽어 이 화면 몫만 센다.
 */
export const queuedPicksOf = (
  entries: { path: string; body: unknown }[],
  pickingOrderId: number,
): QueuedPick[] =>
  entries.flatMap((entry) => {
    const matched = PICK_PATH.exec(entry.path);

    if (matched === null || Number(matched[1]) !== pickingOrderId) {
      return [];
    }

    const body = entry.body as { pickedQty?: unknown } | null;
    const qty = typeof body?.pickedQty === 'number' ? body.pickedQty : 0;

    return [{ pickingLineId: Number(matched[2]), pickedQty: qty }];
  });

export type LineProblem = 'held' | 'done';

/**
 * 아직 서버에 닿지 않은 피킹.
 *
 * 큐에 담긴 건은 서버 응답에 없다. 그 만큼을 셈에 넣지 않으면 화면이 안 집은 것으로 보여
 * 같은 라인을 다시 집게 되고, 큐에 두 건이 쌓여 둘 다 나간다 - 되돌릴 수 없는 재고 차감이다.
 */
export const queuedQtyOf = (line: PickingLine, queued: QueuedPick[]): number =>
  queued
    .filter((each) => each.pickingLineId === line.pickingLineId)
    .reduce((total, each) => total + each.pickedQty, 0);

/** 서버가 아는 만큼과 담아 둔 만큼을 합친 것. 화면이 보이는 수는 이것이다. */
export const pickedQtyOf = (line: PickingLine, queued: QueuedPick[]): number =>
  line.pickedQty + queuedQtyOf(line, queued);

export const remainingQtyOf = (line: PickingLine, queued: QueuedPick[] = []): number =>
  line.plannedQty - pickedQtyOf(line, queued);

/**
 * 이 라인을 지금 집을 수 있는가.
 *
 * 보류는 서버가 표시해 내려준다 - 화면이 따로 판정하지 않는다. 판정 정본이 하나여야 오프라인
 * 에서 화면이 다르게 판단하는 일이 없다.
 */
export const lineProblemOf = (line: PickingLine, queued: QueuedPick[] = []): LineProblem | null => {
  if (line.held === true) {
    return 'held';
  }

  return pickedQtyOf(line, queued) >= line.plannedQty ? 'done' : null;
};

export type QtyProblem = 'notNumber' | 'notPositive' | 'overPlanned';

export const qtyProblemOf = (
  text: string,
  line: PickingLine,
  queued: QueuedPick[] = [],
): QtyProblem | null => {
  const trimmed = text.trim();
  const value = Number(trimmed);

  if (trimmed === '' || !Number.isFinite(value)) {
    return 'notNumber';
  }

  if (value <= 0) {
    return 'notPositive';
  }

  return value > remainingQtyOf(line, queued) ? 'overPlanned' : null;
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
export const isOutOfSequence = (
  line: PickingLine,
  lines: PickingLine[],
  queued: QueuedPick[] = [],
): boolean => {
  const rank = line.pickSequenceRank;

  if (rank === null || rank === undefined) {
    return false;
  }

  return lines.some(
    (each) =>
      each.itemId === line.itemId &&
      lineProblemOf(each, queued) === null &&
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
  queued: QueuedPick[] = [],
): boolean => {
  if (!hasWorker || line === null || scanned === null) {
    return false;
  }

  if (lineProblemOf(line, queued) !== null || !isScannedLotOf(line, scanned)) {
    return false;
  }

  return qtyProblemOf(qty, line, queued) === null;
};

/**
 * 한 건이라도 집었으면 출고를 확정할 수 있다. 모자란 만큼은 부분 출고로 남는다.
 *
 * 담아 둔 것도 집은 것으로 센다. 서버가 아는 것만 세면 오프라인에서 확정이 영영 열리지
 * 않는데, 이 화면은 오프라인 출고를 전제한다.
 */
export const canConfirmIssue = (
  lines: PickingLine[],
  hasWorker: boolean,
  queued: QueuedPick[] = [],
): boolean => hasWorker && lines.some((line) => pickedQtyOf(line, queued) > 0);

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
  queued: QueuedPick[],
  issueTypeCode: string,
  batchId: string,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  /* 집은 만큼만 나간다. 안 집은 라인은 부족분으로 남는다. */
  const issued: GoodsIssueLineUpsert[] = lines
    .map((line) => ({ line, qty: pickedQtyOf(line, queued) }))
    .filter((each) => each.qty > 0)
    .map(({ line, qty }) => ({
      pickingLineId: line.pickingLineId,
      itemId: line.itemId,
      lotId: line.lotId,
      issueQty: qty,
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
