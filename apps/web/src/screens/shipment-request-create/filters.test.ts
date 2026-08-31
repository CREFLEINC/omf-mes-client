import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  readFilters,
  readPage,
  readTarget,
  targetModeOf,
  toSearchParams,
  toSourceFilterQuery,
} from './filters';

describe('readFilters', () => {
  it('빈 주소는 빈 조건이다', () => {
    expect(readFilters(new URLSearchParams())).toEqual(EMPTY_FILTERS);
  });

  it('조건을 읽는다', () => {
    const params = new URLSearchParams(
      'customer=8201&from=2026-08-01&to=2026-08-31&unassigned=true',
    );

    expect(readFilters(params)).toEqual({
      customer: '8201',
      orderDateFrom: '2026-08-01',
      orderDateTo: '2026-08-31',
      unassignedOnly: true,
    });
  });

  it('0이나 음수 같은 자원 번호가 아닌 값은 버린다', () => {
    expect(readFilters(new URLSearchParams('customer=0')).customer).toBe('');
    expect(readFilters(new URLSearchParams('customer=-1')).customer).toBe('');
  });
});

describe('readPage', () => {
  it('없으면 1쪽이다', () => {
    expect(readPage(new URLSearchParams())).toBe(1);
  });

  it('이상한 값은 1쪽으로 본다', () => {
    expect(readPage(new URLSearchParams('page=abc'))).toBe(1);
    expect(readPage(new URLSearchParams('page=0'))).toBe(1);
  });

  it('정수 쪽 번호를 읽는다', () => {
    expect(readPage(new URLSearchParams('page=3'))).toBe(3);
  });
});

describe('readTarget', () => {
  it('아무것도 없으면 none이다', () => {
    expect(readTarget(new URLSearchParams())).toEqual({ kind: 'none' });
  });

  it('so가 있으면 지시서 경유다', () => {
    expect(readTarget(new URLSearchParams('so=8101'))).toEqual({
      kind: 'order',
      salesOrderId: 8101,
      mode: 'fromOrder',
    });
  });

  it('so 없이 mode=new면 단독 생성이다', () => {
    expect(readTarget(new URLSearchParams('mode=new'))).toEqual({
      kind: 'standalone',
      mode: 'standalone',
    });
  });

  it('so가 있으면 mode를 무시한다 — 지시서 경유가 앞선다', () => {
    expect(readTarget(new URLSearchParams('so=8101&mode=new'))).toEqual({
      kind: 'order',
      salesOrderId: 8101,
      mode: 'fromOrder',
    });
  });
});

describe('targetModeOf', () => {
  it('none은 모드가 없다', () => {
    expect(targetModeOf({ kind: 'none' })).toBeNull();
  });

  it('order는 fromOrder다', () => {
    expect(targetModeOf({ kind: 'order', salesOrderId: 1, mode: 'fromOrder' })).toBe('fromOrder');
  });
});

describe('toSearchParams', () => {
  it('빈 조건은 키를 두지 않는다', () => {
    const params = toSearchParams(EMPTY_FILTERS, 1, { kind: 'none' });

    expect(params.toString()).toBe('');
  });

  it('조건·쪽·대상을 함께 싣는다', () => {
    const params = toSearchParams(
      { customer: '8201', orderDateFrom: '2026-08-01', orderDateTo: '', unassignedOnly: true },
      2,
      { kind: 'order', salesOrderId: 8101, mode: 'fromOrder' },
    );

    expect(params.get('customer')).toBe('8201');
    expect(params.get('from')).toBe('2026-08-01');
    expect(params.get('to')).toBeNull();
    expect(params.get('unassigned')).toBe('true');
    expect(params.get('page')).toBe('2');
    expect(params.get('so')).toBe('8101');
  });

  it('단독 생성은 mode=new를 싣고 so는 싣지 않는다', () => {
    const params = toSearchParams(EMPTY_FILTERS, 1, { kind: 'standalone', mode: 'standalone' });

    expect(params.get('mode')).toBe('new');
    expect(params.get('so')).toBeNull();
  });

  it('첫 쪽은 page 키를 두지 않는다', () => {
    const params = toSearchParams(EMPTY_FILTERS, 1, { kind: 'none' });

    expect(params.get('page')).toBeNull();
  });
});

describe('toSourceFilterQuery', () => {
  it('채운 조건만 싣는다', () => {
    expect(toSourceFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('고객 번호를 숫자로 옮긴다', () => {
    expect(toSourceFilterQuery({ ...EMPTY_FILTERS, customer: '8201' })).toEqual({
      customerId: 8201,
    });
  });

  it('미편성만이 꺼져 있으면 키 자체를 싣지 않는다', () => {
    expect(toSourceFilterQuery({ ...EMPTY_FILTERS, unassignedOnly: false })).not.toHaveProperty(
      'unassignedOnly',
    );
  });
});
