import { describe, expect, it } from 'vitest';

import type { WorkOrder } from './types';
import { HELD_STATUS_CODES, isHeld, isStatusVocabularyKnown } from './work-order-status';

const workOrderWith = (statusCode: string): WorkOrder =>
  ({
    workOrderId: 1,
    workOrderNo: 'SYN-WO-0001',
    productionPlanId: 1,
    routingOperationId: 1,
    itemId: 1,
    orderQty: 1,
    uomId: 1,
    workOrderTypeCode: 'NORMAL',
    statusCode,
    priorityNo: 100,
  }) as WorkOrder;

describe('작업지시 상태 코드', () => {
  /**
   * ⛔ **값이 비어 있는 것이 지금의 사실이다**(스펙 §8 미결 7 · 통지 #556). 이 감지기는 값이
   * 확정돼 채워질 때 **함께 고쳐야 하는 자리**를 가리킨다 — 여기가 빨개지면 ⏸ 배지와 [재개]
   * 를 다시 확인하라는 뜻이다.
   */
  it('아직 확정된 상태 문자열이 없다', () => {
    expect(HELD_STATUS_CODES).toHaveLength(0);
    expect(isStatusVocabularyKnown()).toBe(false);
  });

  /** ⛔ 모르는 것을 「중단」으로 다루면 시작해야 할 지시에 [재개] 가 뜬다. */
  it('모르는 상태 코드를 중단으로 다루지 않는다', () => {
    expect(isHeld(workOrderWith('SYN_ANY'))).toBe(false);
    expect(isHeld(workOrderWith(''))).toBe(false);
  });
});
