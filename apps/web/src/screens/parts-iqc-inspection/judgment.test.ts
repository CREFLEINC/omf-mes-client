import { describe, expect, it } from 'vitest';

import { historyReducer, numberOf, startHistory, emptyForm, withValue } from './form-state';
import {
  judgeDimension,
  judgeValue,
  kindOf,
  rejectedQtyOf,
  serverExpectedOf,
  suggestedJudgmentOf,
  type JudgmentInput,
} from './judgment';

const spec = (over: Record<string, unknown>) =>
  ({
    inspectionItemSpecId: 1,
    inspectionPlanVersionId: 1,
    sequenceNo: 1,
    inspectionItemCode: 'DIM-01',
    inspectionItemName: 'Kích thước ① 6.76±0.10',
    dataTypeCode: 'NUMERIC',
    measurementCount: 5,
    requiredFlag: true,
    automaticJudgment: true,
    lowerLimit: 6.66,
    upperLimit: 6.86,
    ...over,
  }) as never;

const base: JudgmentInput = {
  inspectedQty: 5,
  dimensions: [{ judgment: 'ACCEPTED', outCount: 0 }],
  checks: [],
};

describe('부품 IQC 판정 (omf-all-around#211)', () => {
  it('항목 갈래는 검사 유형만 본다 — 수치는 치수 측정, 선택형 · 텍스트는 기타 검사 항목(#247)', () => {
    expect(kindOf(spec({}))).toBe('dimension');
    expect(kindOf(spec({ dataTypeCode: 'BOOLEAN', inspectionItemName: 'RoHS Phù hợp' }))).toBe(
      'check',
    );
    expect(
      kindOf(
        spec({
          dataTypeCode: 'BOOLEAN',
          inspectionItemName: 'Bề ngoài',
          inspectionMethodCode: 'VISUAL',
        }),
      ),
    ).toBe('check');
    expect(kindOf(spec({ dataTypeCode: 'TEXT', inspectionItemName: '색상' }))).toBe('check');
  });

  it('값은 하한·상한 안이면 합격, 경계값도 합격이다', () => {
    expect(judgeValue(6.66, spec({}))).toBe('ACCEPTED');
    expect(judgeValue(6.87, spec({}))).toBe('REJECTED');
    expect(judgeValue(null, spec({}))).toBeNull();
  });

  it('⭐ 치수 항목은 벗어난 시료 수가 항목의 c 이하이면 합격 — 항목에 c 가 없으면 버전 기준', () => {
    const values = [6.7, 6.9, 6.7, 6.7, 6.7];
    expect(judgeDimension(values, spec({ acceptanceNumber: 1 }), 0)).toEqual({
      judgment: 'ACCEPTED',
      outCount: 1,
    });
    expect(judgeDimension(values, spec({ acceptanceNumber: 0 }), 1)).toEqual({
      judgment: 'REJECTED',
      outCount: 1,
    });
    expect(judgeDimension(values, spec({ acceptanceNumber: null }), 1).judgment).toBe('ACCEPTED');
    expect(judgeDimension([6.7, null, 6.7, 6.7, 6.7], spec({}), 0).judgment).toBeNull();
  });

  it('하나라도 NG 면 불합격, 덜 적었으면 판정을 내지 않는다', () => {
    expect(suggestedJudgmentOf(base)).toBe('ACCEPTED');
    expect(suggestedJudgmentOf({ ...base, checks: ['REJECTED'] })).toBe('REJECTED');
    expect(suggestedJudgmentOf({ ...base, checks: [null] })).toBeNull();
    /* 필수 항목만 다 적으면 판정한다 — 선택 항목은 비어 있어도 된다(#247). */
    expect(
      suggestedJudgmentOf({
        ...base,
        checks: [null],
        requiredDimensions: [true],
        requiredChecks: [false],
      }),
    ).toBe('ACCEPTED');
    expect(
      suggestedJudgmentOf({
        ...base,
        dimensions: [{ judgment: null, outCount: 0 }],
        checks: ['ACCEPTED'],
        requiredDimensions: [true],
        requiredChecks: [false],
      }),
    ).toBeNull();
    expect(
      suggestedJudgmentOf({ ...base, dimensions: [{ judgment: null, outCount: 0 }] }),
    ).toBeNull();
    expect(suggestedJudgmentOf({ ...base, inspectedQty: null })).toBeNull();
  });

  it('불합격 수량은 불합격 치수의 벗어난 시료 + NG 항목이고 검사 수량을 넘지 않는다', () => {
    const input: JudgmentInput = {
      ...base,
      dimensions: [
        { judgment: 'REJECTED', outCount: 2 },
        { judgment: 'ACCEPTED', outCount: 1 },
      ],
      checks: ['REJECTED', 'ACCEPTED'],
    };
    expect(rejectedQtyOf(input)).toBe(3);
    expect(rejectedQtyOf({ ...input, inspectedQty: 100 })).toBe(3);
    expect(rejectedQtyOf({ ...input, inspectedQty: 2 })).toBe(2);
  });

  it('서버가 기대하는 판정 — 버전 합격판정개수가 없으면 재지 않는다', () => {
    expect(serverExpectedOf(1, 0)).toBe('REJECTED');
    expect(serverExpectedOf(0, 0)).toBe('ACCEPTED');
    expect(serverExpectedOf(3, null)).toBeNull();
  });
});

describe('입력 되돌리기·다시 실행', () => {
  it('되돌리면 앞 값, 다시 실행하면 뒤 값 — 되돌린 뒤 새로 고치면 다시 실행할 칸이 사라진다', () => {
    const first = emptyForm('2026-10-29T00:00:00.000Z');
    const second = withValue(first, 1, 0, '6.7');
    const third = withValue(second, 1, 1, '6.8');
    let state = historyReducer(startHistory(first), { type: 'change', next: second });
    state = historyReducer(state, { type: 'change', next: third });
    state = historyReducer(state, { type: 'undo' });
    expect(state.present).toBe(second);
    state = historyReducer(state, { type: 'redo' });
    expect(state.present).toBe(third);
    state = historyReducer(state, { type: 'undo' });
    state = historyReducer(state, { type: 'change', next: withValue(second, 1, 1, '6.9') });
    expect(state.future).toEqual([]);
  });

  it('숫자로 읽을 수 있는 글자만 값이다', () => {
    expect(numberOf('6.76')).toBe(6.76);
    expect(numberOf('-0.05')).toBe(-0.05);
    expect(numberOf('1.')).toBeNull();
    expect(numberOf('')).toBeNull();
  });
});

describe('치수 줄의 형편 (참고: omf-dx-vina 수입검사)', () => {
  it('벗어난 시료가 c 를 넘으면 덜 적었어도 규격 밖 · 안 적었으면 미입력 · 덜 적으면 덜 적음 · 다 적으면 완료', async () => {
    const { rowStateOf } = await import('./measurement-table');
    expect(rowStateOf(2, 5, 1, 0)).toBe('err');
    expect(rowStateOf(2, 5, 1, 1)).toBe('wait');
    expect(rowStateOf(0, 5, 0, 0)).toBe('empty');
    expect(rowStateOf(5, 5, 1, 1)).toBe('done');
  });
});
