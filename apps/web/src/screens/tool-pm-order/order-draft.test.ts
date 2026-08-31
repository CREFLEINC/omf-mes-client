import { describe, expect, it } from 'vitest';

import {
  EMPTY_DRAFT,
  hasErrors,
  toCreateBody,
  validateDraft,
  type ToolOrderDraft,
} from './order-draft';
import type { MoldView } from './types';

const draft = (overrides: Partial<ToolOrderDraft> = {}): ToolOrderDraft => ({
  ...EMPTY_DRAFT,
  plannedDate: '2026-09-01',
  assignee: '7001',
  items: [{ key: 'a', name: '분해 청소' }],
  ...overrides,
});

const mold = (overrides: Partial<MoldView> = {}): MoldView => ({
  moldId: 8101,
  moldCode: 'SYN-MLD-01',
  moldName: '합성 금형 가',
  currentShotCount: 12000,
  guaranteedShotCount: 10000,
  availableShotCount: -2000,
  shotUsageRatio: 120,
  nextPmDate: '2026-09-01',
  pmDue: true,
  pmDueAxisCode: 'SHOT',
  ...overrides,
});

describe('validateDraft', () => {
  it('다 채우면 오류가 없다', () => {
    expect(hasErrors(validateDraft(draft(), 1))).toBe(false);
  });

  it('고른 툴이 없으면 막는다', () => {
    expect(validateDraft(draft(), 0).selection).toBe('툴을 하나 이상 고르세요.');
  });

  it('항목이 없으면 막는다', () => {
    expect(validateDraft(draft({ items: [] }), 1).items).toBe('지시 항목을 하나 이상 적으세요.');
  });

  /** 빈 이름을 그대로 보내면 이름 없는 줄이 오더에 남고 담당자가 무엇을 할지 알 수 없다. */
  it('빈 항목 이름을 막는다', () => {
    expect(validateDraft(draft({ items: [{ key: 'a', name: '  ' }] }), 1).items).toBe(
      '빈 항목이 있습니다. 이름을 적거나 그 줄을 빼세요.',
    );
  });

  it('달력에 없는 예정일을 막는다', () => {
    expect(validateDraft(draft({ plannedDate: '2026-02-31' }), 1).plannedDate).toContain('달력');
  });
});

describe('toCreateBody', () => {
  it('툴 하나의 오더를 만든다', () => {
    expect(toCreateBody(draft(), mold())).toMatchObject({
      targetTypeCode: 'MOLD',
      targetId: 8101,
      plannedDate: '2026-09-01',
      assigneeUserId: 7001,
    });
  });

  it('보전 유형을 싣지 않는다 — 트리거 조합이 정한다', () => {
    expect(toCreateBody(draft(), mold())).not.toHaveProperty('maintenanceTypeCode');
  });

  /** ⭐ 툴은 항목 마스터가 없어 이름만 담는다 — 마스터 식별자를 지어내지 않는다. */
  it('항목을 이름으로 담고 마스터 식별자를 만들지 않는다', () => {
    const body = toCreateBody(draft({ items: [{ key: 'a', name: ' 분해 청소 ' }] }), mold());

    expect(body.items?.[0]).toEqual({ itemName: '분해 청소', sequenceNo: 1 });
    expect(body.items?.[0]).not.toHaveProperty('inspectionItemId');
  });

  /** ⛔ 주기 도래는 가리킬 행이 없다. */
  it('트리거에 원천 식별자를 싣지 않는다', () => {
    expect(toCreateBody(draft(), mold()).triggers?.[0]).not.toHaveProperty('sourceId');
  });

  /**
   * ⭐ 누계는 실적 등록에서 리셋된다. 지금 값을 얼려 두지 않으면 나중에 「도래할 때 얼마였는가」를
   * 되짚을 수 없고, 그것이 수명 분석의 유일한 재료다.
   */
  it('발행 시점 스냅샷을 얼려 보낸다', () => {
    expect(toCreateBody(draft(), mold()).triggers?.[0]).toEqual({
      triggerTypeCode: 'PM_DUE',
      pmDueAxisCode: 'SHOT',
      shotCountAtDue: 12000,
      guaranteedShotCountAtDue: 10000,
    });
  });

  it('적정타수가 없으면 그 스냅샷을 싣지 않는다 — 0으로 채우지 않는다', () => {
    const body = toCreateBody(draft(), mold({ guaranteedShotCount: null }));

    expect(body.triggers?.[0]).not.toHaveProperty('guaranteedShotCountAtDue');
  });

  it('축이 오지 않으면 싣지 않는다 — 지어내지 않는다', () => {
    expect(toCreateBody(draft(), mold({ pmDueAxisCode: null })).triggers?.[0]).not.toHaveProperty(
      'pmDueAxisCode',
    );
  });

  it('공백만 친 지시 내용은 값이 아니다', () => {
    expect(toCreateBody(draft({ orderNote: '   ' }), mold())).not.toHaveProperty('orderNote');
  });
});
