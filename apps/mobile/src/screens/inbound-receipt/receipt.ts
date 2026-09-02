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

export const verdictOf = (line: PurchaseOrderLine, receivedQty: number): Verdict => {
  if (receivedQty > line.orderedQty + line.toleranceOverQty) {
    return OVER;
  }

  return receivedQty < line.orderedQty - line.toleranceUnderQty ? UNDER : NORMAL;
};

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

  return draft.purchaseOrder !== null && draft.purchaseOrderLine !== null;
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
    path: '/logistics/inbound-receipts',
    body,
    occurredAt,
    confirmation: 'pending',
  };
};
