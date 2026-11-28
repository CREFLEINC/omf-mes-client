import { describe, expect, it } from 'vitest';

import { toDetailSteps } from './detail-steps';
import type { WorkOrder } from './types';

const workOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  productionPlanId: 31,
  routingOperationId: 901,
  itemId: 5001,
  orderQty: 3000,
  uomId: 11,
  workOrderTypeCode: 'SYN_NORMAL',
  statusCode: 'PLANNED',
  priorityNo: 1,
  ...overrides,
});

const states = (overrides: Partial<WorkOrder>): string[] =>
  toDetailSteps(workOrder(overrides)).map((step) => step.state);

describe('toDetailSteps', () => {
  it('편성 · 확정 · 배포 · 진행 · 완료 · 마감 순으로 놓는다', () => {
    expect(toDetailSteps(workOrder()).map((step) => step.code)).toEqual([
      'PLANNED',
      'CONFIRMED',
      'RELEASED',
      'IN_PROGRESS',
      'COMPLETED',
      'CLOSED',
    ]);
  });

  it('지금 상태의 앞은 지난 단계, 그 자리는 지금 단계, 뒤는 남은 단계다', () => {
    expect(states({ statusCode: 'RELEASED' })).toEqual([
      'done',
      'done',
      'current',
      'todo',
      'todo',
      'todo',
    ]);
  });

  it('첫 단계와 마지막 단계도 지금 단계로 가리킨다', () => {
    expect(states({ statusCode: 'PLANNED' })[0]).toBe('current');
    expect(states({ statusCode: 'CLOSED' })).toEqual([
      'done',
      'done',
      'done',
      'done',
      'done',
      'current',
    ]);
  });

  /* 중단은 진행하다 멈춘 것이다 — 길에서 벗어난 것이 아니라 진행 자리에 머문다. */
  it('중단은 진행 자리에 머문다', () => {
    expect(states({ statusCode: 'SUSPENDED' })).toEqual(states({ statusCode: 'IN_PROGRESS' }));
  });

  /* 취소 · 마스터에 새로 생긴 값 — 「지금」 자리가 없다. 어디까지 갔는지는 남은 시각이 말한다. */
  it.each(['CANCELLED', 'SYN_NEW'])(
    '길 밖의 상태(%s)는 지금 단계가 없고 시각이 남은 단계만 지난 것이다',
    (statusCode) => {
      expect(states({ statusCode, releasedAt: '2026-08-04T09:40:00+09:00' })).toEqual([
        'todo',
        'todo',
        'done',
        'todo',
        'todo',
        'todo',
      ]);
    },
  );

  it('배포 · 완료 · 마감 시각을 그 단계에 싣는다', () => {
    const steps = toDetailSteps(
      workOrder({
        statusCode: 'CLOSED',
        releasedAt: '2026-08-04T09:40:00+09:00',
        completedAt: '2026-08-04T17:00:00+09:00',
        closedAt: '2026-08-05T09:00:00+09:00',
      }),
    );

    expect(steps.map((step) => step.at)).toEqual([
      undefined,
      undefined,
      '2026-08-04T09:40:00+09:00',
      undefined,
      '2026-08-04T17:00:00+09:00',
      '2026-08-05T09:00:00+09:00',
    ]);
  });
});
