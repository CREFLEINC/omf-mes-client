import { describe, expect, it } from 'vitest';

import { lineForItem, remainingQtyOf, type ShipmentRequestTarget } from './types';

const line = (overrides = {}) => ({
  shipmentRequestLineId: 4001,
  lineNo: 1,
  itemId: 5001,
  allocatedQty: 500,
  shippedQty: 200,
  uomId: 7001,
  ...overrides,
});

const target = (lines: ShipmentRequestTarget['lines']): ShipmentRequestTarget => ({
  shipmentRequestId: 3001,
  shipmentRequestNo: 'SYNTH-SR-0470',
  requestedShipDate: '2026-09-01',
  lines,
});

describe('lineForItem', () => {
  it('품목이 맞는 라인을 집는다', () => {
    expect(lineForItem(target([line()]), 5001)?.shipmentRequestLineId).toBe(4001);
  });

  it('맞는 라인이 없으면 null이다', () => {
    expect(lineForItem(target([line()]), 5999)).toBeNull();
  });

  /*
   * ⚠ 「라인을 못 받았다」와 「맞는 라인이 없다」는 다르다. 여기서는 둘 다 null이지만, 화면은
   * 상세를 부른 뒤에만 이 판정을 믿는다 — 목록 응답의 라인은 계약상 선택 필드다.
   */
  it('라인을 못 받았으면 집을 것이 없다', () => {
    expect(lineForItem(target(null), 5001)).toBeNull();
  });
});

describe('remainingQtyOf', () => {
  it('배정에서 출하분을 뺀다', () => {
    expect(remainingQtyOf(line())).toBe(300);
  });

  /* 음수 상한을 보이면 「−20을 넘을 수 없습니다」 같은 말이 된다. */
  it('⚠ 과출하 흔적이 있어도 음수를 내지 않는다', () => {
    expect(remainingQtyOf(line({ allocatedQty: 100, shippedQty: 120 }))).toBe(0);
  });

  it('아직 안 나갔으면 배정 전량이 잔여다', () => {
    expect(remainingQtyOf(line({ shippedQty: 0 }))).toBe(500);
  });
});
