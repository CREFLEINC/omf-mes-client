import { describe, expect, it } from 'vitest';

import { listDateTimeText, sortByTime } from './pop-list-order';

const rows = [
  { id: 'a', at: '2026-11-19T08:00:00+07:00' },
  { id: 'none', at: null },
  { id: 'b', at: '2026-11-19T09:30:00+07:00' },
  { id: 'a2', at: '2026-11-19T08:00:00+07:00' },
];

describe('POP 목록 정렬', () => {
  it('최신순·오래된순으로 줄 세우고, 같은 시각은 원래 차례를 지킨다', () => {
    expect(sortByTime(rows, 'newest', (row) => row.at).map((row) => row.id)).toEqual([
      'b',
      'a',
      'a2',
      'none',
    ]);
    expect(sortByTime(rows, 'oldest', (row) => row.at).map((row) => row.id)).toEqual([
      'a',
      'a2',
      'b',
      'none',
    ]);
  });

  it('시각이 없거나 못 읽는 줄은 어느 쪽으로 정렬해도 맨 뒤다', () => {
    const broken = [{ at: 'x' }, { at: '2026-01-01T00:00:00Z' }];

    expect(sortByTime(broken, 'oldest', (row) => row.at)[0]?.at).toBe('2026-01-01T00:00:00Z');
    expect(sortByTime(broken, 'newest', (row) => row.at)[0]?.at).toBe('2026-01-01T00:00:00Z');
  });

  it('목록 일시는 공장 시각 「MM-DD HH:mm」', () => {
    expect(listDateTimeText('2026-11-19T06:35:00Z')).toBe('11-19 13:35');
    expect(listDateTimeText(null)).toBeNull();
  });
});
