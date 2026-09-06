import { describe, expect, it } from 'vitest';

import type { Lot } from '../../patterns/lots';
import {
  canConfirm,
  completedQtyOf,
  fromWorkOrderIdOf,
  isNotStarted,
  lotProblemOf,
  qtyProblemOf,
  toBody,
  type WorkOrder,
} from './handover';

const lot = (overrides: Partial<Lot> = {}): Lot =>
  ({
    lotId: 4,
    lotNo: 'PLOT-2026-0805-0031',
    itemId: 31,
    lotTypeCode: 'PRODUCTION',
    plantId: 1,
    initialQty: 500,
    uomId: 9,
    sourceTypeCode: 'WORK_ORDER',
    sourceId: 13,
    statusCode: 'NORMAL',
    completedAt: '2026-08-11T17:40:00+09:00',
    held: false,
    ...overrides,
  }) as Lot;

const workOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder =>
  ({
    workOrderId: 27,
    workOrderNo: 'WO-2026-0027',
    productionPlanId: 1,
    routingOperationId: 2,
    itemId: 31,
    orderQty: 500,
    uomId: 9,
    workOrderTypeCode: 'NORMAL',
    priorityNo: 1,
    statusCode: 'RELEASED',
    releasedAt: '2026-08-10T09:00:00+09:00',
    ...overrides,
  }) as WorkOrder;

describe('넘길 수 있는 LOT 인가', () => {
  it('완료된 생산LOT 은 넘긴다', () => {
    expect(lotProblemOf(lot())).toBeNull();
  });

  /* 공정 인계는 생산LOT 만 넘긴다. */
  it('생산LOT 이 아니면 막는다', () => {
    expect(lotProblemOf(lot({ lotTypeCode: 'MATERIAL' }))).toBe('notProduction');
  });

  /* 완료를 시각으로 판정한다. 상태 코드 문자열을 몰라도 갈린다. */
  it('완료되지 않았으면 막는다', () => {
    expect(lotProblemOf(lot({ completedAt: null }))).toBe('notCompleted');
    expect(lotProblemOf(lot({ completedAt: undefined }))).toBe('notCompleted');
  });

  /* 다음 공정이 홀드품을 투입하면 불량이 퍼진다. 재고 이동과 달리 여기서는 막는다. */
  it('홀드 중이면 막는다', () => {
    expect(lotProblemOf(lot({ held: true }))).toBe('held');
  });

  /* W/O 마감 여부는 보지 않는다 - 마감 전이라도 완료된 LOT 은 넘어간다. */
  it('완료된 LOT 이면 W/O 상태를 보지 않는다', () => {
    expect(lotProblemOf(lot({ statusCode: '무엇이든' }))).toBeNull();
  });
});

describe('출발 W/O', () => {
  it('생산LOT 의 원천이 출발 W/O 다', () => {
    expect(fromWorkOrderIdOf(lot())).toBe(13);
  });

  /* 넘길 수 없는 LOT 의 원천을 W/O 로 읽지 않는다. */
  it('넘길 수 없는 LOT 은 출발 W/O 를 내지 않는다', () => {
    expect(fromWorkOrderIdOf(lot({ lotTypeCode: 'MATERIAL' }))).toBeNull();
    expect(fromWorkOrderIdOf(lot({ held: true }))).toBeNull();
  });
});

describe('다음 공정', () => {
  /* 배포 시각이 있는데도 진행 전인 자리다. 배포 시각으로 재면 통째로 빠진다. */
  it('배포만 된 공정은 배포 시각이 있어도 아직 시작되지 않은 것이다', () => {
    expect(
      isNotStarted(workOrder({ statusCode: 'RELEASED', releasedAt: '2026-08-10T09:00:00+09:00' })),
    ).toBe(true);
  });

  it('편성과 확정도 아직 시작되지 않은 것이다', () => {
    expect(isNotStarted(workOrder({ statusCode: 'PLANNED' }))).toBe(true);
    expect(isNotStarted(workOrder({ statusCode: 'CONFIRMED' }))).toBe(true);
  });

  it('진행과 완료와 마감은 시작된 것이다', () => {
    expect(isNotStarted(workOrder({ statusCode: 'IN_PROGRESS' }))).toBe(false);
    expect(isNotStarted(workOrder({ statusCode: 'COMPLETED' }))).toBe(false);
    expect(isNotStarted(workOrder({ statusCode: 'CLOSED' }))).toBe(false);
  });

  /* 중단은 시작한 뒤 멈춘 것이라 미시작이 아니다. */
  it('중단은 시작된 것으로 본다', () => {
    expect(isNotStarted(workOrder({ statusCode: 'SUSPENDED' }))).toBe(false);
  });
});

describe('인계 수량', () => {
  it('숫자가 아니면 막는다', () => {
    expect(qtyProblemOf('', 500)).toBe('notNumber');
    expect(qtyProblemOf('다섯', 500)).toBe('notNumber');
  });

  it('0 이하를 막는다', () => {
    expect(qtyProblemOf('0', 500)).toBe('notPositive');
    expect(qtyProblemOf('-1', 500)).toBe('notPositive');
  });

  it('완료 수량을 넘지 못한다', () => {
    expect(qtyProblemOf('500', 500)).toBeNull();
    expect(qtyProblemOf('501', 500)).toBe('overCompleted');
  });
});

describe('확정 가능 여부', () => {
  it('사번이 없으면 확정할 수 없다', () => {
    expect(canConfirm(lot(), workOrder(), '100', false, 480)).toBe(false);
  });

  it('다음 공정을 고르지 않으면 확정할 수 없다', () => {
    expect(canConfirm(lot(), null, '100', true, 480)).toBe(false);
  });

  it('넘길 수 없는 LOT 이면 확정할 수 없다', () => {
    expect(canConfirm(lot({ held: true }), workOrder(), '100', true, 480)).toBe(false);
  });

  /* 서버도 막지만 눌러 보고 알게 두지 않는다. */
  it('같은 W/O 로는 넘기지 못한다', () => {
    expect(canConfirm(lot({ sourceId: 27 }), workOrder({ workOrderId: 27 }), '100', true, 480)).toBe(
      false,
    );
  });

  it('수량이 어긋나면 확정할 수 없다', () => {
    expect(canConfirm(lot(), workOrder(), '501', true, 480)).toBe(false);
  });

  it('다 갖추면 확정한다', () => {
    expect(canConfirm(lot(), workOrder(), '480', true, 480)).toBe(true);
  });

  /*
   * 초기 수량은 계획이다. 미달 마감된 LOT 을 계획으로 재면 만들지 않은 양까지 넘어간다.
   */
  it('상한은 초기 수량이 아니라 완료 수량이다', () => {
    const planned = lot({ initialQty: 500 });

    expect(canConfirm(planned, workOrder(), '500', true, 430)).toBe(false);
    expect(canConfirm(planned, workOrder(), '430', true, 430)).toBe(true);
  });

  /* 넉넉한 쪽으로 물러서지 않는다 - 되돌릴 수 없는 쓰기라 모르는 채 통과시키면 고칠 자리가 없다. */
  it('완료 수량을 모르면 확정할 수 없다', () => {
    expect(canConfirm(lot(), workOrder(), '100', true, null)).toBe(false);
  });
});

describe('완료 수량', () => {
  it('진척의 양품 합계가 상한이다', () => {
    expect(completedQtyOf({ goodQty: 430, achievementRate: 0.86, varianceQty: -70,
      completionJudgmentCode: 'UNDER' })).toBe(430);
  });

  it('진척을 못 받았으면 모른다고 답한다', () => {
    expect(completedQtyOf(null)).toBeNull();
  });
});

describe('보낼 것', () => {
  const now = new Date('2026-09-02T13:00:00+09:00');

  it('출발과 도착 W/O 와 한 줄을 싣는다', () => {
    expect(toBody(lot(), 13, 27, '100', now)).toEqual({
      fromWorkOrderId: 13,
      toWorkOrderId: 27,
      handedOverAt: now.toISOString(),
      lines: [{ lotId: 4, handoverQty: 100, uomId: 9 }],
    });
  });

  /* 받는 쪽 화면이 없어 서버가 인계와 같은 시각으로 함께 찍는다. */
  it('수령 시각을 싣지 않는다', () => {
    expect(toBody(lot(), 13, 27, '100', now)).not.toHaveProperty('receivedAt');
  });
});
