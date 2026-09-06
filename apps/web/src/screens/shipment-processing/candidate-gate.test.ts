import { describe, expect, it } from 'vitest';

import { isInspectionPassed, isPickingComplete, shipmentGateBlockers } from './candidate-gate';
import type { ShipmentRequestLineCandidate } from './types';

const line = (
  overrides: Partial<ShipmentRequestLineCandidate> = {},
): ShipmentRequestLineCandidate => ({
  shipmentRequestLineId: 701,
  lineNo: 1,
  itemId: 910001,
  requestedQty: 100,
  allocatedQty: 100,
  pickedQty: 100,
  shippedQty: 0,
  uomId: 920001,
  shippingInspectionRequired: true,
  ...overrides,
});

describe('isPickingComplete', () => {
  it.each(['PICKED', 'PARTIALLY_SHIPPED', 'SHIPPED'] as const)(
    '%s는 피킹 완료다',
    (progressCode) => {
      expect(isPickingComplete(progressCode)).toBe(true);
    },
  );

  it.each(['NOT_ALLOCATED', 'PARTIALLY_ALLOCATED', 'PICKING'] as const)(
    '%s는 피킹 미완료다',
    (progressCode) => {
      expect(isPickingComplete(progressCode)).toBe(false);
    },
  );

  it('라인 수량과 무관하게 서버 롤업 값만 본다', () => {
    expect(isPickingComplete('PICKED')).toBe(true);
    expect(isPickingComplete('PICKING')).toBe(false);
  });
});

describe('isInspectionPassed', () => {
  it('PASSED·NOT_REQUIRED만 통과다', () => {
    expect(isInspectionPassed('PASSED')).toBe(true);
    expect(isInspectionPassed('NOT_REQUIRED')).toBe(true);
    expect(isInspectionPassed('PENDING')).toBe(false);
    expect(isInspectionPassed('REJECTED')).toBe(false);
    expect(isInspectionPassed('HELD')).toBe(false);
  });
});

describe('shipmentGateBlockers', () => {
  it('lines가 null이면 LINES_UNAVAILABLE 하나만 낸다', () => {
    expect(
      shipmentGateBlockers({
        lines: null,
        shipmentProgressCode: 'PICKED',
        shippingInspectionStatusCode: 'PENDING',
      }),
    ).toEqual(['LINES_UNAVAILABLE']);
  });

  it('전부 통과하면 빈 배열이다', () => {
    expect(
      shipmentGateBlockers({
        lines: [line()],
        shipmentProgressCode: 'PICKED',
        shippingInspectionStatusCode: 'PASSED',
      }),
    ).toEqual([]);
  });

  it('피킹 미완료와 검사 미완료를 함께 낸다', () => {
    expect(
      shipmentGateBlockers({
        lines: [line()],
        shipmentProgressCode: 'PICKING',
        shippingInspectionStatusCode: 'PENDING',
      }),
    ).toEqual(['PICKING_INCOMPLETE', 'INSPECTION_NOT_PASSED']);
  });
});
