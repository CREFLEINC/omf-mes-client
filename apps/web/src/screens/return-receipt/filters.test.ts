import { describe, expect, it } from 'vitest';

import {
  defaultPeriod,
  isUsable,
  readFilters,
  readPage,
  readSelection,
  toAppliedSearchParams,
  toListQuery,
  withSelection,
} from './filters';

const today = new Date(2026, 8, 3);

describe('readFilters — 주소가 조건의 정본이다', () => {
  it('주소에 기간이 없으면 최근 한 달이다', () => {
    expect(readFilters(new URLSearchParams(''), today)).toEqual({
      customerId: '',
      from: '2026-08-03',
      to: '2026-09-03',
      q: '',
    });
    expect(defaultPeriod(today)).toEqual({ from: '2026-08-03', to: '2026-09-03' });
  });

  it('주소 키를 조건으로 옮기고 식별자가 아닌 고객은 비운다', () => {
    expect(
      readFilters(new URLSearchParams('cust=4002&from=2026-08-01&to=2026-08-07&q=SH-'), today),
    ).toEqual({ customerId: '4002', from: '2026-08-01', to: '2026-08-07', q: 'SH-' });
    expect(readFilters(new URLSearchParams('cust=abc'), today).customerId).toBe('');
  });

  it('쪽은 1 이상의 정수만 읽는다', () => {
    expect(readPage(new URLSearchParams('page=2'))).toBe(2);
    expect(readPage(new URLSearchParams('page=0'))).toBe(1);
  });
});

describe('toListQuery — 기간 없이는 부르지 않는다', () => {
  it('기간·고객·검색어·쪽을 싣는다', () => {
    expect(
      toListQuery({ customerId: '4002', from: '2026-08-01', to: '2026-08-07', q: ' SH-1 ' }, 2),
    ).toEqual({
      shipDateFrom: '2026-08-01',
      shipDateTo: '2026-08-07',
      customerId: 4002,
      q: 'SH-1',
      page: 2,
    });
  });

  it('기간이 뒤집히거나 없는 날이면 null 이다', () => {
    expect(isUsable({ customerId: '', from: '2026-08-07', to: '2026-08-01', q: '' })).toBe(false);
    expect(toListQuery({ customerId: '', from: '2026-02-31', to: '2026-03-01', q: '' }, 1)).toBe(
      null,
    );
  });

  it('첫 쪽이면 page 를 싣지 않는다', () => {
    expect(
      toListQuery({ customerId: '', from: '2026-08-01', to: '2026-08-07', q: '' }, 1),
    ).not.toHaveProperty('page');
  });
});

describe('선택 — 원 출하 또는 직접 입력', () => {
  it('shipment 와 mode=direct 를 읽는다', () => {
    expect(readSelection(new URLSearchParams(''))).toEqual({ kind: 'none' });
    expect(readSelection(new URLSearchParams('shipment=9901'))).toEqual({
      kind: 'shipment',
      shipmentId: 9901,
    });
    expect(readSelection(new URLSearchParams('mode=direct&shipment=9901'))).toEqual({
      kind: 'direct',
    });
  });

  it('선택을 바꾸면 앞 선택은 지운다', () => {
    const direct = withSelection(new URLSearchParams('shipment=9901'), { kind: 'direct' });
    expect(direct.has('shipment')).toBe(false);
    expect(direct.get('mode')).toBe('direct');

    const none = withSelection(direct, { kind: 'none' });
    expect(none.toString()).toBe('');
  });

  it('조건을 적용하면 고른 출하는 지우고 직접 입력 모드는 남긴다', () => {
    const next = toAppliedSearchParams(
      new URLSearchParams('shipment=9901&mode=direct&page=3'),
      { customerId: '', from: '2026-08-01', to: '2026-08-07', q: '' },
      1,
    );

    expect(next.has('shipment')).toBe(false);
    expect(next.get('mode')).toBe('direct');
    expect(next.has('page')).toBe(false);
    expect(next.get('from')).toBe('2026-08-01');
  });
});
