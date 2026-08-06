import { describe, expect, it } from 'vitest';

import { validatePlanForm } from './plan-validation';
import type { PlanFormValues } from './types';

const values = (overrides: Partial<PlanFormValues> = {}): PlanFormValues => ({
  inspectionPlanCode: 'SYN-PLAN-01',
  inspectionPlanName: '합성 검사기준 A',
  inspectionTypeCode: 'IQC',
  itemId: '',
  processId: '',
  routingId: '',
  ...overrides,
});

describe('validatePlanForm', () => {
  it('필수를 모두 채우면 오류가 없다', () => {
    expect(validatePlanForm(values())).toEqual({});
  });

  it('기준코드·기준명·검사 유형이 비면 각각 필수 오류를 낸다', () => {
    const errors = validatePlanForm(
      values({ inspectionPlanCode: '', inspectionPlanName: '', inspectionTypeCode: '' }),
    );

    expect(errors.inspectionPlanCode).toBe('필수 입력 항목입니다.');
    expect(errors.inspectionPlanName).toBe('필수 입력 항목입니다.');
    expect(errors.inspectionTypeCode).toBe('필수 입력 항목입니다.');
  });

  /* 앞뒤 공백만 있는 값은 눈으로 구분되지 않는 다른 값이 된다. */
  it('공백만 넣은 기준코드·기준명은 거부한다', () => {
    expect(validatePlanForm(values({ inspectionPlanCode: '   ' })).inspectionPlanCode).toBe(
      '기준코드는 공백만으로 지정할 수 없습니다.',
    );
    expect(validatePlanForm(values({ inspectionPlanName: '  ' })).inspectionPlanName).toBe(
      '기준명은 공백만으로 지정할 수 없습니다.',
    );
  });

  /*
   * 품목·공정·라우팅은 계약이 널을 허용한다 — 「전 품목 공통 기준」이 정상 값이고
   * IQC 에는 공정이 없다. 화면이 필수로 막으면 계약이 허용한 자료를 만들 수 없다.
   */
  it('품목·공정·라우팅은 비어 있어도 통과한다', () => {
    expect(validatePlanForm(values({ itemId: '', processId: '', routingId: '' }))).toEqual({});
  });

  /*
   * 코드 중복은 검사하지 않는다 — 계약이 그 판정을 서버 몫(uq, 400)으로 두었고
   * 화면이 흉내 내면 서버와 다른 답을 낸다.
   */
  it('코드 중복을 화면에서 판정하지 않는다', () => {
    expect(validatePlanForm(values({ inspectionPlanCode: 'STANDARD' }))).toEqual({});
  });
});
