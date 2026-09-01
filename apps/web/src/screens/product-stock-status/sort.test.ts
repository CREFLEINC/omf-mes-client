import { describe, expect, it } from 'vitest';

import { nextSortKey, readSortKey, sortableKeysOf, toSortQuery, toSortState } from './sort';

describe('sortableKeysOf', () => {
  it('세 보기 모두 availableQty 한 열만 연다 — 계약이 아직 다른 열을 받지 않는다', () => {
    expect(sortableKeysOf('item')).toEqual(['availableQty']);
    expect(sortableKeysOf('lot')).toEqual(['availableQty']);
    expect(sortableKeysOf('location')).toEqual(['availableQty']);
  });
});

describe('readSortKey', () => {
  it('없으면 정렬하지 않는다', () => {
    expect(readSortKey(null, 'item')).toBeNull();
  });

  it('그 보기의 열이 아니면 버린다', () => {
    expect(readSortKey('itemCode', 'item')).toBeNull();
  });

  it('그 보기의 열이면 그대로 읽는다', () => {
    expect(readSortKey('availableQty', 'lot')).toBe('availableQty');
  });
});

describe('nextSortKey', () => {
  it('같은 열이 다시 오면 방향과 무관하게 해제한다', () => {
    expect(
      nextSortKey('availableQty', { key: 'availableQty', direction: 'descending' }, 'item'),
    ).toBeNull();
  });

  it('없음이 오면 해제한다', () => {
    expect(nextSortKey('availableQty', null, 'item')).toBeNull();
  });

  it('그 보기의 열이 아니면 해제한다', () => {
    expect(nextSortKey(null, { key: 'itemCode', direction: 'ascending' }, 'item')).toBeNull();
  });

  it('그 보기의 새 열이면 그 열로 바꾼다', () => {
    expect(nextSortKey(null, { key: 'availableQty', direction: 'ascending' }, 'item')).toBe(
      'availableQty',
    );
  });
});

describe('toSortState', () => {
  it('없으면 null이다', () => {
    expect(toSortState(null)).toBeNull();
  });

  it('있으면 오름차순으로 표기한다 — 계약이 방향을 받지 않는다', () => {
    expect(toSortState('availableQty')).toEqual({ key: 'availableQty', direction: 'ascending' });
  });
});

describe('toSortQuery', () => {
  it('없으면 키를 싣지 않는다', () => {
    expect(toSortQuery(null)).toEqual({});
  });

  it('있으면 열만 싣는다 — 방향을 뜻하는 키를 만들지 않는다', () => {
    expect(toSortQuery('availableQty')).toEqual({ sort: 'availableQty' });
  });
});
