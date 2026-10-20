import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  readFilters,
  readPage,
  readSelectedId,
  toListQuery,
  toSearchParams,
  toSelectionSearchParams,
} from './filters';

describe('erp-sales-order filters', () => {
  it('주소와 조건이 서로 되돌아간다', () => {
    const filters = { ...DEFAULT_FILTERS, q: 'SO-1', customer: '4101', unassignedOnly: true };
    const params = toSearchParams(filters, 3);
    expect(params.toString()).toBe('q=SO-1&customer=4101&unassigned=1&page=3');
    expect(readFilters(params)).toEqual(filters);
    expect(readPage(params)).toBe(3);
  });

  it('조건을 바꾸면 고른 건을 놓고, 고르기는 조건을 지키지 않는다', () => {
    const current = new URLSearchParams('q=A&page=2');
    expect(toSelectionSearchParams(current, 9).toString()).toBe('q=A&page=2&sel=9');
    expect(toSearchParams(readFilters(current), 1).has('sel')).toBe(false);
  });

  it('잘못된 쪽·식별자는 무시한다', () => {
    const params = new URLSearchParams('page=-1&sel=abc');
    expect(readPage(params)).toBe(1);
    expect(readSelectedId(params)).toBeNull();
    expect(toListQuery({ ...DEFAULT_FILTERS, customer: 'x' }, 1)).toEqual({ page: 1, size: 25 });
  });

  it('빈 조건은 쿼리에 싣지 않는다', () => {
    expect(
      toListQuery({ ...DEFAULT_FILTERS, customer: '3101', status: 'OPEN', to: '2026-10-31' }, 2),
    ).toEqual({
      page: 2,
      size: 25,
      customerId: 3101,
      statusCode: 'OPEN',
      orderDateTo: '2026-10-31',
    });
  });
});
