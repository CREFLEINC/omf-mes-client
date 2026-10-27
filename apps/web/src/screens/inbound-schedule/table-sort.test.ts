import { describe, expect, it } from 'vitest';

import { compareSortValues, sortRows } from './table-sort';

describe('열 정렬의 비교 규칙', () => {
  it('숫자는 크기로, 글자 속 숫자는 숫자로 읽는다', () => {
    expect(sortRows([10, 2, 33], { key: 'n', direction: 'ascending' }, { n: (v) => v })).toEqual([
      2, 10, 33,
    ]);
    expect(
      sortRows(['RM-10', 'RM-2', 'PK-1'], { key: 's', direction: 'ascending' }, { s: (v) => v }),
    ).toEqual(['PK-1', 'RM-2', 'RM-10']);
  });

  it('내림차순은 거꾸로지만 빈 값은 방향과 상관없이 맨 뒤다', () => {
    const rows = [null, 3, '', 7, undefined, 5] as const;

    expect(sortRows(rows, { key: 'v', direction: 'descending' }, { v: (v) => v })).toEqual([
      7,
      5,
      3,
      null,
      '',
      undefined,
    ]);
    expect(sortRows(rows, { key: 'v', direction: 'ascending' }, { v: (v) => v })).toEqual([
      3,
      5,
      7,
      null,
      '',
      undefined,
    ]);
  });

  it('같은 값끼리는 원래 순서를 지킨다', () => {
    const rows = [
      { id: 1, g: 'B' },
      { id: 2, g: 'A' },
      { id: 3, g: 'B' },
      { id: 4, g: 'A' },
    ];

    expect(
      sortRows(rows, { key: 'g', direction: 'ascending' }, { g: (row) => row.g }).map(
        (row) => row.id,
      ),
    ).toEqual([2, 4, 1, 3]);
  });

  it('정렬이 없거나 모르는 열이면 받은 순서 그대로다', () => {
    const rows = [3, 1, 2];

    expect(sortRows(rows, null, { n: (v) => v })).toBe(rows);
    expect(sortRows(rows, { key: 'gone', direction: 'ascending' }, { n: (v) => v })).toBe(rows);
  });

  it('한국어 글자는 가나다 순이다', () => {
    expect(compareSortValues('자재창고 B', '부자재창고', 'ascending')).toBeGreaterThan(0);
  });
});
