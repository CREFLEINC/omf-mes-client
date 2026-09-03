import type { components } from '@omf-mes/api-client';
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

/**
 * 보낼 본문은 **계약에서 파생한다.** 손으로 옮겨 적으면 계약에 필수 필드가 늘어도 컴파일이
 * 잡지 못한다 — 되돌릴 수 없는 쓰기의 본문이라 특히 그렇다.
 */
export type DecisionCreateBody = components['schemas']['DispositionDecisionCreate'];

export const EMPTY_DECISION_FORM: DecisionFormValue = {
  dispositionTypeCode: '',
  qty: '',
  reason: '',
};

/**
 * 취소는 입력이 있을 때만 활성이다(스펙 §5-1) — API가 없고 화면 안에서 끝난다.
 *
 * 칸 이름을 늘어놓지 않고 값 전체를 본다 — 폼에 칸이 늘면 이 함수가 조용히 뒤처져
 * 「입력이 있는데 취소가 비활성」이 된다.
 */
export const hasDecisionInput = (value: DecisionFormValue): boolean =>
  Object.values(value).some((field) => field.trim() !== '');

/**
 * 받는 수의 모양.
 *
 * ⚠ **자릿수 상한이 있어야 한다.** 열어 두면 `'999999999999999999999'`가 통과해 `1e+21`이
 * 전선에 실리고(거르려던 지수 표기 그대로다), `'9007199254740993'`은 **사용자가 친 수와 다른
 * 값으로 말없이 바뀌어** 되돌릴 수 없는 원장에 남는다. 소수 여섯 자리는 표시 자릿수와 맞춘다.
 */
const DECIMAL = /^\d{1,12}(\.\d{1,6})?$/;

/**
 * 입력 검증.
 *
 * ⭐ **남은 수량 초과는 여기서 다루지 않는다.** 잔량 판정은 서버 몫이고(공유계약 L-2) 화면이
 * 낸 남은 수량은 참고값이라, 막아 버리면 **서버가 허락할 저장을 화면이 대신 거절**하게 된다.
 * 대신 `remainingNotice`가 무엇이 일어날지 예고한다.
 *
 * ⚠ **하한은 「0 초과」다.** 물리 모델의 제약이 `CHECK (> 0)`이고 계약에 `minimum`이 없으며
 * 수량이 소수일 수 있다(`double`). 스펙 §4-B가 「1 이상」이라 적은 것과 어긋나 설계 저장소에
 * 물어 두었다(omf-mes#253) — 회신 전까지 물리 모델을 따른다. 「1 이상」으로 막으면 서버가
 * 받아들이는 `0.5` 같은 부분 처분을 화면만 거절하게 된다.
 */
export const validateDecisionForm = (value: DecisionFormValue): DecisionFormErrors => {
  const t = messages.dispositionDecision.form;
  const errors: DecisionFormErrors = {};
  const qty = value.qty.trim();

  if (value.dispositionTypeCode === '') errors.dispositionTypeCode = t.dispositionRequired;

  if (qty === '') errors.decisionQty = t.qtyRequired;
  else if (/^\d+(\.\d+)?$/.test(qty) && !DECIMAL.test(qty)) errors.decisionQty = t.qtyTooLong;
  else if (!DECIMAL.test(qty)) errors.decisionQty = t.qtyNotNumber;
  else if (Number(qty) <= 0) errors.decisionQty = t.qtyTooSmall;

  if (value.reason.trim() === '') errors.reason = t.reasonRequired;

  return errors;
};

export const hasBlockingError = (errors: DecisionFormErrors): boolean =>
  Object.values(errors).some((message) => message !== undefined);

/**
 * 남은 수량에 대해 입력칸 아래 보이는 **예고**. 저장을 막지 않는다.
 *
 * ⚠ **명령이 아니라 예고로 적는다.** 막지 않으면서 「이하로 입력하세요」라고 하면 화면이
 * 「고쳐라」와 「진행해도 된다」를 동시에 말한다. 남은 수량이 0일 때도 같은 자리에서 예고한다 —
 * 그 값도 같은 참고값이라, 한쪽은 막고 한쪽은 막지 않으면 기준이 화면 안에서 갈린다.
 */
export const remainingNotice = (
  value: DecisionFormValue,
  remaining: RemainingQty,
): string | undefined => {
  const t = messages.dispositionDecision.form;

  if (remaining.value === undefined) return undefined;
  if (remaining.isSettled) return t.qtySettledNotice;

  const qty = value.qty.trim();
  if (!DECIMAL.test(qty)) return undefined;

  return Number(qty) > remaining.value ? t.qtyOverRemaining(remaining.text) : undefined;
};

/**
 * 보낼 본문. **검증을 통과하지 못한 폼은 본문을 만들지 않는다.**
 *
 * ⛔ 열어 두면 `qty: ''`가 `decisionQty: 0`(물리 제약 위반)으로, `qty: '십이'`가 `NaN` →
 * 직렬화되며 `null`(계약 required 위반)로 전선에 실린다. 반환 타입이 `number`라 컴파일도
 * 잡지 못한다 — 「호출자가 먼저 검증한다」는 약속을 타입으로 바꾼다.
 *
 * ⛔ `decidedBy`·`decidedAt`은 싣지 않는다 — 서버가 인증 주체와 수신 시각으로 채운다(B-6).
 * 단위는 대상 LOT의 것으로 고정한다.
 */
export const toDecisionCreateBody = (
  value: DecisionFormValue,
  uomId: number,
): DecisionCreateBody | undefined => {
  if (hasBlockingError(validateDecisionForm(value))) return undefined;

  return {
    /* 선택지가 계약 `enum` 세 값 그대로다 — 계약이 닫은 형으로 좁혀 싣는다. */
    dispositionTypeCode: value.dispositionTypeCode as DecisionCreateBody['dispositionTypeCode'],
    decisionQty: Number(value.qty.trim()),
    uomId,
    reason: value.reason.trim(),
  };
};
