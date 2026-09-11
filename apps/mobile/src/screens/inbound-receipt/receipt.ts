import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type PurchaseOrder = components['schemas']['PurchaseOrder'];
export type PurchaseOrderLine = components['schemas']['PurchaseOrderLine'];
export type InboundReceiptCreate = components['schemas']['InboundReceiptCreate'];
export type InboundReceiptLineUpsert = components['schemas']['InboundReceiptLineUpsert'];
export type InboundReceiptSplitRequest = components['schemas']['InboundReceiptSplitRequest'];
export type SplitMode = InboundReceiptSplitRequest['mode'];

/**
 * 입하 검증 세 갈래.
 *
 * 허용치는 발주 라인이 갖고 있고 서버가 다시 판정하지 않는다. 화면이 판정한 결과를 사람에게
 * 먼저 보인 뒤에 다음으로 넘긴다 - 조용히 넘기면 왜 다른 화면에 왔는지 알 수 없다.
 */
export const NORMAL = 'normal';
export const OVER = 'over';
export const UNDER = 'under';

export type Verdict = typeof NORMAL | typeof OVER | typeof UNDER;

/**
 * 아직 안 온 수량. 한 발주에 여러 번 도착할 수 있어 발주 총량과 견주면 두 방향으로 틀린다.
 *
 * 분할 납품의 마지막 회차가 부족으로 읽히고, 누적이 총량을 넘긴 것도 부족으로 읽힌다.
 * 뒤엣것이 더 무겁다 - 서버가 거부할 초과인데 화면이 입하 오류 등록으로 보낸다.
 */
export const remainingQtyOf = (line: PurchaseOrderLine, queuedQty = 0): number =>
  line.orderedQty - line.receivedQty - queuedQty;

/**
 * 이번 도착까지 받고도 남는 몫.
 *
 * 판정이 견주는 남은 예정은 이번 도착을 빼기 전이다. 부족을 알릴 때 보이는 네 수의
 * 마지막은 이번 것까지 받고도 얼마가 남는지라, 둘을 같은 수로 보이면 사람이 무엇을 고르는지
 * 모른 채 고른다.
 */
export const remainingAfterOf = (
  line: PurchaseOrderLine,
  arrivedQty: number,
  queuedQty = 0,
): number => remainingQtyOf(line, queuedQty) - arrivedQty;

export const verdictOf = (line: PurchaseOrderLine, arrivedQty: number, queuedQty = 0): Verdict => {
  const remaining = remainingQtyOf(line, queuedQty);

  if (arrivedQty > remaining + line.toleranceOverQty) {
    return OVER;
  }

  return arrivedQty < remaining - line.toleranceUnderQty ? UNDER : NORMAL;
};

/** 큐에서 이 화면이 셈에 넣을 만큼만 읽는다. 큐는 화면을 가리지 않고 한 줄로 쌓인다. */
export interface QueuedReceipt {
  path: string;
  body: unknown;
}

export const RECEIPT_PATH = '/logistics/inbound-receipts';
export const SPLIT_RECEIPT_PATH = '/logistics/inbound-receipts:split';

/**
 * 담긴 채 아직 못 간 입하 수량.
 *
 * 서버가 주는 누적 입하에는 큐에 있는 것이 없다. 셈에 넣지 않으면 오프라인에서 같은 발주
 * 라인에 두 번 적었을 때 둘 다 남은 예정 안으로 읽혀, 서버가 거부할 초과가 정상으로 보인다.
 */
export const queuedQtyOf = (entries: QueuedReceipt[], purchaseOrderLineId: number): number =>
  entries
    .flatMap((entry) => {
      const body = entry.body as { lines?: unknown; normal?: { lines?: unknown } } | null;

      if (entry.path === RECEIPT_PATH) {
        return Array.isArray(body?.lines) ? body.lines : [];
      }

      if (entry.path === SPLIT_RECEIPT_PATH) {
        return Array.isArray(body?.normal?.lines) ? body.normal.lines : [];
      }

      return [];
    })
    .reduce((sum: number, raw) => {
      const line = raw as { purchaseOrderLineId?: unknown; receivedQty?: unknown };

      if (line.purchaseOrderLineId !== purchaseOrderLineId) {
        return sum;
      }

      return sum + (typeof line.receivedQty === 'number' ? line.receivedQty : 0);
    }, 0);

export type QtyProblem = 'empty' | 'notNumber' | 'notPositive';

export const qtyProblem = (text: string): QtyProblem | null => {
  const trimmed = text.trim();

  if (trimmed === '') {
    return 'empty';
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return 'notNumber';
  }

  return value <= 0 ? 'notPositive' : null;
};

/** 포장 수는 비워도 되지만 적었다면 0보다 커야 한다. */
export const packageProblem = (text: string): QtyProblem | null =>
  text.trim() === '' ? null : qtyProblem(text);

/**
 * 유효기한이 제조일보다 앞서는가.
 *
 * 둘 다 있을 때만 순서를 본다 - 한쪽이 비어 있으면 견줄 것이 없다.
 */
export const isExpiryBeforeManufactured = (manufactured: string, expiry: string): boolean =>
  manufactured.trim() !== '' && expiry.trim() !== '' && expiry < manufactured;

/** 단말이 정하는 업무 기준일. 서버가 수신 시각으로 다시 잡지 않는다. */
export const businessDateOf = (now: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export interface ReceiptDraft {
  /** 스캔 또는 수기로 받은 공급사 LOT 원문. 번호가 없으면 비어 있다. */
  supplierLotNo: string;
  supplierLotMissing: boolean;
  /** 공급사가 준 LOT 라벨이 물건에 실제 부착됐는가. */
  supplierLotLabelAttached: boolean;
  substituteLotReasonCode: string;
  purchaseOrder: PurchaseOrder | null;
  purchaseOrderLine: PurchaseOrderLine | null;
  /**
   * 발주 없이 도착한 건인가.
   *
   * 발주가 없으면 공급사도 품목도 단위도 승계할 곳이 없어 담당자가 고른다. 발주를 고르지
   * 않은 것과 무발주로 넣겠다는 것은 다른 상태다 - 앞엣것은 아직 안 고른 것이고 뒤엣것은
   * 고를 발주가 없다는 뜻이라, 하나로 뭉치면 덜 고른 채로 등록이 열린다.
   */
  unordered: boolean;
  supplierId: number | null;
  itemId: number | null;
  uomId: number | null;
  exceptionTypeCode: string;
  exceptionReason: string;
  deliveryNoteNo: string;
  vehicleNo: string;
  receivedQty: string;
  packageCount: string;
  manufacturedDate: string;
  expiryDate: string;
}

export const canSubmit = (draft: ReceiptDraft, hasWorker: boolean): boolean => {
  if (!hasWorker) {
    return false;
  }

  if (qtyProblem(draft.receivedQty) !== null || packageProblem(draft.packageCount) !== null) {
    return false;
  }

  if (isExpiryBeforeManufactured(draft.manufacturedDate, draft.expiryDate)) {
    return false;
  }

  /* 미부착 분기는 데이터에 있는 구분이다. 사유 없이 참으로 보내면 서버가 거부한다. */
  if (draft.supplierLotMissing && draft.substituteLotReasonCode === '') {
    return false;
  }

  /* 번호가 없는데 부착됐다고 보내면 사전부착 스캔 경로와 충돌한다. */
  if (draft.supplierLotMissing && draft.supplierLotLabelAttached) {
    return false;
  }

  /*
   * 무발주는 승계할 곳이 없어 셋을 사람이 고른다. 하나라도 비면 서버가 거부하는데, 그 거부는
   * 담아 둔 뒤에야 오므로 화면에서 막는다.
   */
  if (draft.unordered) {
    return (
      draft.supplierId !== null &&
      draft.itemId !== null &&
      draft.uomId !== null &&
      draft.exceptionTypeCode.trim() !== '' &&
      draft.exceptionReason.trim() !== ''
    );
  }

  return draft.purchaseOrder !== null && draft.purchaseOrderLine !== null;
};

/** 이 건이 실을 품목·단위·공급사. 발주가 있으면 승계하고 없으면 고른 값을 쓴다. */
export interface ReceiptSource {
  itemId: number;
  uomId: number;
  supplierId: number;
}

export const sourceOf = (draft: ReceiptDraft): ReceiptSource | null => {
  if (draft.unordered) {
    return draft.supplierId === null || draft.itemId === null || draft.uomId === null
      ? null
      : { itemId: draft.itemId, uomId: draft.uomId, supplierId: draft.supplierId };
  }

  const line = draft.purchaseOrderLine;

  return line === null || draft.purchaseOrder === null
    ? null
    : { itemId: line.itemId, uomId: line.uomId, supplierId: draft.purchaseOrder.supplierId };
};

const optional = (value: string): string | null => (value.trim() === '' ? null : value.trim());

const toLine = (
  draft: ReceiptDraft,
  itemId: number,
  uomId: number,
  receivedQty: number,
  purchaseOrderLineId: number | null,
): InboundReceiptLineUpsert => ({
  purchaseOrderLineId,
  itemId,
  receivedQty,
  uomId,
  packageCount: draft.packageCount.trim() === '' ? null : Number(draft.packageCount.trim()),
  supplierLotNo: draft.supplierLotMissing ? null : optional(draft.supplierLotNo),
  supplierLotMissing: draft.supplierLotMissing,
  supplierLotLabelAttached: draft.supplierLotMissing ? false : draft.supplierLotLabelAttached,
  substituteLotReasonCode: draft.supplierLotMissing ? draft.substituteLotReasonCode : null,
  manufacturedDate: optional(draft.manufacturedDate),
  expiryDate: optional(draft.expiryDate),
});

export const toOutboxDraft = (
  draft: ReceiptDraft,
  itemId: number,
  uomId: number,
  plantId: number,
  supplierId: number,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const occurredAt = now.toISOString();
  const body: InboundReceiptCreate = {
    supplierId,
    plantId,
    receiptDatetime: occurredAt,
    deliveryNoteNo: optional(draft.deliveryNoteNo),
    vehicleNo: optional(draft.vehicleNo),
    ...(draft.unordered
      ? {
          exceptionTypeCode: draft.exceptionTypeCode.trim(),
          exceptionReason: draft.exceptionReason.trim(),
        }
      : {}),
    /* 업무 기준일은 단말이 정한다. 서버가 수신 시각으로 잡으면 날짜 경계에서 이중 계상이 난다. */
    businessDate: businessDateOf(now),
    occurredAt,
    lines: [
      toLine(
        draft,
        itemId,
        uomId,
        Number(draft.receivedQty.trim()),
        draft.purchaseOrderLine?.purchaseOrderLineId ?? null,
      ),
    ],
  };

  return {
    label: messages.inboundReceipt.record,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: RECEIPT_PATH,
    body,
    occurredAt,
    confirmation: 'pending',
  };
};

export interface SplitQuantities {
  remaining: number;
  normal: number;
  excess: number;
}

/** 초과 허용치까지는 ERP W/O에 귀속하고, 그보다 많이 온 수량만 비귀속으로 가른다. */
export const splitQuantitiesOf = (
  line: PurchaseOrderLine,
  arrivedQty: number,
  queuedQty = 0,
): SplitQuantities => {
  const remaining = remainingQtyOf(line, queuedQty);
  const normal = Math.min(arrivedQty, Math.max(0, remaining + line.toleranceOverQty));

  return { remaining, normal, excess: arrivedQty - normal };
};

const splitPart = (
  draft: ReceiptDraft,
  itemId: number,
  uomId: number,
  plantId: number,
  supplierId: number,
  receiptDatetime: string,
  receivedQty: number,
  purchaseOrderLineId: number | null,
) => ({
  supplierId,
  plantId,
  receiptDatetime,
  deliveryNoteNo: optional(draft.deliveryNoteNo),
  vehicleNo: optional(draft.vehicleNo),
  lines: [toLine(draft, itemId, uomId, receivedQty, purchaseOrderLineId)],
});

/**
 * 모바일 초과 입하를 한 트랜잭션 요청으로 만든다.
 *
 * 정량분만 원 ERP W/O 라인에 귀속한다. 초과분에 그 식별자를 싣으면 초과가 원 발주 누적에
 * 다시 더해져 분리 자체가 무효가 된다.
 */
export const toSplitOutboxDraft = (
  draft: ReceiptDraft,
  itemId: number,
  uomId: number,
  plantId: number,
  supplierId: number,
  now: Date,
  workerNo: string,
  mode: SplitMode,
  exceptionTypeCode: string,
  exceptionReason: string,
  queuedQty = 0,
): OutboxDraft => {
  const line = draft.purchaseOrderLine;

  if (line === null) {
    throw new Error('초과 입하 분리는 ERP W/O 라인을 고른 뒤에만 만들 수 있습니다.');
  }

  const occurredAt = now.toISOString();
  const quantities = splitQuantitiesOf(line, Number(draft.receivedQty.trim()), queuedQty);
  const normal = splitPart(
    draft,
    itemId,
    uomId,
    plantId,
    supplierId,
    occurredAt,
    quantities.normal,
    line.purchaseOrderLineId,
  );
  const excess = {
    ...splitPart(draft, itemId, uomId, plantId, supplierId, occurredAt, quantities.excess, null),
    exceptionTypeCode: exceptionTypeCode.trim(),
    exceptionReason: exceptionReason.trim(),
  };
  const shared = { businessDate: businessDateOf(now), occurredAt };
  const body: InboundReceiptSplitRequest =
    mode === 'BOTH'
      ? { ...shared, mode: 'BOTH', normal, excess }
      : mode === 'NORMAL_ONLY'
        ? { ...shared, mode: 'NORMAL_ONLY', normal }
        : { ...shared, mode: 'EXCESS_ONLY', excess };

  return {
    label: messages.inboundReceipt.record,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: SPLIT_RECEIPT_PATH,
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
