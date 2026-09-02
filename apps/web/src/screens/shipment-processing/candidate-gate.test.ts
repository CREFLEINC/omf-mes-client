import { describe, expect, it } from 'vitest';

import {
  isCandidateVisible,
  isInspectionPassed,
  isPickingComplete,
  shipmentGateBlockers,
} from './candidate-gate';
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
  it('라인이 없으면 완료가 아니다', () => {
    expect(isPickingComplete([])).toBe(false);
  });

  it('전 라인의 pickedQty가 allocatedQty와 같으면 완료다', () => {
    expect(isPickingComplete([line(), line({ lineNo: 2 })])).toBe(true);
  });

  it('한 라인이라도 어긋나면 미완료다', () => {
    expect(isPickingComplete([line(), line({ lineNo: 2, pickedQty: 80 })])).toBe(false);
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
    expect(shipmentGateBlockers({ lines: null, shippingInspectionStatusCode: 'PENDING' })).toEqual([
      'LINES_UNAVAILABLE',
    ]);
  });

  it('전부 통과하면 빈 배열이다', () => {
    expect(
      shipmentGateBlockers({ lines: [line()], shippingInspectionStatusCode: 'PASSED' }),
    ).toEqual([]);
  });

  it('피킹 미완료와 검사 미완료를 함께 낸다', () => {
    expect(
      shipmentGateBlockers({
        lines: [line({ pickedQty: 50 })],
        shippingInspectionStatusCode: 'PENDING',
      }),
    ).toEqual(['PICKING_INCOMPLETE', 'INSPECTION_NOT_PASSED']);
  });
});

describe('isCandidateVisible', () => {
  const complete = { lines: [line()], shippingInspectionStatusCode: 'PASSED' as const };
  const incomplete = {
    lines: [line({ pickedQty: 0 })],
    shippingInspectionStatusCode: 'PASSED' as const,
  };
  const unavailable = { lines: null, shippingInspectionStatusCode: 'PASSED' as const };

  it('체크가 꺼져 있으면 전부 보인다', () => {
    expect(isCandidateVisible(incomplete, false)).toBe(true);
    expect(isCandidateVisible(unavailable, false)).toBe(true);
  });

  it('체크가 켜져 있으면 피킹완료만 보인다', () => {
    expect(isCandidateVisible(complete, true)).toBe(true);
    expect(isCandidateVisible(incomplete, true)).toBe(false);
    expect(isCandidateVisible(unavailable, true)).toBe(false);
  });
});
