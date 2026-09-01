import { describe, expect, it } from 'vitest';

import { resolveDelay } from './delay';
import type { WorkOrder } from './types';

const BASIS = new Date('2026-08-05T09:12:00+09:00');

const workOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  productionPlanId: 31,
  routingOperationId: 901,
  itemId: 5001,
  orderQty: 3000,
  uomId: 11,
  workOrderTypeCode: 'SYN_NORMAL',
  statusCode: 'SYN_RUN',
  priorityNo: 1,
  ...overrides,
});

describe('resolveDelay', () => {
  it('계획 종료가 지났고 아직 안 끝났으면 지연이다', () => {
    expect(resolveDelay(workOrder({ plannedEndAt: '2026-08-04T18:00:00+09:00' }), BASIS)).toBe(
      'delayed',
    );
  });

  it('계획 종료가 아직 남았으면 지연이 아니다', () => {
    expect(resolveDelay(workOrder({ plannedEndAt: '2026-08-09T18:00:00+09:00' }), BASIS)).toBe(
      'onTime',
    );
  });

  /*
   * ⛔ **「모른다」를 「아니다」와 가른다.** 계획 종료가 없는 지시는 판정할 수 없는데, 그것을
   * 「지연 아님」과 같은 값으로 두면 화면이 빈칸으로 그리고 사용자는 「정상이구나」로 읽는다.
   */
  it.each([
    ['계획 종료가 없음', undefined],
    ['빈 문자열', ''],
    ['읽을 수 없는 값', '언젠가'],
  ])('⛔ %s 이면 「모름」이다 — 「지연 아님」이 아니다', (_name, plannedEndAt) => {
    const state = resolveDelay(workOrder({ plannedEndAt }), BASIS);

    expect(state).toBe('unknown');
    expect(state).not.toBe('onTime');
  });

  describe('끝난 지시', () => {
    it('완료됐으면 계획 종료가 지났어도 「지연 중」이 아니다', () => {
      expect(
        resolveDelay(
          workOrder({
            plannedEndAt: '2026-08-04T18:00:00+09:00',
            completedAt: '2026-08-05T08:00:00+09:00',
          }),
          BASIS,
        ),
      ).toBe('onTime');
    });

    it('마감됐으면 마찬가지다', () => {
      expect(
        resolveDelay(
          workOrder({
            plannedEndAt: '2026-08-04T18:00:00+09:00',
            closedAt: '2026-08-05T08:00:00+09:00',
          }),
          BASIS,
        ),
      ).toBe('onTime');
    });

    /* 끝났더라도 계획 종료가 없으면 여전히 판정할 수 없다. */
    it('⛔ 끝났는데 계획 종료가 없으면 「모름」이다', () => {
      expect(resolveDelay(workOrder({ completedAt: '2026-08-05T08:00:00+09:00' }), BASIS)).toBe(
        'unknown',
      );
    });
  });

  describe('기준 시각으로 센다 — 함수가 「지금」을 읽지 않는다', () => {
    const target = workOrder({ plannedEndAt: '2026-08-05T12:00:00+09:00' });

    it('기준이 계획 종료 앞이면 지연이 아니다', () => {
      expect(resolveDelay(target, new Date('2026-08-05T09:12:00+09:00'))).toBe('onTime');
    });

    it('기준이 계획 종료 뒤면 지연이다 — 같은 지시라도 기준이 다르면 답이 다르다', () => {
      expect(resolveDelay(target, new Date('2026-08-05T15:00:00+09:00'))).toBe('delayed');
    });

    it('계획 종료와 기준이 같은 순간이면 지연이 아니다 — 아직 지나지 않았다', () => {
      expect(resolveDelay(target, new Date('2026-08-05T12:00:00+09:00'))).toBe('onTime');
    });
  });

  it('시간대가 달라도 같은 순간이면 같게 판정한다', () => {
    const target = workOrder({ plannedEndAt: '2026-08-05T12:00:00+09:00' });

    expect(resolveDelay(target, new Date('2026-08-05T03:00:00+00:00'))).toBe('onTime');
    expect(resolveDelay(target, new Date('2026-08-05T04:00:00+00:00'))).toBe('delayed');
  });
});
