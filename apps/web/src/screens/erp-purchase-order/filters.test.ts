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

describe('erp-purchase-order filters', () => {
  it('주소와 조건이 서로 되돌아간다', () => {
    const filters = { ...DEFAULT_FILTERS, q: 'PO-1', supplier: '4101', progress: 'open' as const };
    const params = toSearchParams(filters, 3);
    expect(params.toString()).toBe('q=PO-1&supplier=4101&progress=open&page=3');
    expect(readFilters(params)).toEqual(filters);
    expect(readPage(params)).toBe(3);
  });

  it('진행은 전체면 적지 않고, 예전 주소의 `open=1` 은 미완료로 읽는다', () => {
    expect(toSearchParams(DEFAULT_FILTERS, 1).toString()).toBe('');
    expect(readFilters(new URLSearchParams('progress=done')).progress).toBe('done');
    expect(readFilters(new URLSearchParams('open=1')).progress).toBe('open');
    expect(readFilters(new URLSearchParams('progress=weird')).progress).toBe('all');
    expect(toSearchParams(readFilters(new URLSearchParams('open=1')), 1).toString()).toBe(
      'progress=open',
    );
  });

  it('미완료는 `openOnly` 와 `progress=OPEN` 을 함께, 완료는 `progress=COMPLETED` 만 싣는다', () => {
    expect(toListQuery({ ...DEFAULT_FILTERS, progress: 'open' }, 1)).toEqual({
      page: 1,
      size: 25,
      openOnly: true,
      progress: 'OPEN',
    });
    expect(toListQuery({ ...DEFAULT_FILTERS, progress: 'done' }, 1)).toEqual({
      page: 1,
      size: 25,
      progress: 'COMPLETED',
    });
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
    expect(toListQuery({ ...DEFAULT_FILTERS, supplier: 'x' }, 1)).toEqual({ page: 1, size: 25 });
  });

  it('빈 조건은 쿼리에 싣지 않는다', () => {
    expect(
      toListQuery({ ...DEFAULT_FILTERS, plant: '3101', status: 'POSTED', to: '2026-10-31' }, 2),
    ).toEqual({
      page: 2,
      size: 25,
      plantId: 3101,
      statusCode: 'POSTED',
      orderDateTo: '2026-10-31',
    });
  });
});
