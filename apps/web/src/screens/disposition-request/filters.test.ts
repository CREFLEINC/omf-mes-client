import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  hasSelection,
  readFilters,
  readPage,
  readSelection,
  toAppliedSearchParams,
  toListQuery,
  withSelection,
} from './filters';

describe('readFilters — 주소가 조건의 정본이다', () => {
  it('주소 키를 조건으로 옮긴다', () => {
    const params = new URLSearchParams('wh=1003&src=RETURN&st=NONE&q=LOT-TEST');

    expect(readFilters(params)).toEqual({
      warehouseId: '1003',
      sourceCode: 'RETURN',
      stage: 'NONE',
      q: 'LOT-TEST',
    });
  });

  /* 손으로 고친 주소가 서버 400을 만들지 않게 — 허용 목록 밖은 «없음»으로 읽는다. */
  it('허용 목록 밖의 원천·상태와 식별자가 아닌 창고는 비운다', () => {
    const params = new URLSearchParams('wh=abc&src=REPAIR&st=SOMETHING');

    expect(readFilters(params)).toEqual(EMPTY_FILTERS);
  });

  it('쪽은 1 이상의 정수만 읽는다', () => {
    expect(readPage(new URLSearchParams('page=3'))).toBe(3);
    expect(readPage(new URLSearchParams('page=0'))).toBe(1);
    expect(readPage(new URLSearchParams('page=x'))).toBe(1);
  });
});

describe('toListQuery — 상태가 소스를 가른다', () => {
  it('상태가 비면 판정 대상 목록이고 검색어·창고·원천을 싣는다', () => {
    expect(
      toListQuery({ warehouseId: '1003', sourceCode: 'RETURN', stage: '', q: 'LOT' }, 2),
    ).toEqual({
      source: 'candidates',
      query: { sourceCode: 'RETURN', warehouseId: 1003, q: 'LOT', page: 2 },
    });
  });

  it('「부적합 없음」은 서버 축으로 거른다 — 화면이 응답을 거르지 않는다', () => {
    expect(toListQuery({ ...EMPTY_FILTERS, stage: 'NONE' }, 1)).toEqual({
      source: 'candidates',
      query: { withoutNonconformanceOnly: true },
    });
  });

  it('부적합 상태 셋은 부적합 목록으로 소스가 바뀌고 검색어는 싣지 않는다', () => {
    expect(
      toListQuery({ warehouseId: '', sourceCode: 'PRODUCT', stage: 'PENDING_DECISION', q: 'x' }, 1),
    ).toEqual({
      source: 'nonconformances',
      query: { statusCode: 'PENDING_DECISION', sourceCode: 'PRODUCT' },
    });
  });

  it('첫 쪽이면 page 를 싣지 않는다', () => {
    expect(toListQuery(EMPTY_FILTERS, 1).query).not.toHaveProperty('page');
  });
});

describe('선택 — LOT 과 부적합 중 있는 것만 든다', () => {
  it('둘 다 없으면 고른 것이 없다', () => {
    const selection = readSelection(new URLSearchParams(''));

    expect(selection).toEqual({ lotId: null, nonconformanceId: null });
    expect(hasSelection(selection)).toBe(false);
  });

  it('주소에 심고 다시 읽으면 같다', () => {
    const next = withSelection(new URLSearchParams('wh=1003'), {
      lotId: 8201,
      nonconformanceId: 7009,
    });

    expect(next.get('wh')).toBe('1003');
    expect(readSelection(next)).toEqual({ lotId: 8201, nonconformanceId: 7009 });
  });

  it('조건을 적용하면 고른 것은 지운다 — 새 목록에 없을 수 있다', () => {
    const current = new URLSearchParams('lot=8201&nonconformanceId=7009&page=2');
    const next = toAppliedSearchParams(current, { ...EMPTY_FILTERS, stage: 'DECIDED' }, 1);

    expect(next.get('st')).toBe('DECIDED');
    expect(next.has('lot')).toBe(false);
    expect(next.has('nonconformanceId')).toBe(false);
    expect(next.has('page')).toBe(false);
  });
});
