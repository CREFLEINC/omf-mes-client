import { describe, expect, it } from 'vitest';

import {
  DATA_TYPE_OPTIONS,
  FREQUENCY_INTERVAL_UOM_OPTIONS,
  INSPECTION_FREQUENCY_OPTIONS,
  INSPECTION_METHOD_OPTIONS,
  INSPECTION_TYPE_OPTIONS,
  PENDING_CODE_VALUE,
  SAMPLING_METHOD_OPTIONS,
  ensureOption,
  inspectionTypeLabel,
  selectableOptions,
} from './code-options';
import type { LookupEntry } from './types';

/** 5001은 사용 중, 5002는 **미사용**이다 — 미사용 처리를 가르는 것이 이 픽스처의 목적이다. */
const entries: LookupEntry[] = [
  { value: '5001', label: '합성 품목 A', isActive: true },
  { value: '5002', label: '합성 품목 B', isActive: false },
];

const values = (options: { value: string }[]): string[] => options.map((option) => option.value);

describe('selectableOptions — 미사용 걸러내기', () => {
  /*
   * 미사용을 전부 늘어놓으면 고를 수 없는 값이 선택지에 섞인다.
   * 기본은 「사용 중인 것」만 낸다.
   */
  it('고르지 않은 미사용 항목은 선택지에서 뺀다', () => {
    const options = selectableOptions(entries, '');

    expect(values(options)).toEqual(['5001']);
    expect(values(options)).not.toContain('5002');
  });

  it('사용 중인 항목은 표식 없이 그대로 낸다', () => {
    expect(selectableOptions(entries, '')[0]).toEqual({ value: '5001', label: '합성 품목 A' });
  });

  it('모두 미사용이고 고른 값도 없으면 선택지가 비어 있다', () => {
    expect(selectableOptions([{ value: '5002', label: '합성 품목 B', isActive: false }], '')).toEqual(
      [],
    );
  });
});

describe('selectableOptions — 지금 고른 값 보존', () => {
  /*
   * 지금 값을 빼 버리면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다.
   * 더 나쁜 것은 저장할 때 조용히 다른 값이 되는 것이다.
   */
  it('고른 값이 미사용이어도 선택지에 남긴다', () => {
    expect(values(selectableOptions(entries, '5002'))).toEqual(['5001', '5002']);
  });

  /** 미사용이라는 사실 자체를 감추지 않는다 — 표식이 없으면 사용 중인 값과 구분되지 않는다. */
  it('미사용인 고른 값에는 「(미사용)」 표식을 붙인다', () => {
    const options = selectableOptions(entries, '5002');

    expect(options.find((option) => option.value === '5002')?.label).toBe('합성 품목 B (미사용)');
  });

  it('사용 중인 값을 골랐으면 표식을 붙이지 않는다', () => {
    const options = selectableOptions(entries, '5001');

    expect(options.find((option) => option.value === '5001')?.label).toBe('합성 품목 A');
  });

  /* 조회가 잘리거나 실패해도 지금 값을 지우지 않는다. 목록에 아예 없으면 코드를 그대로 낸다. */
  it('목록에 아예 없는 고른 값은 코드 그대로 덧붙인다', () => {
    const options = selectableOptions(entries, '9999');

    expect(values(options)).toEqual(['5001', '9999']);
    expect(options.at(-1)?.label).toBe('9999');
  });

  it('조회가 실패해 목록이 비어도 고른 값은 남는다', () => {
    expect(selectableOptions([], '9999')).toEqual([{ value: '9999', label: '9999' }]);
  });
});

describe('ensureOption', () => {
  it('이미 있는 값은 목록을 그대로 돌려준다', () => {
    const options = [{ value: 'IQC', label: 'IQC (수입검사)' }];

    expect(ensureOption(options, 'IQC')).toBe(options);
  });

  /* 빈 값은 「지정하지 않음」이라 덧붙일 대상이 아니다 — 붙이면 빈 선택지가 생긴다. */
  it('빈 값에는 아무것도 덧붙이지 않는다', () => {
    const options = [{ value: 'IQC', label: 'IQC (수입검사)' }];

    expect(ensureOption(options, '')).toBe(options);
  });

  it('없는 값은 코드 그대로 덧붙인다', () => {
    expect(ensureOption([{ value: 'IQC', label: 'IQC (수입검사)' }], 'XQC')).toEqual([
      { value: 'IQC', label: 'IQC (수입검사)' },
      { value: 'XQC', label: 'XQC' },
    ]);
  });
});

describe('inspectionTypeLabel', () => {
  it('아는 코드는 이름으로 옮긴다', () => {
    expect(inspectionTypeLabel('IQC')).toBe('IQC (수입검사)');
    expect(inspectionTypeLabel('OQC')).toBe('OQC (출하검사)');
  });

  /* 서버가 다른 문자열을 주면 그것을 지우지 않는다 — 값이 사라진 것처럼 보이면 안 된다. */
  it('모르는 코드는 원문을 그대로 낸다', () => {
    expect(inspectionTypeLabel('XQC')).toBe('XQC');
  });
});

describe('자리표시 상수', () => {
  /*
   * 계약의 `inspectionTypeCode`는 enum이 아니다. 그런데도 3값을 둔 근거는
   * 화면 제목·계약 설명·계약 예시 셋의 일치이며, 그 셋이 가리키는 값은 IQC·PQC·OQC다.
   */
  it('검사 유형은 세 값뿐이다', () => {
    expect(values(INSPECTION_TYPE_OPTIONS)).toEqual(['IQC', 'PQC', 'OQC']);
  });

  /** 값 목록이 확정되지 않은 코드는 **값을 지어내지 않는다** — 자리표시 한 값만 둔다. */
  it('값 목록이 미확정인 코드는 자리표시 한 값만 갖는다', () => {
    const pending = [
      SAMPLING_METHOD_OPTIONS,
      INSPECTION_FREQUENCY_OPTIONS,
      FREQUENCY_INTERVAL_UOM_OPTIONS,
      DATA_TYPE_OPTIONS,
      INSPECTION_METHOD_OPTIONS,
    ];

    for (const options of pending) {
      expect(values(options)).toEqual([PENDING_CODE_VALUE]);
    }
  });
});
