import { describe, expect, it } from 'vitest';

import { EMPTY_LOADING_INFO_DRAFT, type LoadingInfoDraft } from './loading-info-pane';
import type { LineAllocationDraft } from './line-allocation-draft';
import { toShipmentCreatePayload } from './shipment-request-payload';

const balancedLine = (overrides: Partial<LineAllocationDraft> = {}): LineAllocationDraft => ({
  shipmentRequestLineId: 701,
  lineNo: 1,
  itemId: 910001,
  uomId: 920001,
  requestedQty: 100,
  allocatedQty: 100,
  pickedQty: 100,
  shippedQty: '100',
  allocations: [{ draftId: 'a', lotId: 1001, qty: '100' }],
  ...overrides,
});

const loadingInfo = (overrides: Partial<LoadingInfoDraft> = {}): LoadingInfoDraft => ({
  ...EMPTY_LOADING_INFO_DRAFT,
  ...overrides,
});

/* 현지 시각으로 만든다 — 영업일은 단말의 현지 날짜이고 오프셋은 실행 환경을 따른다. */
const NOW = new Date(2026, 8, 3, 17, 5, 0);

describe('toShipmentCreatePayload', () => {
  it('창고가 없으면 null을 낸다', () => {
    expect(
      toShipmentCreatePayload({
        now: NOW,
        shipmentRequestId: 501,
        warehouseId: null,
        loadingInfo: loadingInfo(),
        lineDrafts: [balancedLine()],
      }),
    ).toBeNull();
  });

  it('라인이 없으면 null을 낸다', () => {
    expect(
      toShipmentCreatePayload({
        now: NOW,
        shipmentRequestId: 501,
        warehouseId: 1001,
        loadingInfo: loadingInfo(),
        lineDrafts: [],
      }),
    ).toBeNull();
  });

  it('한 라인이라도 어긋나면 null을 낸다', () => {
    expect(
      toShipmentCreatePayload({
        now: NOW,
        shipmentRequestId: 501,
        warehouseId: 1001,
        loadingInfo: loadingInfo(),
        lineDrafts: [balancedLine(), balancedLine({ shipmentRequestLineId: 702, shippedQty: '' })],
      }),
    ).toBeNull();
  });

  it('전부 유효하면 ShipmentCreate를 낸다 — expedited는 항상 false', () => {
    const payload = toShipmentCreatePayload({
      now: NOW,
      shipmentRequestId: 501,
      warehouseId: 1001,
      loadingInfo: loadingInfo(),
      lineDrafts: [balancedLine()],
    });

    expect(payload).toEqual({
      shipmentRequestId: 501,
      warehouseId: 1001,
      vehicleNo: undefined,
      driverName: undefined,
      sealNo: undefined,
      transportDocumentNo: undefined,
      loadingWorkerId: undefined,
      carrierId: undefined,
      expedited: false,
      businessDate: '2026-09-03',
      occurredAt: expect.stringMatching(
        /^2026-09-03T17:05:00[+-]\d{2}:\d{2}$/,
      ) as unknown as string,
      lines: [
        {
          shipmentRequestLineId: 701,
          shippedQty: 100,
          uomId: 920001,
          allocations: [{ lotId: 1001, allocatedQty: 100, uomId: 920001 }],
        },
      ],
    });
  });

  it('빈 문자열 상차정보는 싣지 않고, 값이 있으면 다듬어 싣는다', () => {
    const payload = toShipmentCreatePayload({
      now: NOW,
      shipmentRequestId: 501,
      warehouseId: 1001,
      loadingInfo: loadingInfo({
        vehicleNo: '  12가3456  ',
        driverName: 'Synthetic Driver',
        loadingWorkerId: '801',
        carrierId: '901',
      }),
      lineDrafts: [balancedLine()],
    });

    expect(payload?.vehicleNo).toBe('12가3456');
    expect(payload?.driverName).toBe('Synthetic Driver');
    expect(payload?.loadingWorkerId).toBe(801);
    expect(payload?.carrierId).toBe(901);
  });

  it('여러 라인·여러 LOT 배분을 그대로 옮긴다', () => {
    const payload = toShipmentCreatePayload({
      now: NOW,
      shipmentRequestId: 501,
      warehouseId: 1001,
      loadingInfo: loadingInfo(),
      lineDrafts: [
        balancedLine({
          shippedQty: '100',
          allocations: [
            { draftId: 'a', lotId: 1001, qty: '40' },
            { draftId: 'b', lotId: 1002, qty: '60' },
          ],
        }),
        balancedLine({ shipmentRequestLineId: 702, lineNo: 2 }),
      ],
    });

    expect(payload?.lines).toHaveLength(2);
    expect(payload?.lines[0]?.allocations).toHaveLength(2);
  });
});
