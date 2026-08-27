import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_DECISION_FORM,
  hasBlockingError,
  hasDecisionInput,
  remainingNotice,
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

  it('공백만 넣은 것은 입력이 아니다 — 어느 칸이든 같다', () => {
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, reason: '   ' })).toBe(false);
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, qty: '   ' })).toBe(false);
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, dispositionTypeCode: '  ' })).toBe(false);
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
    expect(validateDecisionForm(form({ qty: '+12' })).decisionQty).toBe(t.qtyNotNumber);
    expect(validateDecisionForm(form({ qty: '12.' })).decisionQty).toBe(t.qtyNotNumber);
    expect(validateDecisionForm(form({ qty: '.5' })).decisionQty).toBe(t.qtyNotNumber);
    expect(validateDecisionForm(form({ qty: '１２' })).decisionQty).toBe(t.qtyNotNumber);
  });

  it('⛔ 너무 긴 수를 막는다 — 열어 두면 지수 표기가 되어 전선에 실린다', () => {
    expect(validateDecisionForm(form({ qty: '999999999999999999999' })).decisionQty).toBe(
      t.qtyTooLong,
    );
  });

  it('⛔ 정밀도를 잃는 정수를 막는다 — 사용자가 친 수와 다른 값이 기록되지 않게 한다', () => {
    expect(validateDecisionForm(form({ qty: '9007199254740993' })).decisionQty).toBe(t.qtyTooLong);
  });

  it('소수 여섯 자리를 넘기면 막는다 — 보이는 자릿수와 맞춘다', () => {
    expect(validateDecisionForm(form({ qty: '1.1234567' })).decisionQty).toBe(t.qtyTooLong);
    expect(validateDecisionForm(form({ qty: '1.123456' })).decisionQty).toBeUndefined();
  });

  it('현실적인 수량은 전부 통과한다', () => {
    expect(validateDecisionForm(form({ qty: '999999999999' })).decisionQty).toBeUndefined();
    expect(validateDecisionForm(form({ qty: '1' })).decisionQty).toBeUndefined();
  });

  it('0과 음수를 막는다', () => {
    expect(validateDecisionForm(form({ qty: '-5' })).decisionQty).toBe(t.qtyNotNumber);
    expect(validateDecisionForm(form({ qty: '0' })).decisionQty).toBe(t.qtyTooSmall);
    expect(validateDecisionForm(form({ qty: '0.0' })).decisionQty).toBe(t.qtyTooSmall);
  });

  it('⭐ 1 미만의 소수 부분 처분을 막지 않는다 — 물리 제약은 「0 초과」다', () => {
    expect(validateDecisionForm(form({ qty: '0.5' })).decisionQty).toBeUndefined();
  });

  it('사유가 공백뿐이면 막는다 — 계약이 비울 수 없다고 정한다', () => {
    expect(validateDecisionForm(form({ reason: '   ' })).reason).toBe(t.reasonRequired);
  });

  it('⭐ 남은 수량을 넘겨도 막지 않는다 — 잔량 판정은 서버 몫이다', () => {
    expect(validateDecisionForm(form({ qty: '999999' })).decisionQty).toBeUndefined();
  });
});

describe('remainingNotice', () => {
  it('남은 수량을 넘기면 예고한다', () => {
    expect(remainingNotice(form({ qty: '200' }), remaining(120))).toBe(t.qtyOverRemaining('120'));
  });

  it('⚠ 예고는 명령이 아니다 — 「입력하세요」로 끝나지 않는다', () => {
    expect(t.qtyOverRemaining('120')).not.toContain('입력하세요');
    expect(t.qtySettledNotice).not.toContain('입력하세요');
  });

  it('남은 수량과 같으면 예고하지 않는다 — 경계는 허용이다', () => {
    expect(remainingNotice(form({ qty: '120' }), remaining(120))).toBeUndefined();
  });

  it('⭐ 남은 수량이 0이면 막지 않고 예고한다 — 같은 참고값을 다르게 다루지 않는다', () => {
    expect(remainingNotice(form({ qty: '10' }), remaining(0))).toBe(t.qtySettledNotice);
    expect(validateDecisionForm(form({ qty: '10' })).decisionQty).toBeUndefined();
  });

  it('남은 수량을 낼 수 없으면 예고하지 않는다 — 모르는 것으로 겁주지 않는다', () => {
    expect(remainingNotice(form({ qty: '999' }), remaining(undefined))).toBeUndefined();
  });

  it('수량이 받는 모양이 아니면 예고 대신 검증이 답한다', () => {
    expect(remainingNotice(form({ qty: '1e3' }), remaining(120))).toBeUndefined();
    expect(remainingNotice(form({ qty: '999999999999999999999' }), remaining(120))).toBeUndefined();
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

  it('⛔ 검증을 통과하지 못한 폼은 본문을 만들지 않는다', () => {
    expect(toDecisionCreateBody(form({ qty: '' }), 7001)).toBeUndefined();
    expect(toDecisionCreateBody(form({ qty: '십이' }), 7001)).toBeUndefined();
    expect(toDecisionCreateBody(form({ reason: '  ' }), 7001)).toBeUndefined();
    expect(toDecisionCreateBody(form({ dispositionTypeCode: '' }), 7001)).toBeUndefined();
  });

  it('⛔ 직렬화했을 때 수량이 0이나 null이 되지 않는다', () => {
    for (const qty of ['', '   ', '십이', '0', '-5', '999999999999999999999']) {
      const body = toDecisionCreateBody(form({ qty }), 7001);

      expect(body).toBeUndefined();
      expect(JSON.stringify(body ?? {})).not.toContain('"decisionQty"');
    }
  });

  it('남은 수량을 넘긴 수량은 본문을 만든다 — 판정은 서버가 한다', () => {
    expect(toDecisionCreateBody(form({ qty: '999999' }), 7001)?.decisionQty).toBe(999999);
  });
});
