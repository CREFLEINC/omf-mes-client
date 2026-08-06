import { describe, expect, it } from 'vitest';

import {
  EMPTY_ITEM_FILTERS,
  ITEM_KEY,
  clearFilter,
  hasAnyFilter,
  readItemFilters,
  readPage,
  readSelectedId,
  toFilterChips,
  toItemListQuery,
  toSearchParams,
} from './filters';
import type { ItemFilters } from './types';

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readItemFilters', () => {
  it('빈 주소는 빈 조건이다', () => {
    expect(readItemFilters(params(''))).toEqual(EMPTY_ITEM_FILTERS);
  });

  it('검색어와 미사용 포함을 읽는다', () => {
    expect(readItemFilters(params('q=SYN&inactive=1'))).toEqual({
      q: 'SYN',
      includeInactive: true,
    });
  });

  /* 켜짐을 나타내는 값은 `1` 하나뿐이다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
  it('미사용 포함은 1 이외의 값을 꺼진 것으로 본다', () => {
    expect(readItemFilters(params('inactive=true')).includeInactive).toBe(false);
    expect(readItemFilters(params('inactive=0')).includeInactive).toBe(false);
    expect(readItemFilters(params('inactive=')).includeInactive).toBe(false);
  });
});

describe('readPage', () => {
  it('없으면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
  });

  it('쪽 번호를 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });

  it('이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다', () => {
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-2'))).toBe(1);
    expect(readPage(params('page=abc'))).toBe(1);
    expect(readPage(params('page=1.5'))).toBe(1);
  });
});

describe('readSelectedId', () => {
  it('고른 품목 번호를 읽는다', () => {
    expect(readSelectedId(params('item=1001'), ITEM_KEY)).toBe(1001);
  });

  /*
   * 식별자는 1부터 매겨진다. 걸러 내지 않으면 `?item=abc`가 경로에 `NaN`을 실은
   * 상세 조회를 내보낸다.
   */
  it('어떤 자원도 가리키지 않는 값은 고르지 않은 것으로 본다', () => {
    expect(readSelectedId(params('item=0'), ITEM_KEY)).toBeNull();
    expect(readSelectedId(params('item=-1'), ITEM_KEY)).toBeNull();
    expect(readSelectedId(params('item=abc'), ITEM_KEY)).toBeNull();
    expect(readSelectedId(params('item=1.5'), ITEM_KEY)).toBeNull();
    expect(readSelectedId(params(''), ITEM_KEY)).toBeNull();
  });
});

describe('toSearchParams', () => {
  it('빈 조건은 키 자체를 두지 않는다', () => {
    expect(toSearchParams(EMPTY_ITEM_FILTERS, 1).toString()).toBe('');
  });

  it('걸린 조건만 주소에 남는다', () => {
    expect(toSearchParams({ q: 'SYN', includeInactive: true }, 3).toString()).toBe(
      'q=SYN&inactive=1&page=3',
    );
  });

  /* 선택은 조건이 아니다 — 보이는 행이 달라지면 선택이 자연히 사라져야 한다. */
  it('고른 품목을 담지 않는다', () => {
    expect(toSearchParams({ q: 'SYN', includeInactive: false }, 2).has(ITEM_KEY)).toBe(false);
  });
});

/**
 * M13 — 주소 왕복이 같은 조건을 낸다.
 * 이 왕복이 깨지면 새로고침·공유가 다른 결과를 낸다.
 */
describe('주소 왕복 (M13)', () => {
  const cases: { filters: ItemFilters; page: number }[] = [
    { filters: EMPTY_ITEM_FILTERS, page: 1 },
    { filters: { q: 'SYN-ITEM', includeInactive: false }, page: 1 },
    { filters: { q: '', includeInactive: true }, page: 4 },
    { filters: { q: '합성 품목', includeInactive: true }, page: 12 },
  ];

  it.each(cases)('$filters / $page 쪽이 왕복해도 같다', ({ filters, page }) => {
    const written = toSearchParams(filters, page);

    expect(readItemFilters(written)).toEqual(filters);
    expect(readPage(written)).toBe(page);
  });
});

describe('toItemListQuery', () => {
  /*
   * 계약의 기본값이 false라 끈 상태를 값으로 실어 보내면
   * 「보내지 않음」과 「false를 보냄」 두 상태가 생겨 캐시 키가 갈린다.
   */
  it('빈 조건·꺼진 확인칸·첫 쪽은 싣지 않는다', () => {
    expect(toItemListQuery(EMPTY_ITEM_FILTERS, 1)).toEqual({});
  });

  it('걸린 조건만 싣는다', () => {
    expect(toItemListQuery({ q: 'SYN', includeInactive: true }, 2)).toEqual({
      q: 'SYN',
      includeInactive: true,
      page: 2,
    });
  });

  /* 화면에 없는 조건을 요청에 실으면 사용자가 되돌릴 수단이 없다. */
  it('화면에 없는 품목유형·Routing 보유 조건을 싣지 않는다', () => {
    const query = toItemListQuery({ q: 'SYN', includeInactive: true }, 2);

    expect(query).not.toHaveProperty('itemTypeCode');
    expect(query).not.toHaveProperty('hasRouting');
  });
});

describe('조건 칩', () => {
  it('걸린 조건마다 칩 하나가 난다', () => {
    const chips = toFilterChips({ q: 'SYN', includeInactive: true });

    expect(chips.map((chip) => chip.key)).toEqual(['q', 'includeInactive']);
    expect(chips[0]?.label).toBe('검색어: SYN');
  });

  it('조건이 없으면 칩도 없다', () => {
    expect(toFilterChips(EMPTY_ITEM_FILTERS)).toEqual([]);
  });

  /* 「제거」가 둘이면 어느 조건을 푸는 것인지 알 수 없다. */
  it('제거 버튼의 이름이 조건마다 다르다', () => {
    const chips = toFilterChips({ q: 'SYN', includeInactive: true });

    expect(new Set(chips.map((chip) => chip.removeLabel)).size).toBe(chips.length);
  });
});

describe('hasAnyFilter · clearFilter', () => {
  it('조건이 하나라도 걸리면 참이다', () => {
    expect(hasAnyFilter(EMPTY_ITEM_FILTERS)).toBe(false);
    expect(hasAnyFilter({ q: 'SYN', includeInactive: false })).toBe(true);
    expect(hasAnyFilter({ q: '', includeInactive: true })).toBe(true);
  });

  it('키마다 「비었다」의 표현이 달라도 하나만 푼다', () => {
    const filters: ItemFilters = { q: 'SYN', includeInactive: true };

    expect(clearFilter(filters, 'q')).toEqual({ q: '', includeInactive: true });
    expect(clearFilter(filters, 'includeInactive')).toEqual({ q: 'SYN', includeInactive: false });
  });
});
