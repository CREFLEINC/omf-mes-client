import { messages } from '@omf-mes/i18n';

import { formatQty, type DispositionRequest } from './types';

/** ② 판정 의뢰 — 의뢰 수량은 1 이상 대상 수량 이하(스펙 §5-7 · §6 「의뢰 수량 초과」). */
export interface RequestFormValue {
  qty: string;
  remarks: string;
}

export const EMPTY_REQUEST_FORM: RequestFormValue = { qty: '', remarks: '' };

/**
 * 기본값은 **전량**이다 — 목업(§3 ②)이 「200 / 200」으로 그렸고, 부분 의뢰는 사용자가 줄여 적는다.
 * 수량을 모르면 비운다 — 지어내지 않는다.
 */
export const defaultRequestForm = (quantity: number | null): RequestFormValue => ({
  qty: quantity === null ? '' : String(quantity),
  remarks: '',
});

export interface RequestFormErrors {
  requestedQty?: string;
}

/** 정수 12자리·소수 6자리 — 계약 `double`의 표시 한계에 맞춘다. */
const QUANTITY_PATTERN = /^\d{1,12}(\.\d{1,6})?$/;

export const validateRequestForm = (
  value: RequestFormValue,
  maxQty: number | null,
): RequestFormErrors => {
  const t = messages.dispositionRequest.request;
  const raw = value.qty.trim();

  if (raw === '') return { requestedQty: t.qtyRequired };
  if (!QUANTITY_PATTERN.test(raw)) return { requestedQty: t.qtyNotNumber };

  const qty = Number(raw);
  if (!(qty >= 1)) return { requestedQty: t.qtyTooSmall };
  if (maxQty !== null && qty > maxQty) return { requestedQty: t.qtyExceeds(formatQty(maxQty)) };

  return {};
};

export const hasRequestInput = (value: RequestFormValue, quantity: number | null): boolean =>
  value.qty.trim() !== (quantity === null ? '' : String(quantity)) || value.remarks.trim() !== '';

/**
 * 의뢰 본문. 단위는 대상 LOT의 것으로 고정한다 — 화면이 고르지 않는다.
 * 검증을 통과하지 못하면 본문을 만들지 않는다 — 그 자체가 마지막 문이다.
 */
export const toDispositionRequestBody = (
  value: RequestFormValue,
  maxQty: number | null,
  uomId: number,
): DispositionRequest | undefined => {
  if (validateRequestForm(value, maxQty).requestedQty !== undefined) return undefined;

  const remarks = value.remarks.trim();

  return {
    requestedQty: Number(value.qty.trim()),
    uomId,
    ...(remarks === '' ? {} : { remarks }),
  };
};
