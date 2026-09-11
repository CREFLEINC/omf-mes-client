import { describe, expect, it } from 'vitest';

import {
  quantityTotal,
  quantityVerdict,
  reworkDispositionProgress,
  toProductionResult,
  type QuantityDrafts,
} from './result';
import type { WorkOrder } from './types';

const workOrder = {
  workOrderId: 1501,
  workOrderNo: 'WO-RW-1501',
  productionPlanId: 101,
  routingOperationId: 201,
  itemId: 301,
  orderQty: 10,
  uomId: 401,
  workOrderTypeCode: 'REWORK',
  priorityNo: 1,
  statusCode: 'IN_PROGRESS',
} satisfies WorkOrder;

const drafts = (values: Partial<QuantityDrafts> = {}): QuantityDrafts => ({
  goodQty: '',
  defectQty: '',
  holdQty: '',
  scrapQty: '',
  ...values,
});

describe('재작업 실적 수량', () => {
  it('네 결과 수량을 합산한다', () => {
    expect(
      quantityTotal(drafts({ goodQty: '4', defectQty: '2.5', holdQty: '1', scrapQty: '0.5' })),
    ).toBe(8);
  });

  it('0·부분·완료·초과를 구분한다', () => {
    expect(quantityVerdict(0, 10)).toBe('empty');
    expect(quantityVerdict(7, 10)).toBe('partial');
    expect(quantityVerdict(10, 10)).toBe('complete');
    expect(quantityVerdict(11, 10)).toBe('exceeded');
  });

  it('이미 처리한 수량을 빼고 이번 입력 가능 수량을 계산한다', () => {
    const progress = reworkDispositionProgress([
      {
        dispositionDecisionId: 1,
        nonconformanceId: 2,
        dispositionTypeCode: 'REWORK',
        decisionQty: 10,
        uomId: 401,
        reason: '합성 사유',
        decidedBy: 501,
        decidedAt: '2026-09-02T15:00:00+09:00',
        followUpStatusCode: 'PARTIAL',
        followUpQty: 4,
      },
    ]);
    expect(progress).toEqual({ target: 10, completed: 4, remaining: 6 });
  });

  it('재작업 수량은 0이고 임시 수기 원천값을 한 자리에서 싣는다', () => {
    const result = toProductionResult(
      workOrder,
      drafts({ goodQty: '6', defectQty: '2' }),
      new Date('2026-09-02T06:00:00.000Z'),
    );
    expect(result).toMatchObject({
      workOrderId: 1501,
      goodQty: 6,
      defectQty: 2,
      holdQty: 0,
      scrapQty: 0,
      reworkQty: 0,
      uomId: 401,
    });
    expect(result.occurredAt).toMatch(/[+-]\d{2}:\d{2}$/);
  });

  /*
   * ⛔⛔ **`resultSourceCode` 가 다시 필수다**(2026-09-11 전달본 · `result.ts` 머리말 참고).
   * 이 화면도 `usePopIdentity`·`NumericKeypad` 로 사람이 수량을 직접 치는 POP 단말이라
   * `MANUAL` 을 싣는다 — `production-result/save-request.ts` 와 같은 판단이다.
   */
  it('실적 출처는 사람이 입력하는 단말이라 MANUAL 을 싣는다', () => {
    const result = toProductionResult(workOrder, drafts(), new Date('2026-09-02T06:00:00.000Z'));

    expect(result.resultSourceCode).toBe('MANUAL');
  });
});
