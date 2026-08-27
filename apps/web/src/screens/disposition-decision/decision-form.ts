import { messages } from '@omf-mes/i18n';

import type { RemainingQty } from './remaining-qty';

export interface DecisionFormValue {
  dispositionTypeCode: string;
  /** 입력 그대로의 글자. 숫자로 바꾸는 것은 검증을 통과한 뒤다. */
  qty: string;
  reason: string;
}

export interface DecisionFormErrors {
  dispositionTypeCode?: string;
  decisionQty?: string;
  reason?: string;
}

export interface DecisionCreateBody {
  dispositionTypeCode: string;
  decisionQty: number;
  uomId: number;
  reason: string;
}

export const EMPTY_DECISION_FORM: DecisionFormValue = {
  dispositionTypeCode: '',
  qty: '',
  reason: '',
};

/** 취소는 입력이 있을 때만 활성이다(스펙 §5-1) — API가 없고 화면 안에서 끝난다. */
export const hasDecisionInput = (value: DecisionFormValue): boolean =>
  value.dispositionTypeCode !== '' || value.qty.trim() !== '' || value.reason.trim() !== '';

const DECIMAL = /^\d+(\.\d+)?$/;

/**
 * 입력 검증. **남은 수량 초과는 「경고」이지 「차단」이 아니다** — 잔량 판정은 서버 몫이고
 * (공유계약 L-2) 화면이 낸 남은 수량은 참고값이라, 막아 버리면 서버가 허락할 저장을
 * 화면이 대신 거절하게 된다. 사용자에게 보이되 저장은 서버가 판정한다.
 */
export const validateDecisionForm = (value: DecisionFormValue): DecisionFormErrors => {
  const t = messages.dispositionDecision.form;
  const errors: DecisionFormErrors = {};
  const qty = value.qty.trim();

  if (value.dispositionTypeCode === '') errors.dispositionTypeCode = t.dispositionRequired;

  if (qty === '') errors.decisionQty = t.qtyRequired;
  else if (!DECIMAL.test(qty)) errors.decisionQty = t.qtyNotNumber;
  else if (Number(qty) < 1) errors.decisionQty = t.qtyTooSmall;

  if (value.reason.trim() === '') errors.reason = t.reasonRequired;

  return errors;
};

/** 남은 수량을 넘겼을 때 입력칸 아래 보이는 경고. 저장을 막지 않는다. */
export const overRemainingWarning = (
  value: DecisionFormValue,
  remaining: RemainingQty,
): string | undefined => {
  const qty = value.qty.trim();

  if (remaining.value === undefined || !DECIMAL.test(qty)) return undefined;

  return Number(qty) > remaining.value
    ? messages.dispositionDecision.form.qtyOverRemaining(remaining.text)
    : undefined;
};

export const hasBlockingError = (errors: DecisionFormErrors): boolean =>
  Object.values(errors).some((message) => message !== undefined);

/**
 * 보낼 본문. ⛔ `decidedBy`·`decidedAt`은 싣지 않는다 — 서버가 인증 주체와 수신 시각으로
 * 채운다(공유계약 B-6). 단위는 대상 LOT의 것으로 고정한다.
 */
export const toDecisionCreateBody = (
  value: DecisionFormValue,
  uomId: number,
): DecisionCreateBody => ({
  dispositionTypeCode: value.dispositionTypeCode,
  decisionQty: Number(value.qty.trim()),
  uomId,
  reason: value.reason.trim(),
});
