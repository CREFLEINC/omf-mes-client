import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_DECISION_FORM,
  hasBlockingError,
  hasDecisionInput,
  toDecisionCreateBody,
  validateDecisionForm,
  type DecisionFormContext,
  type DecisionFormValue,
} from './decision-form';

const t = messages.dispositionDecision.form;
const s = messages.dispositionDecision.sort;
/** ⚠ 지어낸 자리표시다 — 처분 유형의 실제 값 목록은 아직 확정되지 않았다. */
const CODE = 'REWORK';
/** 005 FR-038 — 처분 수량은 남은 수량 전부로 고정한다(입력 없음). */
const CONTEXT: DecisionFormContext = { remainingQty: 120, lotCount: 3 };

const form = (overrides: Partial<DecisionFormValue> = {}): DecisionFormValue => ({
  ...EMPTY_DECISION_FORM,
  dispositionTypeCode: CODE,
  reason: '표면만 손상돼 재작업으로 회복된다',
  ...overrides,
});

describe('hasDecisionInput', () => {
  it('빈 폼에는 입력이 없다', () => {
    expect(hasDecisionInput(EMPTY_DECISION_FORM)).toBe(false);
  });

  it('한 칸이라도 채우면 입력이 있다', () => {
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, reason: '가' })).toBe(true);
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, dispositionTypeCode: CODE })).toBe(true);
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, sortLotIds: [1] })).toBe(true);
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, goodQty: '1' })).toBe(true);
  });

  it('공백만 넣은 것은 입력이 아니다 — 어느 칸이든 같다', () => {
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, reason: '   ' })).toBe(false);
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, defectQty: '   ' })).toBe(false);
    expect(hasDecisionInput({ ...EMPTY_DECISION_FORM, dispositionTypeCode: '  ' })).toBe(false);
  });
});

describe('validateDecisionForm', () => {
  it('다 채운 폼에는 오류가 없다', () => {
    expect(validateDecisionForm(form(), CONTEXT)).toEqual({});
  });

  it('처분을 고르지 않으면 막는다', () => {
    expect(
      validateDecisionForm(form({ dispositionTypeCode: '' }), CONTEXT).dispositionTypeCode,
    ).toBe(t.dispositionRequired);
  });

  it('사유가 공백뿐이면 막는다 — 계약이 비울 수 없다고 정한다', () => {
    expect(validateDecisionForm(form({ reason: '   ' }), CONTEXT).reason).toBe(t.reasonRequired);
  });

  it('남은 수량을 아직 모르면 막는다 — 보낼 수량(남은 수량 전부)을 정할 수 없다', () => {
    expect(validateDecisionForm(form(), { ...CONTEXT, remainingQty: undefined }).decisionQty).toBe(
      t.remainingUnknown,
    );
  });

  it('남은 수량이 없으면 막는다 — 더 판정할 것이 없다', () => {
    expect(validateDecisionForm(form(), { ...CONTEXT, remainingQty: 0 }).decisionQty).toBe(
      t.typeLock.closed,
    );
  });
});

/* 005 — 선별은 수량이 아니라 불량 자재 관리 LOT 고르기다(옛 양품 · 불량 수량 분할은 없어졌다 · FR-038). */
describe('validateDecisionForm — 선별', () => {
  const sort = (overrides: Partial<DecisionFormValue> = {}) =>
    form({ dispositionTypeCode: 'SORT', sortLotIds: [3], ...overrides });

  it('일부 LOT 을 고르면 통과한다 — 남은 수량을 몰라도 된다', () => {
    expect(validateDecisionForm(sort(), { ...CONTEXT, remainingQty: undefined })).toEqual({});
  });

  it('하나도 고르지 않으면 막는다', () => {
    expect(validateDecisionForm(sort({ sortLotIds: [] }), CONTEXT).lotIds).toBe(s.noneSelected);
  });

  it('전부 고르면 막는다 — 원래 입하 LOT 에 하나 이상 남아야 한다', () => {
    expect(validateDecisionForm(sort({ sortLotIds: [1, 2, 3] }), CONTEXT).lotIds).toBe(
      s.allSelected,
    );
  });

  it('정보 수량은 비워도 되고, 넣으면 0 이상의 수여야 한다', () => {
    expect(validateDecisionForm(sort({ goodQty: '0', defectQty: '12.5' }), CONTEXT)).toEqual({});
    expect(validateDecisionForm(sort({ goodQty: '-1' }), CONTEXT).goodQty).toBe(s.qtyInvalid);
    expect(validateDecisionForm(sort({ defectQty: '1e3' }), CONTEXT).defectQty).toBe(s.qtyInvalid);
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
  it('정상 · 폐기 · 재작업은 남은 수량 전부를 그 단위로 싣고 사유의 앞뒤 공백을 지운다', () => {
    expect(toDecisionCreateBody(form({ reason: '  사유  ' }), 7001, CONTEXT)).toEqual({
      dispositionTypeCode: CODE,
      decisionQty: 120,
      uomId: 7001,
      reason: '사유',
    });
  });

  it('⛔ 판정자·판정 시각을 싣지 않는다 — 서버가 채운다', () => {
    const body = toDecisionCreateBody(form(), 7001, CONTEXT);

    expect(body).not.toHaveProperty('decidedBy');
    expect(body).not.toHaveProperty('decidedAt');
  });

  it('⛔ 검증을 통과하지 못한 폼은 본문을 만들지 않는다', () => {
    expect(toDecisionCreateBody(form({ reason: '  ' }), 7001, CONTEXT)).toBeUndefined();
    expect(toDecisionCreateBody(form({ dispositionTypeCode: '' }), 7001, CONTEXT)).toBeUndefined();
    expect(
      toDecisionCreateBody(form(), 7001, { ...CONTEXT, remainingQty: undefined }),
    ).toBeUndefined();
  });

  it('선별은 고른 LOT 과 넣은 정보 수량만 싣는다 — 수량 · 단위를 싣지 않는다', () => {
    expect(
      toDecisionCreateBody(
        form({ dispositionTypeCode: 'SORT', sortLotIds: [3], defectQty: ' 12 ' }),
        7001,
        CONTEXT,
      ),
    ).toEqual({ dispositionTypeCode: 'SORT', lotIds: [3], defectQty: 12, reason: form().reason });
  });
});
