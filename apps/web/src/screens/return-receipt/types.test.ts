import { describe, expect, it } from 'vitest';

import { lotFixture, shipmentFixture } from './fixtures';
import { toLotLineSource, toReturnLineSources, toShipmentRow } from './types';

describe('toShipmentRow', () => {
  it('라인이 오면 품목 요약과 배분 LOT 을 든다', () => {
    const row = toShipmentRow(shipmentFixture());

    expect(row.shippedAtText).toBe('2026-08-28');
    expect(row.itemSummary).toBe('SYN-FG-1 · 300');
    expect(row.lots).toEqual([
      { lotId: 8301, lotNo: 'LOT-TEST-0311', itemCode: 'SYN-FG-1', qty: 180 },
      { lotId: 8302, lotNo: 'LOT-TEST-0305', itemCode: 'SYN-FG-1', qty: 120 },
    ]);
  });

  /* 목록 응답에 라인이 없으면 「없다」가 아니라 «모른다»다 — 빈 배열로 접지 않는다. */
  it('라인이 없으면 요약도 LOT 도 null 이다', () => {
    const row = toShipmentRow(shipmentFixture({ lines: undefined }));

    expect(row.itemSummary).toBeNull();
    expect(row.lots).toBeNull();
  });

  it('배분이 빠진 라인이 하나라도 있으면 LOT 은 모른다', () => {
    const shipment = shipmentFixture();
    const line = shipment.lines?.[0];
    const row = toShipmentRow(
      shipmentFixture({ lines: line === undefined ? [] : [{ ...line, allocations: undefined }] }),
    );

    expect(row.itemSummary).toBe('2003 · 300');
    expect(row.lots).toBeNull();
  });
});

describe('toReturnLineSources — 배분 한 줄이 반품 라인 한 줄이다', () => {
  it('배분 번호·LOT·출하 수량을 든다', () => {
    const sources = toReturnLineSources(shipmentFixture());

    expect(sources.map((source) => source.key)).toEqual(['alloc:9921', 'alloc:9922']);
    expect(sources[0]).toMatchObject({
      allocationId: 9921,
      itemId: 2003,
      itemCode: 'SYN-FG-1',
      lotId: 8301,
      lotNo: 'LOT-TEST-0311',
      uomId: 7001,
      shippedQty: 180,
    });
  });

  it('직접 찾은 LOT 은 배분이 없고 상한도 없다', () => {
    expect(toLotLineSource(lotFixture())).toEqual({
      key: 'lot:8309',
      allocationId: null,
      itemId: 2004,
      itemCode: null,
      lotId: 8309,
      lotNo: 'LOT-TEST-0199',
      uomId: 7001,
      shippedQty: null,
    });
  });
});
