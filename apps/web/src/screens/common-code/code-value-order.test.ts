import { describe, expect, it } from 'vitest';

import { hasDuplicateDisplayOrder, sortForDisplay } from './code-value-order';
import type { CodeValue } from './code-value-types';

const row = (overrides: Partial<CodeValue> & Pick<CodeValue, 'codeValueId'>): CodeValue => ({
  codeGroupId: 1001,
  code: `SYN-CV-${String(overrides.codeValueId)}`,
  codeName: '합성 코드값',
  displayOrder: 0,
  effectiveFrom: null,
  effectiveTo: null,
  isActive: true,
  ...overrides,
});

describe('sortForDisplay', () => {
  /* 계약이 목록의 정렬을 명시하지 않았다 — 받은 순서를 그대로 쓰면 순서가 서버 재량이 된다. */
  it('정렬 순서 오름차순으로 다시 세운다', () => {
    const sorted = sortForDisplay([
      row({ codeValueId: 1, displayOrder: 30 }),
      row({ codeValueId: 2, displayOrder: 10 }),
      row({ codeValueId: 3, displayOrder: 20 }),
    ]);

    expect(sorted.map((item) => item.displayOrder)).toEqual([10, 20, 30]);
  });

  it('정렬 순서가 같으면 코드 오름차순으로 가른다 — 같은 값이 뒤섞이면 안 된다', () => {
    const sorted = sortForDisplay([
      row({ codeValueId: 1, displayOrder: 10, code: 'SYN-CV-B' }),
      row({ codeValueId: 2, displayOrder: 10, code: 'SYN-CV-A' }),
    ]);

    expect(sorted.map((item) => item.code)).toEqual(['SYN-CV-A', 'SYN-CV-B']);
  });

  it('음수와 0을 그대로 다룬다 — 계약에 하한이 없다', () => {
    const sorted = sortForDisplay([
      row({ codeValueId: 1, displayOrder: 0 }),
      row({ codeValueId: 2, displayOrder: -5 }),
      row({ codeValueId: 3, displayOrder: 3 }),
    ]);

    expect(sorted.map((item) => item.displayOrder)).toEqual([-5, 0, 3]);
  });

  /* 받은 배열을 고치면 캐시에 든 값이 함께 바뀐다 — 다른 소비처가 순서가 달라진 배열을 본다. */
  it('받은 배열을 고치지 않는다', () => {
    const items = [
      row({ codeValueId: 1, displayOrder: 30 }),
      row({ codeValueId: 2, displayOrder: 10 }),
    ];

    sortForDisplay(items);

    expect(items.map((item) => item.displayOrder)).toEqual([30, 10]);
  });

  it('빈 목록도 다룬다', () => {
    expect(sortForDisplay([])).toEqual([]);
  });
});

describe('hasDuplicateDisplayOrder', () => {
  /*
   * 유일 제약이 없어 서버가 허용하는 값이다 — **저장을 막지 않는다.**
   * 다만 목록의 순서가 코드 순으로 갈린다는 사실을 감추지 않는다.
   */
  it('정렬 순서가 겹치는 행이 있으면 참이다', () => {
    expect(
      hasDuplicateDisplayOrder([
        row({ codeValueId: 1, displayOrder: 10 }),
        row({ codeValueId: 2, displayOrder: 10 }),
      ]),
    ).toBe(true);
  });

  it('전부 다르면 거짓이다', () => {
    expect(
      hasDuplicateDisplayOrder([
        row({ codeValueId: 1, displayOrder: 10 }),
        row({ codeValueId: 2, displayOrder: 20 }),
      ]),
    ).toBe(false);
  });

  it('한 건·빈 목록에서는 겹칠 것이 없다', () => {
    expect(hasDuplicateDisplayOrder([row({ codeValueId: 1 })])).toBe(false);
    expect(hasDuplicateDisplayOrder([])).toBe(false);
  });
});
