import { describe, expect, it } from 'vitest';

import {
  GOOD_QTY_MAX_LENGTH,
  addQuickStep,
  canSave,
  exceedsRemaining,
  parseGoodQty,
  remainingQty,
  saveBlockReason,
  type SaveGuard,
} from './quantity-draft';
import { emptyResultDraft, type WorkOrder } from './types';

const workOrder = (patch: Partial<WorkOrder> = {}): WorkOrder =>
  ({
    workOrderId: 1,
    workOrderNo: 'WO-1',
    productionPlanId: 1,
    routingOperationId: 1,
    itemId: 1,
    orderQty: 500,
    uomId: 1,
    workOrderTypeCode: 'NORMAL',
    priorityNo: 100,
    statusCode: 'IN_PROGRESS',
    ...patch,
  }) as WorkOrder;

const guard = (patch: Partial<SaveGuard> = {}): SaveGuard => ({
  isGateAllowed: true,
  hasWorkOrder: true,
  hasWorker: true,
  hasLot: true,
  hasPendingPqc: false,
  draft: { ...emptyResultDraft, goodQty: '120' },
  ...patch,
});

describe('parseGoodQty — 빈 입력과 0 을 가른다', () => {
  it('빈 버퍼는 null 이다 — 0 으로 접지 않는다', () => {
    expect(parseGoodQty('')).toBeNull();
  });

  it('0 은 0 이다 — 친 값이므로 null 이 아니다', () => {
    expect(parseGoodQty('0')).toBe(0);
  });

  it('숫자 문자열을 그대로 읽는다', () => {
    expect(parseGoodQty('120')).toBe(120);
  });
});

describe('addQuickStep — 이어 붙이지 않고 더한다', () => {
  it('12 에 10 을 더하면 22 다 — 1210 이 아니다', () => {
    expect(addQuickStep('12', 10)).toBe('22');
  });

  it('빈 버퍼에 더하면 증분 그대로다', () => {
    expect(addQuickStep('', 100)).toBe('100');
  });

  it('자릿수 상한을 넘기는 결과는 무시한다', () => {
    const atLimit = '9'.repeat(GOOD_QTY_MAX_LENGTH);

    expect(addQuickStep(atLimit, 10)).toBe(atLimit);
  });
});

describe('remainingQty — 서버 값을 먼저 쓴다', () => {
  it('progress 가 없으면 «모르는 것»이라 null 이다 — 0 이 아니다', () => {
    expect(remainingQty(workOrder())).toBeNull();
  });

  it('varianceQty 가 있으면 그것을 쓴다', () => {
    const result = remainingQty(
      workOrder({
        progress: {
          goodQty: 120,
          achievementRate: 0.24,
          varianceQty: 380,
          completionJudgmentCode: 'UNDER',
        },
      }),
    );

    expect(result).toBe(380);
  });

  it('varianceQty 가 없으면 지시 수량에서 양품 누계를 뺀다', () => {
    const result = remainingQty(
      workOrder({
        progress: { goodQty: 120, achievementRate: 0.24, completionJudgmentCode: 'UNDER' },
      }),
    );

    expect(result).toBe(380);
  });

  it('workOrder 자체가 없으면 null 이다', () => {
    expect(remainingQty(undefined)).toBeNull();
  });
});

describe('saveBlockReason — 고칠 수 없는 것부터 말한다', () => {
  it('게이팅이 닫혀 있으면 수량과 무관하게 게이팅을 말한다', () => {
    expect(saveBlockReason(guard({ isGateAllowed: false, draft: emptyResultDraft }))).toBe('gate');
  });

  it('사번이 없으면 저장하지 않는다 — 서버가 거부하는 쓰기다', () => {
    expect(saveBlockReason(guard({ hasWorker: false }))).toBe('noWorker');
  });

  it('PQC 가 남아 있으면 실적을 먼저 넣지 않는다', () => {
    expect(saveBlockReason(guard({ hasPendingPqc: true }))).toBe('pendingPqc');
  });

  it('LOT 을 고르지 않았으면 막는다', () => {
    expect(saveBlockReason(guard({ hasLot: false }))).toBe('noLot');
  });

  it('수량이 비었으면 «비었다»고 말한다', () => {
    expect(saveBlockReason(guard({ draft: emptyResultDraft }))).toBe('emptyQty');
  });

  it('0 은 «0보다 커야 한다»고 말한다 — 빈 것과 다른 사유다', () => {
    expect(saveBlockReason(guard({ draft: { ...emptyResultDraft, goodQty: '0' } }))).toBe(
      'zeroQty',
    );
  });

  it('전부 갖춰지면 막지 않는다', () => {
    expect(saveBlockReason(guard())).toBeNull();
    expect(canSave(guard())).toBe(true);
  });
});

describe('exceedsRemaining — 넘는지만 말하고 막지 않는다', () => {
  it('잔여를 넘으면 참이다', () => {
    expect(exceedsRemaining('400', 380)).toBe(true);
  });

  it('잔여와 같으면 넘지 않는다', () => {
    expect(exceedsRemaining('380', 380)).toBe(false);
  });

  it('잔여를 모르면 넘는지도 모른다 — 거짓이다', () => {
    expect(exceedsRemaining('400', null)).toBe(false);
  });

  it('입력이 없으면 거짓이다', () => {
    expect(exceedsRemaining('', 380)).toBe(false);
  });
});
