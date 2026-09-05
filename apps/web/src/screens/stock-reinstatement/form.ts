import type { StockReinstatementCreate } from './types';

export interface ReinstatementDraft {
  toWarehouseId: string;
  toLocationId: string;
  lotHoldId: string;
  qty: string;
  releaseReasonCode: string;
  reasonCode: string;
  remarks: string;
}

export const EMPTY_DRAFT: ReinstatementDraft = {
  toWarehouseId: '',
  toLocationId: '',
  lotHoldId: '',
  qty: '',
  releaseReasonCode: '',
  reasonCode: '',
  remarks: '',
};

export interface DraftErrors {
  toWarehouseId?: string;
  toLocationId?: string;
  lotHoldId?: string;
  qty?: string;
  releaseReasonCode?: string;
}

export interface ValidationInput {
  draft: ReinstatementDraft;
  maxQty: number | null;
  locationRequired: boolean;
  releaseReasonsReady: boolean;
  text: {
    warehouseRequired: string;
    locationRequired: string;
    holdRequired: string;
    qtyRequired: string;
    qtyExceeded: (qty: number) => string;
    releaseReasonRequired: string;
    releaseReasonUnavailable: string;
  };
}

export const validateDraft = (input: ValidationInput): DraftErrors => {
  const errors: DraftErrors = {};
  const qty = Number(input.draft.qty);

  if (input.draft.toWarehouseId === '') errors.toWarehouseId = input.text.warehouseRequired;
  if (input.locationRequired && input.draft.toLocationId === '') {
    errors.toLocationId = input.text.locationRequired;
  }
  if (input.draft.lotHoldId === '') errors.lotHoldId = input.text.holdRequired;
  if (!Number.isFinite(qty) || qty < 1) errors.qty = input.text.qtyRequired;
  else if (input.maxQty !== null && qty > input.maxQty)
    errors.qty = input.text.qtyExceeded(input.maxQty);
  if (!input.releaseReasonsReady) errors.releaseReasonCode = input.text.releaseReasonUnavailable;
  else if (input.draft.releaseReasonCode === '') {
    errors.releaseReasonCode = input.text.releaseReasonRequired;
  }

  return errors;
};

export const hasErrors = (errors: DraftErrors): boolean => Object.keys(errors).length > 0;

const pad = (value: number): string => String(value).padStart(2, '0');
const toBusinessDate = (at: Date): string =>
  `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
const toOccurredAt = (at: Date): string => {
  const offsetMinutes = -at.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absolute = Math.abs(offsetMinutes);
  return `${toBusinessDate(at)}T${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};

export interface BodyInput {
  draft: ReinstatementDraft;
  dispositionDecisionId: number;
  lotId: number;
  versionNo: number;
  uomId: number;
  now: Date;
}

export const toCreateBody = (input: BodyInput): StockReinstatementCreate => ({
  dispositionDecisionId: input.dispositionDecisionId,
  lot: { lotId: input.lotId, versionNo: input.versionNo },
  lotHoldId: Number(input.draft.lotHoldId),
  toWarehouseId: Number(input.draft.toWarehouseId),
  ...(input.draft.toLocationId === '' ? {} : { toLocationId: Number(input.draft.toLocationId) }),
  qty: Number(input.draft.qty),
  uomId: input.uomId,
  releaseReasonCode: input.draft.releaseReasonCode,
  ...(input.draft.reasonCode === '' ? {} : { reasonCode: input.draft.reasonCode }),
  businessDate: toBusinessDate(input.now),
  occurredAt: toOccurredAt(input.now),
  ...(input.draft.remarks.trim() === '' ? {} : { remarks: input.draft.remarks.trim() }),
});
