import { describe, expect, it } from 'vitest';

import {
  KIND_FILTERS,
  migrateLegacyParams,
  periodReasonOf,
  readFilters,
  receiptQuery,
  shipmentQuery,
  sourceQuery,
  toSearchParams,
  withKind,
} from './filters';

const params = (query: string) => new URLSearchParams(query);

describe('이력 조회 주소 조건', () => {
  it('빈 주소는 전체, 50건이다', () => {
    const filters = readFilters(params(''));
    expect(filters.kind).toBe('ALL');
    expect(filters.size).toBe(50);
    expect(filters.page).toBe(1);
  });

  it('읽고 쓰면 같은 주소가 된다', () => {
    const query =
      'kind=SHIPMENT&from=2026-10-20&to=2026-10-26&item=7&mlot=A&plot=P&ir=IR-1&wo=WO-1&sh=SH-1&sup=9&cus=4&page=2&size=100';
    expect(toSearchParams(readFilters(params(query))).toString()).toBe(query);
  });

  it('구분 칩: 전체, 자재 입고, 자재 투입, 제품입고, 포장, 제품 출하(공정 순서)', () => {
    expect(KIND_FILTERS).toEqual(['ALL', 'MATERIAL', 'CONSUMED', 'PRODUCT', 'PACKED', 'SHIPMENT']);
  });

  it('구분을 바꾸면 첫 쪽으로 간다', () => {
    const next = withKind(readFilters(params('from=2026-10-20&item=7&page=3')), 'SHIPMENT');
    expect(next).toMatchObject({ kind: 'SHIPMENT', item: '7', page: 1 });
  });
});

describe('탭이 있던 때의 주소', () => {
  it('자재 LOT 탭의 LOT 번호와 고른 LOT은 자재 LOT 번호 조건과 고른 LOT으로 옮긴다', () => {
    expect(
      migrateLegacyParams(params('tab=forward&lot=A|1&selected=101&via=P~201~P-1'))?.toString(),
    ).toBe('mlot=A%7C1&selected=101&via=P%7E201%7EP-1');
  });

  it('제품 LOT 탭의 W/O 번호, 출하번호, 고객은 그 조건으로 옮긴다', () => {
    expect(
      migrateLegacyParams(
        params('tab=backward&wo=WO-1&sh=SH-1&partner=5&from=2026-10-01'),
      )?.toString(),
    ).toBe('from=2026-10-01&sh=SH-1&wo=WO-1&cus=5');
  });

  it('입출고 현황 탭의 구분과 상대는 구분 칩과 공급사 또는 고객으로 옮긴다', () => {
    expect(migrateLegacyParams(params('tab=movements&kind=SHIPMENT&partner=5'))?.toString()).toBe(
      'kind=SHIPMENT&cus=5',
    );
  });

  it('탭 값이 없으면 옮기지 않는다', () => {
    expect(migrateLegacyParams(params('mlot=A'))).toBeNull();
  });
});

describe('구분마다 걸 수 있는 조건', () => {
  const filters = readFilters(params('from=2026-10-20&to=2026-10-26&item=7&sup=9'));

  it('공급사는 자재 입고와 자재 투입만 건다 — 제품입고, 포장, 출하는 빠진다', () => {
    expect(sourceQuery('MATERIAL', filters)).toEqual({ supplierId: 9 });
    expect(sourceQuery('CONSUMED', filters)).toEqual({ supplierId: 9 });
    expect(sourceQuery('PRODUCT', filters)).toBeNull();
    expect(sourceQuery('PACKED', filters)).toBeNull();
    expect(sourceQuery('SHIPMENT', filters)).toBeNull();
  });

  it('자재 LOT 번호는 자재 입고와 자재 투입에, 제품 LOT 번호는 제품입고, 포장, 출하에 건다', () => {
    const material = readFilters(params('mlot=A'));
    expect(sourceQuery('MATERIAL', material)).toEqual({ lotNo: 'A' });
    expect(sourceQuery('CONSUMED', material)).toEqual({ lotNo: 'A' });
    expect(sourceQuery('PRODUCT', material)).toBeNull();
    const product = readFilters(params('plot=P-1'));
    expect(sourceQuery('MATERIAL', product)).toBeNull();
    expect(sourceQuery('PRODUCT', product)).toEqual({ lotNo: 'P-1' });
    expect(sourceQuery('PACKED', product)).toEqual({ lotNo: 'P-1' });
    expect(sourceQuery('SHIPMENT', product)).toEqual({ lotNo: 'P-1' });
  });

  it('W/O 번호는 자재 입고를 빼고 나머지 넷에, 출하번호는 포장과 출하에만 건다', () => {
    const wo = readFilters(params('wo=WO-1'));
    expect(sourceQuery('MATERIAL', wo)).toBeNull();
    expect(sourceQuery('CONSUMED', wo)).toEqual({ workOrderNo: 'WO-1' });
    expect(sourceQuery('PRODUCT', wo)).toEqual({ workOrderNo: 'WO-1' });
    const sh = readFilters(params('sh=SH-1'));
    expect(sourceQuery('PRODUCT', sh)).toBeNull();
    expect(sourceQuery('PACKED', sh)).toEqual({ shipmentNo: 'SH-1' });
    expect(sourceQuery('SHIPMENT', sh)).toEqual({ shipmentNo: 'SH-1' });
  });

  it('번호 조건이 있으면 기간은 선택이고, 없으면 기간 시작이 필요하다', () => {
    expect(periodReasonOf(readFilters(params('mlot=A')))).toBeNull();
    expect(periodReasonOf(readFilters(params('')))).toBe('기간 시작일을 고르세요');
    expect(periodReasonOf(readFilters(params('from=2026-10-20')))).toBeNull();
  });

  it('번호가 있고 기간이 없으면 질의에 기간을 싣지 않는다', () => {
    const material = readFilters(params('mlot=A'));
    expect(receiptQuery('MATERIAL', material, { lotNo: 'A' }, 1, 50)).toEqual({
      receiptTypeCode: 'MATERIAL',
      lotNo: 'A',
      page: 1,
      size: 50,
    });
    expect(shipmentQuery(filters, { customerId: 4 }, 1, 200)).toEqual({
      shipDateFrom: '2026-10-20',
      shipDateTo: '2026-10-26',
      itemId: 7,
      customerId: 4,
      page: 1,
      size: 200,
    });
  });
});
