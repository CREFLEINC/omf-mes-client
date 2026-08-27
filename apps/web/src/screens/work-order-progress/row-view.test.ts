import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { toWorkOrderRow } from './row-view';
import type { WorkOrder, WorkOrderProgressFact } from './types';

const t = messages.workOrderProgress.list;
const BASIS = new Date('2026-08-05T09:12:00+09:00');

const progress = (overrides: Partial<WorkOrderProgressFact> = {}): WorkOrderProgressFact => ({
  goodQty: 2850,
  achievementRate: 0.95,
  completionJudgmentCode: 'UNDER',
  ...overrides,
});

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

const rowOf = (overrides: Partial<WorkOrder> = {}) => toWorkOrderRow(workOrder(overrides), BASIS);

describe('toWorkOrderRow', () => {
  it('식별과 수량을 옮긴다', () => {
    const row = rowOf({ progress: progress() });

    expect(row).toMatchObject({
      workOrderId: 7001,
      workOrderNo: 'SYN-WO-0007',
      orderQtyText: '3,000',
      goodQtyText: '2,850',
      statusCode: 'SYN_RUN',
    });
  });

  /*
   * ⛔ **「없음」과 「0」을 가른다.** 안 온 것을 0 으로 그리면 「만든 적 없음」과 「0개 만듦」이
   * 같은 화면이 된다 — 앞은 「아직 모른다」이고 뒤는 「셌더니 0이다」라 뜻이 다르다.
   */
  describe('없음과 0을 가른다', () => {
    it('⛔ 실적이 아예 안 오면 수량 다섯이 모두 「—」다', () => {
      const row = rowOf();

      for (const text of [
        row.goodQtyText,
        row.defectQtyText,
        row.holdQtyText,
        row.scrapQtyText,
        row.reworkQtyText,
      ]) {
        expect(text).toBe(t.blank);
        expect(text).not.toBe('0');
      }
    });

    it('0 으로 온 값은 0 으로 보인다 — 셌더니 0인 것이다', () => {
      expect(rowOf({ progress: progress({ goodQty: 0 }) }).goodQtyText).toBe('0');
    });

    it('일부만 와도 온 것만 보이고 나머지는 「—」다', () => {
      const row = rowOf({ progress: progress({ defectQty: 12 }) });

      expect(row.defectQtyText).toBe('12');
      expect(row.holdQtyText).toBe(t.blank);
    });
  });

  /*
   * ⚠ 정본은 「양품/불량/손실」 셋인데 계약은 다섯이다. 접는 규칙이 아직 없고 특히 **보류가
   * 셋 어디에도 안 들어간다**(omf-mes#60) — 지어내 접으면 합계가 조용히 어긋난다.
   */
  it('⛔ 수량을 셋으로 접지 않는다 — 다섯을 그대로 옮긴다', () => {
    const row = rowOf({
      progress: progress({ defectQty: 10, holdQty: 5, scrapQty: 3, reworkQty: 2 }),
    });

    expect(row.defectQtyText).toBe('10');
    expect(row.holdQtyText).toBe('5');
    expect(row.scrapQtyText).toBe('3');
    expect(row.reworkQtyText).toBe('2');
    /* 불량에 재작업을 더해 접었다면 12가 됐을 것이다. */
    expect(row.defectQtyText).not.toBe('12');
  });

  describe('달성률 — 서버가 계산한 값을 모양만 바꾼다', () => {
    it('비율로 보인다', () => {
      expect(rowOf({ progress: progress({ achievementRate: 0.95 }) }).achievementRateText).toBe(
        '95%',
      );
    });

    it('소수 한 자리까지 보인다', () => {
      expect(rowOf({ progress: progress({ achievementRate: 0.966 }) }).achievementRateText).toBe(
        '96.6%',
      );
    });

    it('100%를 넘겨도 그대로 보인다 — 초과 생산이 있다', () => {
      expect(rowOf({ progress: progress({ achievementRate: 1.2 }) }).achievementRateText).toBe(
        '120%',
      );
    });

    it.each([
      ['안 옴', undefined],
      ['0 나눗셈 결과', Number.POSITIVE_INFINITY],
      ['수가 아님', Number.NaN],
    ])('⛔ %s 이면 「—」다 — 화면이 다시 계산하지 않는다', (_name, achievementRate) => {
      const row = rowOf({
        progress: progress({ achievementRate: achievementRate as unknown as number }),
      });

      expect(row.achievementRateText).toBe(t.blank);
    });

    /* ⛔ 지시 0인 W/O 의 달성률을 화면이 스스로 내면 화면마다 값이 갈린다. */
    it('⛔ 지시가 0이어도 화면이 나눠 보지 않는다 — 서버 값만 쓴다', () => {
      const row = rowOf({ orderQty: 0, progress: progress({ achievementRate: 0 }) });

      expect(row.achievementRateText).toBe('0%');
      expect(row.orderQtyText).toBe('0');
    });
  });

  describe('계획 종료', () => {
    it('날짜와 시각만 보인다', () => {
      expect(rowOf({ plannedEndAt: '2026-08-04T18:00:00+09:00' }).plannedEndAtText).toBe(
        '2026-08-04 18:00',
      );
    });

    it('없으면 「—」다', () => {
      expect(rowOf().plannedEndAtText).toBe(t.blank);
    });

    it('읽을 수 없는 값은 받은 대로 보인다 — 조용히 지우지 않는다', () => {
      expect(rowOf({ plannedEndAt: '언젠가' }).plannedEndAtText).toBe('언젠가');
    });
  });

  describe('지연', () => {
    it('계획 종료가 지났고 안 끝났으면 지연이다', () => {
      expect(rowOf({ plannedEndAt: '2026-08-04T18:00:00+09:00' }).delay).toBe('delayed');
    });

    it('⛔ 계획 종료가 없으면 「모름」이다 — 「지연 아님」이 아니다', () => {
      expect(rowOf().delay).toBe('unknown');
    });

    it('기준 시각을 바꾸면 판정도 바뀐다 — 함수가 「지금」을 읽지 않는다', () => {
      const target = workOrder({ plannedEndAt: '2026-08-05T12:00:00+09:00' });

      expect(toWorkOrderRow(target, new Date('2026-08-05T09:12:00+09:00')).delay).toBe('onTime');
      expect(toWorkOrderRow(target, new Date('2026-08-05T15:00:00+09:00')).delay).toBe('delayed');
    });
  });
});
