import { describe, expect, it } from 'vitest';

import { emptyLineDraft } from './line-draft';
import { toShipmentRequestCreateBody } from './shipment-request-create-body';
import type { ShipmentRequestLineDraft } from './types';

const line = (patch: Partial<ShipmentRequestLineDraft>): ShipmentRequestLineDraft => ({
  ...emptyLineDraft(),
  ...patch,
});

const baseInput = {
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
    expect(body?.lines).toEqual([
      {
        salesOrderLineId: 8601,
        itemId: 8301,
        requestedQty: 80,
        allocatedQty: 80,
        uomId: 8401,
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

  it('선택 필드(고객 LOT 요구·잔여 유효기간)는 비면 키를 싣지 않는다', () => {
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
          customerLotRequirement: '',
          minimumRemainingShelfLifeDays: '',
        }),
      ],
    });

    expect(body?.lines[0]).not.toHaveProperty('customerLotRequirement');
    expect(body?.lines[0]).not.toHaveProperty('minimumRemainingShelfLifeDays');
  });
});
