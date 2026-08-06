import { describe, expect, it } from 'vitest';

import type { CodeValueFormValues } from './code-value-types';
import { CODE_VALUE_FORM_FIELDS, validateCodeValueForm } from './code-value-validation';

const values = (overrides: Partial<CodeValueFormValues> = {}): CodeValueFormValues => ({
  code: 'SYN-CV-01',
  codeName: '합성 코드값 A',
  displayOrder: '10',
  effectiveFrom: '',
  effectiveTo: '',
  ...overrides,
});

describe('CODE_VALUE_FORM_FIELDS', () => {
  it('폼이 소유한 입력칸 이름을 계약 이름 그대로 담는다', () => {
    expect(CODE_VALUE_FORM_FIELDS).toEqual([
      'code',
      'codeName',
      'displayOrder',
      'effectiveFrom',
      'effectiveTo',
    ]);
  });
});

describe('validateCodeValueForm — 필수와 길이', () => {
  it('제대로 채우면 오류가 없다', () => {
    expect(validateCodeValueForm(values())).toEqual({});
  });

  it('필수 항목이 비면 막는다', () => {
    const errors = validateCodeValueForm(values({ code: '', codeName: '', displayOrder: '' }));

    expect(errors.code).toBe('필수 입력 항목입니다.');
    expect(errors.codeName).toBe('필수 입력 항목입니다.');
    expect(errors.displayOrder).toBe('필수 입력 항목입니다.');
  });

  it('공백만 넣은 필수 항목도 막는다', () => {
    const errors = validateCodeValueForm(values({ code: '  ', codeName: '\t' }));

    expect(errors.code).toBe('코드는 공백만으로 지정할 수 없습니다.');
    expect(errors.codeName).toBe('코드명은 공백만으로 지정할 수 없습니다.');
  });

  it('길이 상한을 넘으면 막고, 상한 자체는 허용한다', () => {
    expect(validateCodeValueForm(values({ code: 'A'.repeat(51) })).code).toBe(
      '코드는 50자를 넘을 수 없습니다.',
    );
    expect(validateCodeValueForm(values({ code: 'A'.repeat(50) })).code).toBeUndefined();
    expect(validateCodeValueForm(values({ codeName: '가'.repeat(201) })).codeName).toBe(
      '코드명은 200자를 넘을 수 없습니다.',
    );
    expect(validateCodeValueForm(values({ codeName: '가'.repeat(200) })).codeName).toBeUndefined();
  });
});

describe('validateCodeValueForm — 정렬 순서 (C34)', () => {
  it('정수가 아니면 막는다', () => {
    expect(validateCodeValueForm(values({ displayOrder: '1.5' })).displayOrder).toBe(
      '정렬 순서는 정수로 입력하세요.',
    );
    expect(validateCodeValueForm(values({ displayOrder: 'abc' })).displayOrder).toBe(
      '정렬 순서는 정수로 입력하세요.',
    );
    expect(validateCodeValueForm(values({ displayOrder: ' ' })).displayOrder).toBe(
      '정렬 순서는 정수로 입력하세요.',
    );
  });

  /* 계약에 하한이 없다 — 화면이 서버가 허용한 값을 막으면 안 된다. */
  it('음수와 0은 막지 않는다', () => {
    expect(validateCodeValueForm(values({ displayOrder: '-5' })).displayOrder).toBeUndefined();
    expect(validateCodeValueForm(values({ displayOrder: '0' })).displayOrder).toBeUndefined();
  });
});

describe('validateCodeValueForm — 유효기간 (C35)', () => {
  /* 계약 ck_code_value_dates — 있으면 유효 시작 이상. 두 칸이 함께 어긋난다. */
  it('유효 종료가 유효 시작보다 앞이면 두 칸 모두에 오류가 뜬다', () => {
    const errors = validateCodeValueForm(
      values({ effectiveFrom: '2026-08-10', effectiveTo: '2026-08-01' }),
    );

    expect(errors.effectiveFrom).toBe('유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.');
    expect(errors.effectiveTo).toBe('유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.');
  });

  it('같은 날은 허용한다 — 계약이 「같거나 그 뒤」를 허용한다', () => {
    expect(
      validateCodeValueForm(values({ effectiveFrom: '2026-08-01', effectiveTo: '2026-08-01' })),
    ).toEqual({});
  });

  /* 계약이 한쪽만 있는 것을 허용한다 — 막으면 서버가 받는 값을 화면이 거부하게 된다. */
  it('한쪽만 있으면 막지 않는다', () => {
    expect(validateCodeValueForm(values({ effectiveFrom: '2026-08-01' }))).toEqual({});
    expect(validateCodeValueForm(values({ effectiveTo: '2026-08-01' }))).toEqual({});
  });

  it('둘 다 없으면 막지 않는다', () => {
    expect(validateCodeValueForm(values())).toEqual({});
  });
});

describe('validateCodeValueForm — 화면이 판정하지 않는 것', () => {
  /* 그룹 내 유일 제약은 서버 몫이다 — 화면이 흉내 내면 서버와 다른 답을 낸다. */
  it('그룹 안의 코드 중복을 화면이 판정하지 않는다', () => {
    expect(validateCodeValueForm(values({ code: 'SYN-CV-01' }))).toEqual({});
  });
});
