import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_DECISION_FORM,
  hasBlockingError,
  hasDecisionInput,
  overRemainingWarning,
  toDecisionCreateBody,
  validateDecisionForm,
  type DecisionFormValue,
} from './decision-form';
import type { RemainingQty } from './remaining-qty';

const t = messages.dispositionDecision.form;
/** ⚠ 지어낸 자리표시다 — 처분 유형의 실제 값 목록은 아직 확정되지 않았다. */
const CODE = 'CODE-A';

const form = (overrides: Partial<DecisionFormValue> = {}): DecisionFormValue => ({
  dispositionTypeCode: CODE,
  qty: '120',
  reason: '표면만 손상돼 재작업으로 회복된다',
  ...overrides,
});

const remaining = (value: number | undefined): RemainingQty => ({
  value,
  text: value === undefined ? '—' : String(value),
  isSettled: value !== undefined && value <= 0,
});

describe('hasDecisionInput', () => {
  it('빈 폼에는 입력이 없다', () => {
    expect(hasDecisionInput(EMPTY_DECISION_FORM)).toBe(false);
  });

  it('한 칸이라도 채우면 입력이 있다', () => {
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, reason: '가' })).toBe(true);
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, qty: '1' })).toBe(true);
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, dispositionTypeCode: CODE })).toBe(true);
  });

  it('공백만 넣은 것은 입력이 아니다', () => {
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, reason: '   ' })).toBe(false);
  });
});

describe('validateDecisionForm', () => {
  it('다 채운 폼에는 오류가 없다', () => {
    expect(validateDecisionForm(form())).toEqual({});
  });

  it('처분을 고르지 않으면 막는다', () => {
    expect(validateDecisionForm(form({ dispositionTypeCode: '' })).dispositionTypeCode).toBe(
      t.dispositionRequired,
    );
  });

  it('수량이 비면 막는다', () => {
    expect(validateDecisionForm(form({ qty: '   ' })).decisionQty).toBe(t.qtyRequired);
  });

  it('숫자가 아니면 막는다', () => {
    expect(validateDecisionForm(form({ qty: '십이' })).decisionQty).toBe(t.qtyNotNumber);
    expect(validateDecisionForm(form({ qty: '1e3' })).decisionQty).toBe(t.qtyNotNumber);
  });

  it('음수와 0을 막는다 — 계약이 1 이상을 요구한다', () => {
    expect(validateDecisionForm(form({ qty: '-5' })).decisionQty).toBe(t.qtyNotNumber);
    expect(validateDecisionForm(form({ qty: '0' })).decisionQty).toBe(t.qtyTooSmall);
    expect(validateDecisionForm(form({ qty: '0.5' })).decisionQty).toBe(t.qtyTooSmall);
  });

  it('1은 통과한다 — 경계값이다', () => {
    expect(validateDecisionForm(form({ qty: '1' })).decisionQty).toBeUndefined();
  });

  it('사유가 공백뿐이면 막는다 — 계약이 비울 수 없다고 정한다', () => {
    expect(validateDecisionForm(form({ reason: '   ' })).reason).toBe(t.reasonRequired);
  });
});

describe('overRemainingWarning', () => {
  it('남은 수량을 넘기면 경고를 낸다', () => {
    expect(overRemainingWarning(form({ qty: '200' }), remaining(120))).toBe(
      t.qtyOverRemaining('120'),
    );
  });

  it('남은 수량과 같으면 경고하지 않는다 — 경계는 허용이다', () => {
    expect(overRemainingWarning(form({ qty: '120' }), remaining(120))).toBeUndefined();
  });

  it('남은 수량을 낼 수 없으면 경고하지 않는다 — 모르는 것으로 겁주지 않는다', () => {
    expect(overRemainingWarning(form({ qty: '999' }), remaining(undefined))).toBeUndefined();
  });

  it('수량이 숫자가 아니면 경고 대신 검증이 답한다', () => {
    expect(overRemainingWarning(form({ qty: '십이' }), remaining(120))).toBeUndefined();
  });
});

describe('hasBlockingError', () => {
  it('오류가 없으면 막지 않는다', () => {
    expect(hasBlockingError({})).toBe(false);
  });

  it('오류가 하나라도 있으면 막는다', () => {
    expect(hasBlockingError({ reason: t.reasonRequired })).toBe(true);
  });
});

describe('toDecisionCreateBody', () => {
  it('보낼 본문을 만든다 — 수량을 숫자로 바꾸고 사유의 앞뒤 공백을 지운다', () => {
    expect(toDecisionCreateBody(form({ reason: '  사유  ' }), 7001)).toEqual({
      dispositionTypeCode: CODE,
      decisionQty: 120,
      uomId: 7001,
      reason: '사유',
    });
  });

  it('⛔ 판정자·판정 시각을 싣지 않는다 — 서버가 채운다', () => {
    const body = toDecisionCreateBody(form(), 7001);

    expect(body).not.toHaveProperty('decidedBy');
    expect(body).not.toHaveProperty('decidedAt');
  });
});
