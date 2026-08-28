import { describe, expect, it } from 'vitest';

import { toLineQtyTotals, toShipmentRequestView } from './types';

const LINE = {
  shipmentRequestLineId: 1,
  lineNo: 1,
  itemId: 9301,
  requestedQty: 100,
  allocatedQty: 80,
  pickedQty: 40,
  shippedQty: 20,
  uomId: 9501,
  shippingInspectionRequired: false,
};

const RESPONSE = {
  shipmentRequestId: 1001,
  shipmentRequestNo: 'SR-2026-0001',
  customerId: 9101,
  shipToPartnerId: 9201,
  requestedShipDate: '2026-08-13',
  statusCode: 'SAMPLE_STATUS_A',
  shippingInspectionStatusCode: 'NOT_REQUIRED' as const,
  lines: [LINE],
};

describe('toLineQtyTotals', () => {
  it('여러 라인의 세 수량을 각각 더한다', () => {
    expect(
      toLineQtyTotals([
        LINE,
        { ...LINE, shipmentRequestLineId: 2, requestedQty: 50, allocatedQty: 50, shippedQty: 0 },
      ]),
    ).toEqual({ requestedQty: 150, allocatedQty: 130, shippedQty: 20 });
  });

  /* 0/0/0을 내지 않는다 — 「수량이 0」과 「받지 못했다」가 같은 모양이 되면 안 된다. */
  it('lines가 없으면 null이다', () => {
    expect(toLineQtyTotals(undefined)).toBeNull();
  });

  it('lines가 빈 배열이어도 null이다', () => {
    expect(toLineQtyTotals([])).toBeNull();
  });

  it('수량 0인 라인은 합계에 그대로 반영된다', () => {
    expect(toLineQtyTotals([{ ...LINE, requestedQty: 0, allocatedQty: 0, shippedQty: 0 }])).toEqual(
      {
        requestedQty: 0,
        allocatedQty: 0,
        shippedQty: 0,
      },
    );
  });
});

describe('toShipmentRequestView', () => {
  it('필수 필드를 그대로 옮기고 라인 합계를 계산한다', () => {
    expect(toShipmentRequestView(RESPONSE)).toEqual({
      shipmentRequestId: 1001,
      shipmentRequestNo: 'SR-2026-0001',
      customerId: 9101,
      shipToPartnerId: 9201,
      requestedShipDate: '2026-08-13',
      statusCode: 'SAMPLE_STATUS_A',
      inspectionStatus: 'NOT_REQUIRED',
      lineTotals: { requestedQty: 100, allocatedQty: 80, shippedQty: 20 },
    });
  });

  it('검사 상태 값을 서버가 낸 그대로 옮긴다 — 화면이 라인을 다시 순회해 판정하지 않는다', () => {
    expect(
      toShipmentRequestView({ ...RESPONSE, shippingInspectionStatusCode: 'REJECTED' })
        .inspectionStatus,
    ).toBe('REJECTED');
  });

  it('lines가 없어도 검사 상태는 응답 값 그대로다 — 합계만 null이 된다', () => {
    const { lines: _lines, ...withoutLines } = RESPONSE;

    expect(toShipmentRequestView(withoutLines)).toMatchObject({
      inspectionStatus: 'NOT_REQUIRED',
      lineTotals: null,
    });
  });
});
