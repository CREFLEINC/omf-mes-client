import { describe, expect, it } from 'vitest';

import { batchSelectableIds, isBatchExcluded, retainSelection, selectedRows } from './selection';
import type { ShipmentRow } from './types';

const NOW = new Date('2026-09-01T12:00:00+09:00');

const row = (id: number, shippedAt: string | null): ShipmentRow => ({
  shipmentId: id,
  shipmentNo: `SYNTH-SH-${String(id)}`,
  shippedAt,
  statusCode: 'CODE-A',
  erpDeliveryNo: null,
  totalQty: 100,
});

const fresh = row(1, '2026-09-01T09:00:00+09:00');
const overdue = row(2, '2026-08-31T00:00:00+09:00');
const critical = row(3, '2026-08-25T12:00:00+09:00');

describe('isBatchExcluded', () => {
  /*
   * ⚠ **빼는 것과 «못 하게 막는 것»은 다르다**(§6). 위험한 것을 한 번에 쓸어 담지 않게 하는
   * 것이 목적이지 손을 묶는 것이 아니다 — 개별로는 고를 수 있다.
   */
  it('⚠ 3일 경과 건만 일괄에서 뺀다 — 24시간 경과는 담는다', () => {
    expect(isBatchExcluded(critical, NOW)).toBe(true);
    expect(isBatchExcluded(overdue, NOW)).toBe(false);
    expect(isBatchExcluded(fresh, NOW)).toBe(false);
  });

  it('경과를 셀 수 없으면 빼지 않는다 — 모른다고 막지 않는다', () => {
    expect(isBatchExcluded(row(4, null), NOW)).toBe(false);
  });
});

describe('batchSelectableIds', () => {
  it('⛔ 「모두 선택」이 3일 경과 건을 담지 않는다', () => {
    expect(batchSelectableIds([fresh, overdue, critical], NOW)).toEqual([1, 2]);
  });

  it('전부 위험하면 아무것도 담지 않는다', () => {
    expect(batchSelectableIds([critical], NOW)).toEqual([]);
  });
});

describe('retainSelection', () => {
  /*
   * ⛔ 조회를 다시 하면 고른 건이 사라질 수 있다(다른 사람이 확정했거나 자동 확정이 돌았다).
   * 남은 것만 들고 가지 않으면 **없는 건을 확정하러 간다.**
   */
  it('⛔ 목록에서 사라진 선택은 버린다', () => {
    expect(retainSelection([1, 2, 3], [fresh, overdue])).toEqual([1, 2]);
  });

  it('목록이 비면 선택도 빈다', () => {
    expect(retainSelection([1, 2], [])).toEqual([]);
  });
});

describe('selectedRows', () => {
  it('목록 차례를 그대로 따른다 — 확인 창이 보이는 순서가 목록과 같아야 한다', () => {
    expect(selectedRows([fresh, overdue, critical], [3, 1]).map((one) => one.shipmentId)).toEqual([
      1, 3,
    ]);
  });
});
