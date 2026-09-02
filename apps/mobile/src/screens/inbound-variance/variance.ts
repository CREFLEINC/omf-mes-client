import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { createIdempotencyKey, type OutboxDraft } from '../../patterns/outbox';

export type InboundReceipt = components['schemas']['InboundReceipt'];
export type InboundReceiptLine = components['schemas']['InboundReceiptLine'];
export type InboundVariance = components['schemas']['InboundVariance'];
export type InboundVarianceCreate = components['schemas']['InboundVarianceCreate'];

export type QtyProblem = 'empty' | 'notNumber' | 'notPositive';

/**
 * 차이를 부호로 담지 않는다.
 *
 * 수량이 모자라든 넘치든 양수이고 방향은 유형이 말한다. 사람에게는 부호를 묻지 않고 얼마인지만
 * 묻는다.
 */
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

export interface VarianceDraft {
  line: InboundReceiptLine | null;
  varianceTypeCode: string;
  varianceQty: string;
  /** 사유는 선택이다. 현장이 사유를 모를 때 오류 기록 자체가 막히면 안 된다. */
  reasonCode: string;
}

export const canSubmit = (draft: VarianceDraft, hasWorker: boolean): boolean =>
  hasWorker &&
  draft.line !== null &&
  draft.varianceTypeCode !== '' &&
  qtyProblem(draft.varianceQty) === null;

export const toOutboxDraft = (
  draft: VarianceDraft,
  line: InboundReceiptLine,
  now: Date,
  workerNo: string,
): OutboxDraft => {
  const body: InboundVarianceCreate = {
    varianceTypeCode: draft.varianceTypeCode,
    varianceQty: Number(draft.varianceQty.trim()),
    /* 단위는 입하 라인의 것을 그대로 옮긴다. 화면이 고르게 두면 차이와 실입하가 갈린다. */
    uomId: line.uomId,
    reasonCode: draft.reasonCode === '' ? null : draft.reasonCode,
  };

  return {
    label: messages.inboundVariance.record,
    workerNo,
    idempotencyKey: createIdempotencyKey(),
    method: 'POST',
    path: `/logistics/inbound-receipt-lines/${String(line.inboundReceiptLineId)}/variances`,
    body,
    occurredAt: now.toISOString(),
    confirmation: 'pending',
  };
};
