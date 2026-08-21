import { describe, expect, it } from 'vitest';

import {
  EMPTY_HISTORY_FILTERS,
  EMPTY_LOT_FILTERS,
  type HistoryFilters,
  type LotFilters,
} from './filters';
import { lotStatusKeys } from './query-keys';

describe('lotStatusKeys.list', () => {
  it('같은 LOT 조건이라도 페이지가 다르면 목록 캐시를 분리한다', () => {
    expect(lotStatusKeys.list(EMPTY_LOT_FILTERS, 1)).not.toEqual(
      lotStatusKeys.list(EMPTY_LOT_FILTERS, 2),
    );
  });

  it.each([
    ['lotType', 'SAMPLE_TYPE'],
    ['item', '101'],
    ['warehouse', '202'],
    ['location', '303'],
    ['q', 'SAMPLE-LOT'],
    ['status', 'SAMPLE_STATUS'],
  ] as const)('%s 조건이 다르면 요약과 목록 캐시를 각각 분리한다', (key, value) => {
    const changed = { ...EMPTY_LOT_FILTERS, [key]: value };

    expect(lotStatusKeys.summary(EMPTY_LOT_FILTERS)).not.toEqual(lotStatusKeys.summary(changed));
    expect(lotStatusKeys.list(EMPTY_LOT_FILTERS, 1)).not.toEqual(lotStatusKeys.list(changed, 1));
  });

  it('서버 정렬이 다르면 목록 캐시만 분리한다', () => {
    const changed: LotFilters = { ...EMPTY_LOT_FILTERS, sort: 'lotNoAsc' };

    expect(lotStatusKeys.list(EMPTY_LOT_FILTERS, 1)).not.toEqual(lotStatusKeys.list(changed, 1));
    expect(lotStatusKeys.summary(EMPTY_LOT_FILTERS)).toEqual(lotStatusKeys.summary(changed));
  });

  it('같은 의미값의 새 필터 객체는 같은 캐시 키를 만든다', () => {
    const first: LotFilters = { ...EMPTY_LOT_FILTERS, lotType: 'TYPE_A', item: '101' };
    const second: LotFilters = { ...EMPTY_LOT_FILTERS, lotType: 'TYPE_A', item: '101' };

    expect(lotStatusKeys.summary(first)).toEqual(lotStatusKeys.summary(second));
    expect(lotStatusKeys.list(first, 3)).toEqual(lotStatusKeys.list(second, 3));
  });

  it('호출자가 필터 객체를 바꿔도 이미 만든 캐시 키는 변하지 않는다', () => {
    const filters: LotFilters = { ...EMPTY_LOT_FILTERS, location: '303' };
    const key = lotStatusKeys.list(filters, 1);

    filters.location = '404';

    expect(key).toEqual([
      'lot-status-history',
      'list',
      {
        lotType: '',
        q: '',
        item: '',
        status: '',
        warehouse: '',
        location: '303',
        sort: 'latestTransitionDesc',
      },
      1,
    ]);
  });
});

describe('lotStatusKeys detail boundaries', () => {
  it('LOT 식별자가 다르면 상세와 보류 캐시를 각각 분리한다', () => {
    expect(lotStatusKeys.detail(101)).not.toEqual(lotStatusKeys.detail(202));
    expect(lotStatusKeys.holds(101)).not.toEqual(lotStatusKeys.holds(202));
  });

  it('선택하지 않은 null도 별도의 상세·보류 캐시 키다', () => {
    expect(lotStatusKeys.detail(null)).not.toEqual(lotStatusKeys.detail(101));
    expect(lotStatusKeys.holds(null)).not.toEqual(lotStatusKeys.holds(101));
  });

  it('같은 LOT 식별자라도 상세와 보류 캐시는 서로 다른 영역이다', () => {
    expect(lotStatusKeys.detail(101)).not.toEqual(lotStatusKeys.holds(101));
  });
});

describe('lotStatusKeys.history', () => {
  it.each([
    ['from', '2026-08-01'],
    ['to', '2026-08-07'],
    ['actor', '505'],
    ['lot', '606'],
  ] as const)('%s 조건이 다르면 이력 캐시를 분리한다', (key, value) => {
    const changed = { ...EMPTY_HISTORY_FILTERS, [key]: value };

    expect(lotStatusKeys.history(EMPTY_HISTORY_FILTERS, 1, 540)).not.toEqual(
      lotStatusKeys.history(changed, 1, 540),
    );
  });

  it('페이지가 다르면 이력 캐시를 분리한다', () => {
    expect(lotStatusKeys.history(EMPTY_HISTORY_FILTERS, 1, 540)).not.toEqual(
      lotStatusKeys.history(EMPTY_HISTORY_FILTERS, 2, 540),
    );
  });

  it('같은 지역 날짜라도 UTC offset이 다르면 이력 캐시를 분리한다', () => {
    expect(lotStatusKeys.history(EMPTY_HISTORY_FILTERS, 1, 540)).not.toEqual(
      lotStatusKeys.history(EMPTY_HISTORY_FILTERS, 1, -300),
    );
  });

  it('호출자가 이력 필터 객체를 바꿔도 이미 만든 캐시 키는 변하지 않는다', () => {
    const filters: HistoryFilters = { ...EMPTY_HISTORY_FILTERS, actor: '505' };
    const key = lotStatusKeys.history(filters, 2, 540);

    filters.actor = '606';

    expect(key).toEqual([
      'lot-status-history',
      'history',
      { from: '', to: '', actor: '505', lot: '' },
      2,
      540,
    ]);
  });
});
