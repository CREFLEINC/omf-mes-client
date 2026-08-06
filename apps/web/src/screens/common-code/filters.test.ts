import { describe, expect, it } from 'vitest';

import {
  clearFilter,
  hasAnyFilter,
  readCodeGroupFilters,
  readPage,
  toCodeGroupListQuery,
  toFilterChips,
  toSearchParams,
} from './filters';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readCodeGroupFilters', () => {
  it('주소에서 조건을 읽는다', () => {
    expect(readCodeGroupFilters(params('?q=SYN&inactive=1'))).toEqual({
      q: 'SYN',
      includeInactive: true,
    });
  });

  it('조건이 없으면 빈 조건이다', () => {
    expect(readCodeGroupFilters(params(''))).toEqual({ q: '', includeInactive: false });
  });

  /* 켜짐을 나타내는 값은 하나뿐이다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
  it('미사용 포함은 1일 때만 켜진 것으로 본다', () => {
    expect(readCodeGroupFilters(params('?inactive=true')).includeInactive).toBe(false);
    expect(readCodeGroupFilters(params('?inactive=0')).includeInactive).toBe(false);
    expect(readCodeGroupFilters(params('?inactive=')).includeInactive).toBe(false);
  });
});

describe('readPage', () => {
  it('주소의 쪽 번호를 읽는다', () => {
    expect(readPage(params('?page=3'))).toBe(3);
  });

  it('없으면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
  });

  it('이상한 값이면 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다', () => {
    expect(readPage(params('?page=0'))).toBe(1);
    expect(readPage(params('?page=-2'))).toBe(1);
    expect(readPage(params('?page=1.5'))).toBe(1);
    expect(readPage(params('?page=abc'))).toBe(1);
  });
});

describe('toSearchParams', () => {
  it('빈 조건과 첫 쪽은 키 자체를 두지 않는다', () => {
    const next = toSearchParams('code', { q: '', includeInactive: false }, 1);

    expect(next.get('tab')).toBe('code');
    expect([...next.keys()]).toEqual(['tab']);
  });

  it('걸린 조건과 두 번째 이후 쪽만 싣는다', () => {
    const next = toSearchParams('code', { q: 'SYN', includeInactive: true }, 3);

    expect(next.get('q')).toBe('SYN');
    expect(next.get('inactive')).toBe('1');
    expect(next.get('page')).toBe('3');
  });

  /*
   * 조건·쪽이 바뀌면 이 함수의 결과로 주소를 통째로 갈아 끼운다 —
   * 선택을 담지 않으므로 보이는 행이 달라질 때 선택이 자연히 사라진다.
   */
  it('선택 파라미터를 담지 않는다', () => {
    const next = toSearchParams('code', { q: 'SYN', includeInactive: true }, 2);

    for (const key of ['grp', 'val', 'vpage', 'vinactive', 'new']) {
      expect(next.has(key)).toBe(false);
    }
  });
});

describe('toCodeGroupListQuery', () => {
  it('빈 값·꺼진 확인칸·첫 쪽을 싣지 않는다', () => {
    expect(toCodeGroupListQuery({ q: '', includeInactive: false }, 1)).toEqual({});
  });

  it('걸린 조건만 싣는다', () => {
    expect(toCodeGroupListQuery({ q: 'SYN', includeInactive: true }, 2)).toEqual({
      q: 'SYN',
      includeInactive: true,
      page: 2,
    });
  });

  /* 계약의 기본값이 false다 — 끈 상태를 값으로 실어 보내면 캐시 키가 갈린다. */
  it('미사용 포함이 꺼져 있으면 키 자체가 없다', () => {
    expect('includeInactive' in toCodeGroupListQuery({ q: 'SYN', includeInactive: false }, 1)).toBe(
      false,
    );
  });
});

describe('toFilterChips', () => {
  it('걸린 조건마다 칩 하나가 나온다', () => {
    const chips = toFilterChips({ q: 'SYN', includeInactive: true });

    expect(chips.map((chip) => chip.key)).toEqual(['q', 'includeInactive']);
    expect(chips[0]?.label).toBe('검색어: SYN');
  });

  it('조건이 없으면 칩도 없다', () => {
    expect(toFilterChips({ q: '', includeInactive: false })).toEqual([]);
  });

  it('칩마다 제거 버튼의 접근 이름이 다르다 — 어느 조건을 푸는지 알 수 있다', () => {
    const chips = toFilterChips({ q: 'SYN', includeInactive: true });
    const labels = chips.map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(labels.length);
    for (const label of labels) expect(label).not.toBe('');
  });
});

describe('hasAnyFilter', () => {
  it('조건이 하나라도 있으면 참이다', () => {
    expect(hasAnyFilter({ q: 'SYN', includeInactive: false })).toBe(true);
    expect(hasAnyFilter({ q: '', includeInactive: true })).toBe(true);
    expect(hasAnyFilter({ q: '', includeInactive: false })).toBe(false);
  });
});

describe('clearFilter', () => {
  it('검색어만 푼다', () => {
    expect(clearFilter({ q: 'SYN', includeInactive: true }, 'q')).toEqual({
      q: '',
      includeInactive: true,
    });
  });

  it('미사용 포함만 푼다 — 키마다 「비었다」의 표현이 다르다', () => {
    expect(clearFilter({ q: 'SYN', includeInactive: true }, 'includeInactive')).toEqual({
      q: 'SYN',
      includeInactive: false,
    });
  });
});
