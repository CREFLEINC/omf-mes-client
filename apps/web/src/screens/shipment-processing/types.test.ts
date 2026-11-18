import { describe, expect, it } from 'vitest';

import { toShipmentRequestCandidate, toShipmentRequestLineCandidate } from './types';

const line = (overrides: Partial<Parameters<typeof toShipmentRequestLineCandidate>[0]> = {}) => ({
  shipmentRequestLineId: 701,
  lineNo: 1,
  itemId: 910001,
  requestedQty: 120,
  allocatedQty: 120,
  pickedQty: 120,
  shippedQty: 0,
  uomId: 920001,
  shippingInspectionRequired: true,
  /* client#601 1-5 — 집은 LOT 신설. 이 시험은 아직 이 값을 읽지 않는다. */
  picks: [],
  /* 피처 010 — 초과·피킹 LOT 행. 이 시험은 아직 이 값을 읽지 않는다. */
  overQty: 0,
  lots: [],
  ...overrides,
});

const request = (overrides: Partial<Parameters<typeof toShipmentRequestCandidate>[0]> = {}) => ({
  shipmentRequestId: 501,
  shipmentRequestNo: 'SYN-SR-501',
  customerId: 601,
  shipToPartnerId: 602,
  requestedShipDate: '2026-08-31',
  statusCode: 'SYN-STATUS',
  shipmentProgressCode: 'PICKED' as const,
  shippingInspectionStatusCode: 'PASSED' as const,
  lines: [],
  /* 피처 010 — 지시서 코드·피킹 창고·교체·막힘·판정 요약·완료 출하. 이 시험은 아직 읽지 않는다. */
  code: 'SHPREQ:SYN',
  pickingWarehouses: [],
  replacementCount: 0,
  completionBlockers: [],
  blockerSummary: {},
  lotJudgmentSummary: { notInspected: 0, accepted: 0, rejected: 0, held: 0 },
  completedShipment: null,
  ...overrides,
});

describe('toShipmentRequestLineCandidate', () => {
  it('옮긴다 — 필드 1:1', () => {
    expect(toShipmentRequestLineCandidate(line())).toEqual({
      shipmentRequestLineId: 701,
      lineNo: 1,
      itemId: 910001,
      requestedQty: 120,
      allocatedQty: 120,
      pickedQty: 120,
      shippedQty: 0,
      uomId: 920001,
      shippingInspectionRequired: true,
      pickedLots: [],
    });
  });
});

describe('toShipmentRequestCandidate', () => {
  it('lines가 없으면 null로 낸다 — 판정 불가와 빈 배열을 가른다', () => {
    const payload = request();
    Reflect.deleteProperty(payload, 'lines');
    const candidate = toShipmentRequestCandidate(payload);

    expect(candidate.lines).toBeNull();
  });

  it('서버가 계산한 출하 진행 상태를 그대로 옮긴다', () => {
    const candidate = toShipmentRequestCandidate(
      request({ shipmentProgressCode: 'PARTIALLY_SHIPPED' }),
    );

    expect(candidate.shipmentProgressCode).toBe('PARTIALLY_SHIPPED');
  });

  it('lines가 빈 배열이면 빈 배열 그대로 낸다', () => {
    const candidate = toShipmentRequestCandidate(request({ lines: [] }));

    expect(candidate.lines).toEqual([]);
  });

  it('lines가 있으면 라인마다 옮긴다', () => {
    const candidate = toShipmentRequestCandidate(request({ lines: [line(), line({ lineNo: 2 })] }));

    expect(candidate.lines).toHaveLength(2);
    expect(candidate.lines?.[1]?.lineNo).toBe(2);
  });
});
