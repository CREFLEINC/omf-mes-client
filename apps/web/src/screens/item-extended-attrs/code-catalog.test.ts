import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

import { FIFO_POLICY_CODES, FREE_TEXT_CODES, fifoPolicyOptions } from './code-catalog';

type ItemUpdate = components['schemas']['ItemUpdate'];

/**
 * 계약 스키마의 `example` 문자열. **코드값이 아니다** —
 * 목 서버가 이 값을 곳곳에 내려주지만 그것은 예시일 뿐이다.
 */
const CONTRACT_EXAMPLE_STRINGS = ['STANDARD', 'MATERIAL', 'NONE'];

/**
 * M27 — `code_catalog`에 지어낸 값이 없다.
 *
 * 이 파일이 막는 것은 **화면이 값 목록을 발명하는 것**이다.
 * 계약이 이름으로 밝힌 값만 여기 담긴다.
 */
describe('FIFO_POLICY_CODES (M27)', () => {
  it('계약이 이름으로 밝힌 두 값뿐이다', () => {
    expect(FIFO_POLICY_CODES).toEqual(['FIFO', 'FEFO']);
  });

  it('스키마 예시 문자열을 코드값으로 담지 않는다', () => {
    for (const example of CONTRACT_EXAMPLE_STRINGS) {
      expect(FIFO_POLICY_CODES).not.toContain(example);
    }
  });
});

describe('FREE_TEXT_CODES', () => {
  /*
   * 자유 입력으로 받는 것은 **필드**이지 코드값이 아니다.
   * 목록에 코드값이 섞이면 이 파일이 무엇을 기록하는 것인지 뜻이 흐려진다.
   */
  it('전부 계약 요청 본문의 필드 이름이다', () => {
    const updateKeys: (keyof ItemUpdate)[] = [
      'lotControlTypeCode',
      'serialControlTypeCode',
      'shelfLifeDays',
      'inspectionRequired',
      'fifoPolicyCode',
      'negativeStockAllowed',
      'storageConditionCode',
      'openedShelfLifeHours',
      'isActive',
    ];

    for (const field of FREE_TEXT_CODES) {
      expect(updateKeys).toContain(field);
    }
  });

  /* 계약이 값을 밝힌 코드는 선택칸이다 — 자유 입력 목록에 있으면 안 된다. */
  it('선출 정책은 자유 입력이 아니다', () => {
    expect(FREE_TEXT_CODES).not.toContain('fifoPolicyCode');
  });
});

describe('fifoPolicyOptions', () => {
  it('계약이 밝힌 두 값을 선택지로 낸다', () => {
    expect(fifoPolicyOptions('FIFO')).toEqual([
      { value: 'FIFO', label: 'FIFO' },
      { value: 'FEFO', label: 'FEFO' },
    ]);
  });

  /* 빼면 선택칸이 비어 보여 사용자가 값이 사라진 줄 안다. */
  it('서버가 준 현재 값이 목록에 없으면 그대로 남긴다', () => {
    expect(fifoPolicyOptions('SYN-POLICY-X')).toContainEqual({
      value: 'SYN-POLICY-X',
      label: 'SYN-POLICY-X',
    });
  });

  it('값이 없으면 아무것도 덧붙이지 않는다', () => {
    expect(fifoPolicyOptions('')).toHaveLength(FIFO_POLICY_CODES.length);
  });

  /* 계약에 없는 한국어 이름을 붙이면 화면이 이름을 발명하는 것이 된다. */
  it('라벨을 코드 그대로 낸다', () => {
    for (const option of fifoPolicyOptions('FIFO')) {
      expect(option.label).toBe(option.value);
    }
  });
});
