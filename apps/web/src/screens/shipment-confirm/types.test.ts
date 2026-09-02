import { describe, expect, it } from 'vitest';

import { totalQtyOf, type ShipmentRow } from './types';

const row = (id: number, totalQty: number | null): ShipmentRow => ({
  shipmentId: id,
  shipmentNo: `SYNTH-SH-${String(id)}`,
  shippedAt: '2026-09-01T09:00:00+09:00',
  statusCode: 'CODE-A',
  erpDeliveryNo: null,
  totalQty,
});

describe('totalQtyOf', () => {
  it('고른 건들의 수량을 더한다', () => {
    expect(totalQtyOf([row(1, 300), row(2, 800)])).toBe(1100);
  });

  /*
   * ⛔ **못 받은 것을 0으로 치고 더하면 실제보다 «작은» 수가 나온다.** 되돌릴 수 없는 확정
   * 앞에서 사용자가 그 수를 보고 판단한다 — 모르면 모른다고 해야 한다.
   */
  it('⛔ 하나라도 셀 수 없으면 합도 셀 수 없다 — 0으로 치고 더하지 않는다', () => {
    expect(totalQtyOf([row(1, 300), row(2, null)])).toBeNull();
  });

  it('아무것도 안 골랐으면 0이다', () => {
    expect(totalQtyOf([])).toBe(0);
  });
});
