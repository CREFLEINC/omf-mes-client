import { describe, expect, it } from 'vitest';

import {
  readFilters,
  receiptCountQuery,
  receiptQuery,
  shipmentQuery,
  toSearchParams,
  withKind,
} from './filters';

const params = (query: string) => new URLSearchParams(query);

describe('입출고 현황 주소 조건', () => {
  it('빈 주소는 자재 입고, 50건이다', () => {
    const filters = readFilters(params(''));
    expect(filters.kind).toBe('MATERIAL');
    expect(filters.size).toBe(50);
    expect(filters.page).toBe(1);
  });

  it('읽고 쓰면 같은 주소가 된다', () => {
    const query =
      'tab=movements&kind=SHIPMENT&from=2026-10-20&to=2026-10-26&item=7&wh=3&partner=9&status=CONFIRMED&page=2&size=100';
    expect(toSearchParams(readFilters(params(query))).toString()).toBe(query);
  });

  it('생산 입고에는 공급사, 고객 조건이 없다 — 주소에 있어도 버린다', () => {
    expect(readFilters(params('kind=PRODUCT&from=2026-10-20&partner=9')).partner).toBe('');
  });

  it('구분을 바꾸면 공급사, 고객과 상태를 비우고 첫 쪽으로 간다', () => {
    const filters = readFilters(params('from=2026-10-20&item=7&partner=9&status=POSTED&page=3'));
    const next = withKind(filters, 'SHIPMENT');
    expect(next).toMatchObject({ kind: 'SHIPMENT', item: '7', partner: '', status: '', page: 1 });
  });
});

describe('입출고 현황 질의', () => {
  const filters = readFilters(
    params('from=2026-10-20&to=2026-10-26&item=7&wh=3&partner=9&status=POSTED&page=2'),
  );

  it('입고 줄은 구분을 입고 유형으로, 상대를 공급사로 보낸다', () => {
    expect(receiptQuery(filters, 2, 50)).toEqual({
      receiptTypeCode: 'MATERIAL',
      receiptDateFrom: '2026-10-20',
      receiptDateTo: '2026-10-26',
      itemId: 7,
      warehouseId: 3,
      supplierId: 9,
      statusCode: 'POSTED',
      page: 2,
      size: 50,
    });
  });

  it('출하 줄은 상대를 고객으로 보낸다', () => {
    const shipment = withKind(filters, 'SHIPMENT');
    expect(shipmentQuery({ ...shipment, partner: '4' }, 1, 200)).toEqual({
      shipDateFrom: '2026-10-20',
      shipDateTo: '2026-10-26',
      itemId: 7,
      warehouseId: 3,
      customerId: 4,
      page: 1,
      size: 200,
    });
  });

  it('칩 건수는 공통 조건(기간, 품목, 창고)만 건다', () => {
    expect(receiptCountQuery(filters)).toEqual({
      receiptDateFrom: '2026-10-20',
      receiptDateTo: '2026-10-26',
      itemId: 7,
      warehouseId: 3,
      page: 1,
      size: 1,
    });
  });
});
