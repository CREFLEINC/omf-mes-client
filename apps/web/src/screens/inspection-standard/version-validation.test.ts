import { describe, expect, it } from 'vitest';

import type { VersionFormValues } from './types';
import { validateVersionForm } from './version-validation';

const values = (overrides: Partial<VersionFormValues> = {}): VersionFormValues => ({
  effectiveFrom: '2026-08-01',
  effectiveTo: '',
  samplingMethodCode: 'PENDING',
  samplingRatio: '',
  aqlValue: '',
  acceptanceNumber: '',
  rejectionNumber: '',
  inspectionFrequencyCode: 'PENDING',
  frequencyIntervalValue: '',
  frequencyIntervalUomCode: '',
  ...overrides,
});

describe('validateVersionForm — 필수', () => {
  it('필수를 모두 채우면 오류가 없다', () => {
    expect(validateVersionForm(values())).toEqual({});
  });

  it('유효시작·샘플링 방법·검사 주기가 비면 각각 필수 오류를 낸다', () => {
    const errors = validateVersionForm(
      values({ effectiveFrom: '', samplingMethodCode: '', inspectionFrequencyCode: '' }),
    );

    expect(errors.effectiveFrom).toBe('필수 입력 항목입니다.');
    expect(errors.samplingMethodCode).toBe('필수 입력 항목입니다.');
    expect(errors.inspectionFrequencyCode).toBe('필수 입력 항목입니다.');
  });
});

describe('validateVersionForm — 유효기간', () => {
  /* 「지정하지 않음」이 정상 값이다 — 계약이 널을 허용한다. */
  it('유효종료가 비어 있으면 통과한다', () => {
    expect(validateVersionForm(values({ effectiveTo: '' }))).toEqual({});
  });

  it('유효종료가 유효시작과 같으면 통과한다', () => {
    expect(validateVersionForm(values({ effectiveTo: '2026-08-01' }))).toEqual({});
  });

  /* 짝 제약이라 두 칸 모두에 낸다 — 한쪽만 표시하면 어느 쪽을 고쳐야 하는지 알 수 없다. */
  it('유효종료가 유효시작보다 앞서면 두 칸 모두에 오류를 낸다', () => {
    const errors = validateVersionForm(values({ effectiveTo: '2026-07-31' }));

    expect(errors.effectiveFrom).toBe('유효종료는 유효시작과 같거나 그 뒤여야 합니다.');
    expect(errors.effectiveTo).toBe('유효종료는 유효시작과 같거나 그 뒤여야 합니다.');
  });

  it('유효시작이 비어 있으면 비교하지 않고 필수 오류만 남긴다', () => {
    const errors = validateVersionForm(values({ effectiveFrom: '', effectiveTo: '2026-07-31' }));

    expect(errors.effectiveFrom).toBe('필수 입력 항목입니다.');
    expect(errors.effectiveTo).toBeUndefined();
  });
});

describe('validateVersionForm — 주기 짝', () => {
  it('둘 다 비어 있으면 통과한다', () => {
    expect(
      validateVersionForm(values({ frequencyIntervalValue: '', frequencyIntervalUomCode: '' })),
    ).toEqual({});
  });

  it('둘 다 채우면 통과한다', () => {
    expect(
      validateVersionForm(
        values({ frequencyIntervalValue: '4', frequencyIntervalUomCode: 'PENDING' }),
      ),
    ).toEqual({});
  });

  /* 계약이 짝을 요구하나 데이터베이스 CHECK 가 없다 — 화면이 먼저 막는다. */
  it('주기 값만 채우면 두 칸 모두에 오류를 낸다', () => {
    const errors = validateVersionForm(values({ frequencyIntervalValue: '4' }));

    expect(errors.frequencyIntervalValue).toBe('주기 값과 주기 단위는 함께 채우거나 함께 비워야 합니다.');
    expect(errors.frequencyIntervalUomCode).toBe(
      '주기 값과 주기 단위는 함께 채우거나 함께 비워야 합니다.',
    );
  });

  it('주기 단위만 채워도 두 칸 모두에 오류를 낸다', () => {
    const errors = validateVersionForm(values({ frequencyIntervalUomCode: 'PENDING' }));

    expect(errors.frequencyIntervalValue).toBeDefined();
    expect(errors.frequencyIntervalUomCode).toBeDefined();
  });
});

describe('validateVersionForm — 판정 개수', () => {
  /* 계약 CHECK > 0 — 0 은 「없음」이 아니라 위반이다. */
  it('불합격판정개수 0을 거부한다', () => {
    expect(validateVersionForm(values({ rejectionNumber: '0' })).rejectionNumber).toBe(
      '불합격판정개수는 0보다 큰 숫자여야 합니다.',
    );
  });

  it('불합격판정개수 음수를 거부하고 양수를 통과시킨다', () => {
    expect(validateVersionForm(values({ rejectionNumber: '-1' })).rejectionNumber).toBeDefined();
    expect(validateVersionForm(values({ rejectionNumber: '1' })).rejectionNumber).toBeUndefined();
  });

  /* 계약 CHECK ≥ 0 — 불합격판정개수와 규칙이 다르다. */
  it('합격판정개수 0을 통과시킨다', () => {
    expect(validateVersionForm(values({ acceptanceNumber: '0' })).acceptanceNumber).toBeUndefined();
  });

  it('합격판정개수 음수를 거부한다', () => {
    expect(validateVersionForm(values({ acceptanceNumber: '-1' })).acceptanceNumber).toBe(
      '합격판정개수는 0 이상의 숫자여야 합니다.',
    );
  });

  it('숫자가 아닌 값을 거부한다', () => {
    expect(validateVersionForm(values({ rejectionNumber: '한' })).rejectionNumber).toBeDefined();
    expect(validateVersionForm(values({ acceptanceNumber: '한' })).acceptanceNumber).toBeDefined();
  });
});

describe('validateVersionForm — 샘플 비율', () => {
  const RATIO_INVALID = '샘플 비율(%)은 0보다 크고 100 이하인 값이어야 합니다.';

  /*
   * 계약 exclusiveMinimum: 0 — **0 은 통과가 아니라 위반이다**(#201).
   * 종전 규칙(minimum: 0)에서는 0 이 통과였다. 뒤집힌 자리라 경계를 양쪽에서 못박는다.
   */
  it('비율 0을 거부한다', () => {
    expect(validateVersionForm(values({ samplingRatio: '0' })).samplingRatio).toBe(RATIO_INVALID);
  });

  /* 계약 maximum: 100 — 상한은 경계를 포함한다. 전수 검사(100%)가 정상 값이다. */
  it('비율 100을 통과시킨다', () => {
    expect(validateVersionForm(values({ samplingRatio: '100' })).samplingRatio).toBeUndefined();
  });

  it('비율 100.1을 거부한다', () => {
    expect(validateVersionForm(values({ samplingRatio: '100.1' })).samplingRatio).toBe(
      RATIO_INVALID,
    );
  });

  /* 계약 format: double — 정수로 좁히면 계약이 허용한 값을 넣을 수 없다(#201 ③). */
  it('소수를 통과시킨다 — 정수로 좁히지 않는다', () => {
    expect(validateVersionForm(values({ samplingRatio: '0.5' })).samplingRatio).toBeUndefined();
    expect(validateVersionForm(values({ samplingRatio: '30.5' })).samplingRatio).toBeUndefined();
  });

  it('음수와 숫자가 아닌 값을 거부한다', () => {
    expect(validateVersionForm(values({ samplingRatio: '-1' })).samplingRatio).toBe(RATIO_INVALID);
    expect(validateVersionForm(values({ samplingRatio: '한' })).samplingRatio).toBe(RATIO_INVALID);
  });

  /* 선택 필드다 — 빈 칸은 「지정하지 않음」이라 검사 대상이 아니다. 0 과 섞지 않는다. */
  it('빈 칸은 검사하지 않는다', () => {
    expect(validateVersionForm(values({ samplingRatio: '' })).samplingRatio).toBeUndefined();
  });

  /*
   * 종전에는 「오류 문구에 비율·% 를 쓰지 않는다」가 규칙이었다(저장 값이 개수였다).
   * #201 로 그 규칙이 정반대가 됐다 — 라벨과 같은 말이어야 무엇을 고칠지 알 수 있다.
   */
  it('오류 문면이 「비율」과 「%」를 함께 담고 「수량」·「개수」를 담지 않는다', () => {
    const message = validateVersionForm(values({ samplingRatio: '0' })).samplingRatio ?? '';

    expect(message).toMatch(/비율/);
    expect(message).toMatch(/%/);
    expect(message).not.toMatch(/수량|개수/);
  });
});
