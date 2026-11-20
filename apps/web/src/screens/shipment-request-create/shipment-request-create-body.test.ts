import { describe, expect, it } from 'vitest';

import { emptyLineDraft } from './line-draft';
import { toShipmentRequestCreateBody } from './shipment-request-create-body';
import type { ShipmentRequestLineDraft } from './types';

const line = (patch: Partial<ShipmentRequestLineDraft>): ShipmentRequestLineDraft => ({
  ...emptyLineDraft(),
  warehouseId: '9101',
  ...patch,
});

const baseInput = {
  businessUnitId: '7001',
  customerId: '8201',
  shipToPartnerId: '8211',
  requestedShipDate: '2026-08-20',
};

describe('toShipmentRequestCreateBody', () => {
  it('지시서 경유 — salesOrderId를 싣는다', () => {
    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'fromOrder',
      salesOrderId: 8101,
      lines: [
        line({
          salesOrderLineId: 8601,
          itemId: '8301',
          requestedQty: '80',
          allocatedQty: '80',
          uomId: '8401',
        }),
      ],
    });

    expect(body?.salesOrderId).toBe(8101);
    expect(body?.businessUnitId).toBe(7001);
    expect(body).not.toHaveProperty('fulfillmentPlantId');
    expect(body?.lines).toEqual([
      {
        salesOrderLineId: 8601,
        itemId: 8301,
        requestedQty: 80,
        allocatedQty: 80,
        uomId: 8401,
        warehouseId: 9101,
        shippingInspectionRequired: false,
      },
    ]);
  });

  it('단독 생성 — salesOrderId를 null로 비운다(계약 설명)', () => {
    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'standalone',
      salesOrderId: null,
      lines: [
        line({
          salesOrderLineId: null,
          itemId: '8301',
          requestedQty: '10',
          allocatedQty: '10',
          uomId: '8401',
        }),
      ],
    });

    expect(body?.salesOrderId).toBeNull();
    expect(body?.lines[0]?.salesOrderLineId).toBeUndefined();
  });

  it('배정 수량이 1 미만인 줄은 뺀다 — 지우는 것이 아니라 이번에 안 나가는 것이다', () => {
    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'standalone',
      salesOrderId: null,
      lines: [
        line({ itemId: '8301', requestedQty: '10', allocatedQty: '10', uomId: '8401' }),
        line({ itemId: '8302', requestedQty: '5', allocatedQty: '0', uomId: '8401' }),
      ],
    });

    expect(body?.lines).toHaveLength(1);
    expect(body?.lines[0]?.itemId).toBe(8301);
  });

  it('보낼 줄이 하나도 남지 않으면 만들지 않는다', () => {
    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'standalone',
      salesOrderId: null,
      lines: [line({ itemId: '8301', requestedQty: '10', allocatedQty: '0', uomId: '8401' })],
    });

    expect(body).toBeNull();
  });

  it('머리 필수 값이 비면 만들지 않는다', () => {
    const body = toShipmentRequestCreateBody({
      businessUnitId: '7001',
      customerId: '',
      shipToPartnerId: '8211',
      requestedShipDate: '2026-08-20',
      mode: 'standalone',
      salesOrderId: null,
      lines: [line({ itemId: '8301', requestedQty: '10', allocatedQty: '10', uomId: '8401' })],
    });

    expect(body).toBeNull();
  });

  it('배정이 요청을 넘는 줄은 그 줄만 빼지 않고 통째로 만들지 않는다', () => {
    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'standalone',
      salesOrderId: null,
      lines: [line({ itemId: '8301', requestedQty: '10', allocatedQty: '11', uomId: '8401' })],
    });

    expect(body).toBeNull();
  });

  /*
   * ⛔ **걷은 두 칸이 본문에 되살아나지 않는다**(사용자 결정 2026-09-18). 계약이 둘 다 선택으로
   *    두어 키가 빠져도 서버는 받는다 — 그래서 실수로 되살려도 서버가 알려 주지 않는다.
   *    여기가 그 자리를 붙드는 유일한 그물이다.
   */
  it('걷은 두 칸을 본문에 싣지 않는다', () => {
    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'standalone',
      salesOrderId: null,
      lines: [
        line({
          itemId: '8301',
          requestedQty: '10',
          allocatedQty: '10',
          uomId: '8401',
        }),
      ],
    });

    expect(body?.lines[0]).not.toHaveProperty('customerLotRequirement');
    expect(body?.lines[0]).not.toHaveProperty('minimumRemainingShelfLifeDays');
  });
});

/* ── 피처 012 — 사업부·줄 출고 창고·나눈 줄 ─────────────────────────────── */

describe('toShipmentRequestCreateBody — 피처 012', () => {
  it('FR-001·FR-003 businessUnitId·lines[].warehouseId 를 싣고 fulfillmentPlantId 는 싣지 않는다', () => {
    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'standalone',
      salesOrderId: null,
      lines: [line({ itemId: '8301', requestedQty: '10', allocatedQty: '10', uomId: '8401', warehouseId: '9102' })],
    });

    expect(body?.businessUnitId).toBe(7001);
    expect(body).not.toHaveProperty('fulfillmentPlantId');
    expect(body?.lines[0]?.warehouseId).toBe(9102);
  });

  it('US1-2 사업부가 비면 만들지 않는다', () => {
    const body = toShipmentRequestCreateBody({
      ...baseInput,
      businessUnitId: '',
      mode: 'standalone',
      salesOrderId: null,
      lines: [line({ itemId: '8301', requestedQty: '10', allocatedQty: '10', uomId: '8401' })],
    });

    expect(body).toBeNull();
  });

  it('US1-6 나갈 줄에 창고가 비면 만들지 않는다 — 일부만 보내지 않는다', () => {
    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'standalone',
      salesOrderId: null,
      lines: [
        line({ itemId: '8301', requestedQty: '10', allocatedQty: '10', uomId: '8401' }),
        line({ itemId: '8302', requestedQty: '5', allocatedQty: '5', uomId: '8401', warehouseId: '' }),
      ],
    });

    expect(body).toBeNull();
  });

  it('US1-5 나눈 줄 — 같은 S/O 줄 두 줄로, 요청 합이 S/O 잔여와 같다(원 줄 = 잔여 − 나눈 줄 배정)', () => {
    const origin = line({
      salesOrderLineId: 8601,
      itemId: '8301',
      requestedQty: '100',
      allocatedQty: '60',
      uomId: '8401',
      warehouseId: '9101',
    });
    const split = line({
      salesOrderLineId: 8601,
      itemId: '8301',
      allocatedQty: '40',
      uomId: '8401',
      warehouseId: '9102',
      splitOf: origin.key,
    });

    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'fromOrder',
      salesOrderId: 8101,
      lines: [origin, split],
    });

    expect(body?.lines).toEqual([
      expect.objectContaining({ salesOrderLineId: 8601, requestedQty: 60, allocatedQty: 60, warehouseId: 9101 }),
      expect.objectContaining({ salesOrderLineId: 8601, requestedQty: 40, allocatedQty: 40, warehouseId: 9102 }),
    ]);
  });

  it('US1-5 원 줄 배정을 덜 잡아도 요청은 잔여에서 나눈 줄을 뺀 값이다', () => {
    const origin = line({
      salesOrderLineId: 8601,
      itemId: '8301',
      requestedQty: '100',
      allocatedQty: '50',
      uomId: '8401',
    });
    const split = line({
      salesOrderLineId: 8601,
      itemId: '8301',
      allocatedQty: '30',
      uomId: '8401',
      warehouseId: '9102',
      splitOf: origin.key,
    });

    const body = toShipmentRequestCreateBody({
      ...baseInput,
      mode: 'fromOrder',
      salesOrderId: 8101,
      lines: [origin, split],
    });

    expect(body?.lines.map((created) => created.requestedQty)).toEqual([70, 30]);
  });
});
