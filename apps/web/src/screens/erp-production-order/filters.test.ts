import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  isIsoDate,
  readFilters,
  readPage,
  toListQuery,
  toSearchParams,
} from './filters';

describe('erp-production-order filters', () => {
  it('주소와 조건이 서로 되돌아간다', () => {
    const filters = { ...DEFAULT_FILTERS, q: 'SYN-WO', item: '7101', from: '2026-10-01' };
    const params = toSearchParams(filters, 3);
    expect(params.toString()).toBe('q=SYN-WO&item=7101&from=2026-10-01&page=3');
    expect(readFilters(params)).toEqual(filters);
    expect(readPage(params)).toBe(3);
  });

  it('잘못된 쪽·식별자는 무시한다', () => {
    const params = new URLSearchParams('page=-1');
    expect(readPage(params)).toBe(1);
    expect(toListQuery({ ...DEFAULT_FILTERS, item: 'x' }, 1)).toEqual({ page: 1, size: 25 });
  });

  it('계획 시작일 범위를 계약 밖 질의 이름으로 싣고, 달력에 없는 날짜는 보내지 않는다', () => {
    expect(
      toListQuery(
        { ...DEFAULT_FILTERS, status: 'RECEIVED', from: '2026-10-01', to: '2026-10-31' },
        2,
      ),
    ).toEqual({
      page: 2,
      size: 25,
      statusCode: 'RECEIVED',
      plannedStartDateFrom: '2026-10-01',
      plannedStartDateTo: '2026-10-31',
    });
    expect(toListQuery({ ...DEFAULT_FILTERS, from: '2026-02-30', to: '20261031' }, 1)).toEqual({
      page: 1,
      size: 25,
    });
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
  });
});
