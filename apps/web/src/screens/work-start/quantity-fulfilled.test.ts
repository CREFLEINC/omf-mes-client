import { describe, expect, it } from 'vitest';

import { isOrderQtyFulfilled } from './quantity-fulfilled';
import type { WorkOrder } from './types';

const workOrderWith = (orderQty: number, goodQty?: number): WorkOrder =>
  ({
    workOrderId: 1,
    workOrderNo: 'SYN-WO-0001',
    productionPlanId: 1,
    routingOperationId: 1,
    itemId: 1,
    orderQty,
    uomId: 1,
    workOrderTypeCode: 'NORMAL',
    statusCode: 'RELEASED',
    priorityNo: 100,
    ...(goodQty === undefined
      ? {}
      : { progress: { goodQty, achievementRate: goodQty / orderQty } }),
  }) as WorkOrder;

describe('지시 수량을 채웠는가(#45)', () => {
  it('누적 양품이 지시 수량 이상이면 채운 것이다', () => {
    expect(isOrderQtyFulfilled(workOrderWith(11, 11))).toBe(true);
    /* ⭐ 초과 생산도 채운 것이다 — 마감이 남은 것은 같다. */
    expect(isOrderQtyFulfilled(workOrderWith(11, 12))).toBe(true);
    expect(isOrderQtyFulfilled(workOrderWith(11, 10))).toBe(false);
  });

  /** ⛔ 「안 받았다」를 0 으로 접으면 안내가 조용히 사라진다 — 모르는 것은 말하지 않는다. */
  it('진척을 안 받았으면 판정하지 않는다', () => {
    expect(isOrderQtyFulfilled(workOrderWith(11))).toBe(false);
  });

  /** ⛔ `0 >= 0` 은 「채웠다」가 아니라 「수량을 모른다」다. */
  it('지시 수량이 0 이하면 채웠다고 하지 않는다', () => {
    expect(isOrderQtyFulfilled(workOrderWith(0, 0))).toBe(false);
  });
});
