import { messages } from '@omf-mes/i18n';

/**
 * ② 수량 검증 — **≤ LOT 수량 AND ≤ 배정 잔여**(W-04-05 §5-7 · §6).
 *
 * ⚠ **이 화면은 W-03-10과 반대로 «막는다».** 거기서는 잔량이 서버가 계산한 값이라 화면이
 * 막으면 서버가 허락할 저장을 대신 거절하게 됐지만, 여기 두 상한은 **화면이 이미 손에 쥔
 * 값**이다(LOT의 `initialQty`, 라인의 `allocatedQty − shippedQty`). 되돌릴 수 없는 쓰기라
 * 확실히 아는 초과는 보내지 않는다.
 */

/**
 * 받는 수의 모양.
 *
 * ⚠ **자릿수 상한이 있어야 한다.** 열어 두면 `'999999999999999999999'`가 통과해 `1e+21`이
 * 전선에 실리고, `'9007199254740993'`은 **사용자가 친 수와 다른 값으로 말없이 바뀐다.**
 * 되돌릴 수 없는 원장에 남는 수라 특히 그렇다.
 */
const DECIMAL = /^\d{1,12}(\.\d{1,6})?$/;

export interface QuantityLimits {
  /** LOT이 가진 수량. */
  lotQty: number;
  /** 배정 잔여 — 배정에서 이미 출하된 만큼을 뺀 값. */
  remainingQty: number;
}

/** 표시용 — 소수 끝의 0을 붙이지 않는다. `toString`이 정수는 정수로 낸다. */
export const formatQty = (value: number): string => String(value);

/**
 * 수량 한 칸의 오류. 없으면 `undefined`.
 *
 * ⭐ **두 상한을 함께 보인다.** 어느 쪽에 걸렸는지 알아야 고칠 수 있는데, 낮은 쪽만 말하면
 * 사용자가 그 값으로 고친 뒤 «다른» 상한에 다시 걸린다.
 */
export const quantityError = (raw: string, limits: QuantityLimits | null): string | undefined => {
  const t = messages.expeditedShipment.qty;
  const value = raw.trim();

  if (value === '') return t.required;
  if (!/^\d/.test(value)) return t.notNumber;
  if (!DECIMAL.test(value)) {
    /* 모양이 수인데 길이만 넘친 경우와 아예 수가 아닌 경우를 가른다 — 해법이 다르다. */
    return /^\d+(\.\d+)?$/.test(value) ? t.tooLong : t.notNumber;
  }

  const parsed = Number(value);
  if (parsed <= 0) return t.tooSmall;

  /* 상한을 아직 모르는 동안에는 상한으로 막지 않는다 — 모양만 본다. */
  if (limits === null) return undefined;

  if (parsed > limits.lotQty || parsed > limits.remainingQty) {
    return t.overLimit(formatQty(limits.lotQty), formatQty(limits.remainingQty));
  }

  return undefined;
};

/** 검증을 통과한 수만 수로 바꾼다 — 통과하지 못하면 본문이 만들어지지 않는다. */
export const toQuantity = (raw: string, limits: QuantityLimits | null): number | undefined =>
  quantityError(raw, limits) === undefined ? Number(raw.trim()) : undefined;
