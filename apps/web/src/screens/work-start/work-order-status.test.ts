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
   * ⭐ **값이 확정됐다**(설계 변동 공지 `CREFLEINC/omf-mes#507`). 이 감지기는 목록이 또 바뀔
   * 때 **함께 고쳐야 하는 자리**를 가리킨다 — 여기가 빨개지면 ⏸ 배지와 [재개] 를 다시
   * 확인하라는 뜻이다.
   */
  it('중단을 뜻하는 상태 문자열은 SUSPENDED 하나다', () => {
    expect(HELD_STATUS_CODES).toEqual(['SUSPENDED']);
    expect(isStatusVocabularyKnown()).toBe(true);
  });

  /** ⛔ 모르는 것을 「중단」으로 다루면 시작해야 할 지시에 [재개] 가 뜬다. */
  it('모르는 상태 코드를 중단으로 다루지 않는다', () => {
    expect(isHeld(workOrderWith('SUSPENDED'))).toBe(true);
    expect(isHeld(workOrderWith('SYN_ANY'))).toBe(false);
    expect(isHeld(workOrderWith(''))).toBe(false);
  });
});
