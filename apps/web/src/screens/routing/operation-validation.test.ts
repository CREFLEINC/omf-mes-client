import { describe, expect, it } from 'vitest';

import { createOperationDraft } from './operation-order';
import { hasIncompleteDraft, validateOperationDraft } from './operation-validation';
import type { OperationDraft } from './types';

/** 통과하는 한 벌에서 한 칸씩 무너뜨려 무엇이 걸리는지 본다. */
const validDraft = (overrides: Partial<OperationDraft> = {}): OperationDraft => ({
  ...createOperationDraft(),
  processId: '9001',
  operationName: '1차 사출',
  standardCycleTimeSec: '45',
  standardYieldRate: '0.98',
  ...overrides,
});

describe('validateOperationDraft', () => {
  it('제대로 채운 값은 통과한다', () => {
    expect(validateOperationDraft(validDraft())).toEqual({});
  });

  it('공정을 고르지 않으면 걸린다', () => {
    expect(validateOperationDraft(validDraft({ processId: '' })).processId).toBe(
      '필수 입력 항목입니다.',
    );
  });

  it('공정명이 비면 걸린다', () => {
    expect(validateOperationDraft(validDraft({ operationName: '' })).operationName).toBe(
      '필수 입력 항목입니다.',
    );
  });

  /** 공백만으로 지은 이름은 목록에서 빈 칸으로 보여 어느 공정인지 알 수 없게 된다. */
  it('공정명이 공백만이면 필수와 다른 사유로 걸린다', () => {
    expect(validateOperationDraft(validDraft({ operationName: '   ' })).operationName).toBe(
      '공정명은 공백만으로 지정할 수 없습니다.',
    );
  });

  /** 계약이 표준 C/T에 CHECK > 0을 걸었다 — 0은 「없음」이 아니라 위반이다. */
  it('표준 C/T가 0이면 걸린다', () => {
    expect(validateOperationDraft(validDraft({ standardCycleTimeSec: '0' })).standardCycleTimeSec)
      .toBe('표준 C/T는 0보다 큰 초 단위 숫자여야 합니다.');
  });

  it('표준 C/T가 음수거나 숫자가 아니면 걸린다', () => {
    expect(
      validateOperationDraft(validDraft({ standardCycleTimeSec: '-1' })).standardCycleTimeSec,
    ).toBeDefined();
    expect(
      validateOperationDraft(validDraft({ standardCycleTimeSec: 'abc' })).standardCycleTimeSec,
    ).toBeDefined();
  });

  /*
   * 퍼센트로 보이면서 비율로 저장하면 100배 오입력이 조용히 통과한다.
   * 화면은 비율만 받고, 퍼센트로 들어온 값은 여기서 막는다.
   */
  it('표준 수율이 1을 넘으면 걸린다 — 퍼센트 입력을 막는다', () => {
    expect(validateOperationDraft(validDraft({ standardYieldRate: '98' })).standardYieldRate).toBe(
      '표준 수율은 0과 1 사이의 비율이어야 합니다. 퍼센트가 아닙니다.',
    );
  });

  it('표준 수율이 음수면 걸리고 경계값 0·1은 통과한다', () => {
    expect(
      validateOperationDraft(validDraft({ standardYieldRate: '-0.1' })).standardYieldRate,
    ).toBeDefined();
    expect(validateOperationDraft(validDraft({ standardYieldRate: '0' }))).toEqual({});
    expect(validateOperationDraft(validDraft({ standardYieldRate: '1' }))).toEqual({});
  });

  /** 빈 값은 「지정하지 않음」이며 계약이 널을 허용한다 — 0과 다르다. */
  it('표준 C/T와 표준 수율은 비워 둘 수 있다', () => {
    expect(
      validateOperationDraft(validDraft({ standardCycleTimeSec: '', standardYieldRate: '' })),
    ).toEqual({});
  });

  it('여러 칸이 함께 걸리면 모두 돌려준다', () => {
    const errors = validateOperationDraft(
      validDraft({ processId: '', operationName: '', standardYieldRate: '2' }),
    );

    expect(Object.keys(errors).sort()).toEqual([
      'operationName',
      'processId',
      'standardYieldRate',
    ]);
  });
});

describe('hasIncompleteDraft', () => {
  it('한 행이라도 걸리면 참이다', () => {
    expect(hasIncompleteDraft([validDraft(), validDraft({ operationName: '' })])).toBe(true);
  });

  it('전부 통과하면 거짓이고 빈 목록도 거짓이다', () => {
    expect(hasIncompleteDraft([validDraft(), validDraft()])).toBe(false);
    expect(hasIncompleteDraft([])).toBe(false);
  });
});
