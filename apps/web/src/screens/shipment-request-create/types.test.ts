import { describe, expect, it } from 'vitest';

import {
  salesOrderDetailFixture,
  salesOrderListFixtures,
  createdShipmentRequestFixture,
} from './fixtures';
import { toCreatedShipmentRequestView, toSalesOrderDetailView, toSalesOrderView } from './types';

describe('toSalesOrderView', () => {
  it('목록 응답 한 건을 화면 타입으로 옮긴다', () => {
    const view = toSalesOrderView(salesOrderListFixtures[0]!);

    expect(view).toEqual({
      salesOrderId: 8101,
      salesOrderNo: 'SAMPLE-SO-0001',
      customerId: 8201,
      shipToPartnerId: 8211,
      orderDate: '2026-08-10',
      statusCode: 'SAMPLE_SO_S_A',
    });
  });
});

describe('toSalesOrderDetailView', () => {
  it('라인을 함께 옮긴다', () => {
    const view = toSalesOrderDetailView(salesOrderDetailFixture);

    expect(view.lines).toHaveLength(2);
    expect(view.lines[0]).toEqual({
      salesOrderLineId: 8601,
      itemId: 8301,
      orderedQty: 100,
      uomId: 8401,
      shippedQty: 20,
    });
  });

  it('lines가 없으면 빈 배열이다', () => {
    const view = toSalesOrderDetailView({ ...salesOrderDetailFixture, lines: undefined });

    expect(view.lines).toEqual([]);
  });
});

describe('toCreatedShipmentRequestView', () => {
  it('업무 번호·상태·라인 수를 옮긴다', () => {
    const view = toCreatedShipmentRequestView(createdShipmentRequestFixture);

    expect(view).toEqual({
      shipmentRequestNo: 'SAMPLE-SR-0001',
      statusCode: 'SAMPLE_SR_S_A',
      lineCount: 1,
    });
  });

  it('lines가 없으면 라인 수를 0으로 낸다 — 지어내지 않는다', () => {
    const view = toCreatedShipmentRequestView({
      ...createdShipmentRequestFixture,
      lines: undefined,
    });

    expect(view.lineCount).toBe(0);
  });
});
