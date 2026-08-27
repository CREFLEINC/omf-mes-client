import { messages } from '@omf-mes/i18n';

export interface IssueFormValue {
  /** 고른 품목의 식별자. 고르지 않았으면 빈 글자다. */
  itemId: string;
  /** 입력 그대로의 글자. 숫자로 바꾸는 것은 검증을 통과한 뒤다. */
  orderQty: string;
  /** `YYYY-MM-DDTHH:mm` — 비울 수 있다. */
  plannedEndAtLocal: string;
  /** 발행 사유. */
  remarks: string;
}

export interface IssueFormErrors {
  itemId?: string;
  orderQty?: string;
  plannedEndAtLocal?: string;
  remarks?: string;
}

export const EMPTY_ISSUE_FORM: IssueFormValue = {
  itemId: '',
  orderQty: '',
  plannedEndAtLocal: '',
  remarks: '',
};

/**
 * 받는 수의 모양.
 *
 * ⚠ **자릿수 상한이 있어야 한다.** 열어 두면 아주 긴 수가 지수 표기로 바뀌어 전선에 실리고,
 * 안전 정수를 넘는 수는 **사용자가 친 수와 다른 값으로 말없이 바뀐다.** 지시 수량은 발행되면
 * 되돌리기 어려운 값이라 특히 그렇다.
 */
const DECIMAL = /^\d{1,12}(\.\d{1,6})?$/;

const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/**
 * 달력에 있는 시각인가.
 *
 * 모양만 보면 `2026-02-30`·`2026-08-06T25:00` 이 통과한다. 만들어 본 뒤 **같은 글자로 되돌아
 * 오는지**로 판정한다 — 없는 날짜는 다음 달로 넘어가면서 글자가 달라진다. 윤년 표를 손으로
 * 들고 있지 않아도 되고, 표를 잘못 옮겨 적을 자리도 없다.
 */
const isValidLocalDateTime = (value: string): boolean => {
  if (!LOCAL_DATE_TIME.test(value)) return false;

  const at = new Date(`${value}:00Z`);
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 16) === value;
};

/**
 * 발행 입력 검증.
 *
 * ⭐ **사유를 화면이 막는다.** 계약은 사유를 필수로 두지 않았고 담을 전용 칸도 없다 —
 * 그런데도 막는 이유는 이 화면에 **승인 절차가 없어서**다(02-S-D 확정). 승인이 없으면 사유
 * 기록이 유일한 통제고, 스펙 §5-6이 「화면 규칙으로 필수」라고 명시했다. 계약이 허락하는 것을
 * 화면이 대신 거절하는 다른 자리들과 성격이 다르다 — 이것은 지어낸 규칙이 아니라 받은 규칙이다.
 *
 * ⭐ **납기는 막지 않는다.** 스펙 §5-6의 발행 활성 조건이 「품목·수량·사유」 셋이고 계약도
 * 필수로 두지 않았다. 형태만 본다 — 지난 날짜인지는 보지 않는다. 긴급 발행에 지난 납기를
 * 넣는 것이 이상해 보여도, 막으라고 정해 준 곳이 없는 규칙을 화면이 만들지 않는다.
 */
export const validateIssueForm = (value: IssueFormValue): IssueFormErrors => {
  const t = messages.emergencyWorkOrder.form;
  const errors: IssueFormErrors = {};
  const qty = value.orderQty.trim();
  const due = value.plannedEndAtLocal.trim();

  if (value.itemId.trim() === '') errors.itemId = t.itemRequired;

  if (qty === '') errors.orderQty = t.qtyRequired;
  else if (/^\d+(\.\d+)?$/.test(qty) && !DECIMAL.test(qty)) errors.orderQty = t.qtyTooLong;
  else if (!DECIMAL.test(qty)) errors.orderQty = t.qtyNotNumber;
  else if (Number(qty) <= 0) errors.orderQty = t.qtyNotPositive;

  if (due !== '' && !isValidLocalDateTime(due)) errors.plannedEndAtLocal = t.dueInvalid;

  if (value.remarks.trim() === '') errors.remarks = t.reasonRequired;

  return errors;
};

/**
 * 입력이 발행할 만큼 갖춰졌는가.
 *
 * 칸 이름을 다시 늘어놓지 않고 검증 결과를 그대로 본다 — 칸이 늘 때 이 함수가 조용히
 * 뒤처져 「오류가 있는데 발행이 열려 있다」가 되는 것을 막는다.
 */
export const isIssueInputComplete = (value: IssueFormValue): boolean =>
  Object.keys(validateIssueForm(value)).length === 0;
