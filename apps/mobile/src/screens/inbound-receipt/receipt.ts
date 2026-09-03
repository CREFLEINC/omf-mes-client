import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type PurchaseOrder = components['schemas']['PurchaseOrder'];
export type PurchaseOrderLine = components['schemas']['PurchaseOrderLine'];
export type InboundReceiptCreate = components['schemas']['InboundReceiptCreate'];

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

/**
 * 담긴 채 아직 못 간 입하 수량.
 *
 * 서버가 주는 누적 입하에는 큐에 있는 것이 없다. 셈에 넣지 않으면 오프라인에서 같은 발주
 * 라인에 두 번 적었을 때 둘 다 남은 예정 안으로 읽혀, 서버가 거부할 초과가 정상으로 보인다.
 */
export const queuedQtyOf = (entries: QueuedReceipt[], purchaseOrderLineId: number): number =>
  entries
    .filter((entry) => entry.path === RECEIPT_PATH)
    .flatMap((entry) => {
      const body = entry.body as { lines?: unknown } | null;

      return Array.isArray(body?.lines) ? body.lines : [];
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
  /** 스캔한 공급사 LOT 번호. 미부착이면 비어 있다. */
  supplierLotNo: string;
  supplierLotMissing: boolean;
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
  deliveryNoteNo: string;
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

  /*
   * 무발주는 승계할 곳이 없어 셋을 사람이 고른다. 하나라도 비면 서버가 거부하는데, 그 거부는
   * 담아 둔 뒤에야 오므로 화면에서 막는다.
   */
  if (draft.unordered) {
    return draft.supplierId !== null && draft.itemId !== null && draft.uomId !== null;
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
    /* 업무 기준일은 단말이 정한다. 서버가 수신 시각으로 잡으면 날짜 경계에서 이중 계상이 난다. */
    businessDate: businessDateOf(now),
    occurredAt,
    lines: [
      {
        purchaseOrderLineId: draft.purchaseOrderLine?.purchaseOrderLineId ?? null,
        itemId,
        receivedQty: Number(draft.receivedQty.trim()),
        uomId,
        packageCount:
          draft.packageCount.trim() === '' ? null : Number(draft.packageCount.trim()),
        supplierLotNo: draft.supplierLotMissing ? null : optional(draft.supplierLotNo),
        supplierLotMissing: draft.supplierLotMissing,
        substituteLotReasonCode: draft.supplierLotMissing
          ? draft.substituteLotReasonCode
          : null,
        manufacturedDate: optional(draft.manufacturedDate),
        expiryDate: optional(draft.expiryDate),
      },
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
