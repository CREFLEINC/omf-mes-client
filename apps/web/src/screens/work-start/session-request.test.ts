import { describe, expect, it } from 'vitest';

import { toSessionRequest } from './session-request';
import type { WorkOrder } from './types';

const WORK_ORDER = {
  workOrderId: 8101,
  workOrderNo: 'SYN-WO-0101',
  productionPlanId: 4001,
  routingOperationId: 3001,
  itemId: 5001,
  orderQty: 500,
  uomId: 11,
  workOrderTypeCode: 'NORMAL',
  statusCode: 'SYN_UNKNOWN_STATUS',
  priorityNo: 100,
  plannedEquipmentId: 6301,
  plannedMoldId: 6401,
} as WorkOrder;

const STARTED_AT = '2026-09-02T09:00:00+09:00';

describe('작업 시작 요청 본문', () => {
  /**
   * ⛔ 통지 #563 · omf-mes#271 — 서버가 받지 않는 키다. 선택으로 남기면 조용히 무시되고,
   * 「화면이 정한다」는 옛 전제가 코드에 남는다.
   */
  it('단말·작업자·교대를 싣지 않는다', () => {
    const body = toSessionRequest({
      workOrder: WORK_ORDER,
      equipmentId: 6301,
      startedAt: STARTED_AT,
    });

    expect(body).not.toHaveProperty('terminalId');
    expect(body).not.toHaveProperty('workerId');
    expect(body).not.toHaveProperty('workerIds');
    expect(body).not.toHaveProperty('shiftId');
  });

  /** ⭐ 계획 설비가 아니라 **실제로 도는 설비**가 세션에 남는다 — 사후 추적의 근거다. */
  it('설비는 계획값이 아니라 지금 단말이 붙은 설비를 싣는다', () => {
    const body = toSessionRequest({
      workOrder: { ...WORK_ORDER, plannedEquipmentId: 9999 },
      equipmentId: 6301,
      startedAt: STARTED_AT,
    });

    expect(body.equipmentId).toBe(6301);
  });

  /** ⛔ 없는 값을 0으로 채우면 「배정이 없다」가 「0번 설비다」로 기록에 남는다. */
  it('설비를 모르면 키 자체를 싣지 않는다', () => {
    const body = toSessionRequest({
      workOrder: WORK_ORDER,
      equipmentId: null,
      startedAt: STARTED_AT,
    });

    expect(body).not.toHaveProperty('equipmentId');
  });

  it('계획 금형이 없으면 키 자체를 싣지 않는다', () => {
    const { plannedMoldId: _ignored, ...withoutMold } = WORK_ORDER;

    const body = toSessionRequest({
      workOrder: withoutMold as WorkOrder,
      equipmentId: 6301,
      startedAt: STARTED_AT,
    });

    expect(body).not.toHaveProperty('moldId');
  });

  it('시작 시각은 단말이 준 값을 그대로 싣는다', () => {
    const body = toSessionRequest({
      workOrder: WORK_ORDER,
      equipmentId: 6301,
      startedAt: STARTED_AT,
    });

    expect(body.startedAt).toBe(STARTED_AT);
  });
});
