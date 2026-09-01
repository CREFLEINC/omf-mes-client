import { describe, expect, it } from 'vitest';

import {
  derivedTypeLabel,
  EMPTY_DRAFT,
  hasErrors,
  isSameEquipment,
  lockedEquipmentId,
  toCreateBody,
  usesBaseDate,
  validateDraft,
  type OrderDraft,
} from './order-draft';
import {
  BREAKDOWN_TRIGGER,
  INSPECTION_NG_TRIGGER,
  PM_DUE_TRIGGER,
  type TriggerDraft,
} from './types';

const trigger = (overrides: Partial<TriggerDraft> = {}): TriggerDraft => ({
  key: 'BREAKDOWN:9001',
  triggerTypeCode: BREAKDOWN_TRIGGER,
  sourceId: 9001,
  equipmentId: 8101,
  equipmentCode: 'SYN-EQ-01',
  label: '고장 · SYN-BD-0001',
  ...overrides,
});

const draft = (overrides: Partial<OrderDraft> = {}): OrderDraft => ({
  ...EMPTY_DRAFT,
  target: '8101',
  plannedDate: '2026-08-20',
  assignee: '7001',
  itemIds: ['5001', '5002'],
  ...overrides,
});

describe('derivedTypeLabel', () => {
  /**
   * ⭐ 서버가 정하는 값을 화면도 판정한다 — 발행 전에 무엇이 될지 보여 주기 위해서다.
   * 둘이 갈리면 사용자는 발행한 뒤에 유형을 보고 놀란다.
   */
  it('고장이 하나라도 섞이면 사후다', () => {
    expect(derivedTypeLabel([trigger({ triggerTypeCode: PM_DUE_TRIGGER }), trigger()])).toBe(
      '사후',
    );
  });

  it('고장이 없으면 예방이다', () => {
    expect(
      derivedTypeLabel([
        trigger({ triggerTypeCode: PM_DUE_TRIGGER }),
        trigger({ triggerTypeCode: INSPECTION_NG_TRIGGER }),
      ]),
    ).toBe('예방');
  });
});

describe('usesBaseDate', () => {
  /** ⭐ 사후인데 기준일이 실리면 다음 주기가 엉뚱한 날부터 시작한다. */
  it('고장이 섞이면 주기 기준일을 쓰지 않는다', () => {
    expect(usesBaseDate([trigger()])).toBe(false);
  });

  it('예방보전이면 쓴다', () => {
    expect(usesBaseDate([trigger({ triggerTypeCode: PM_DUE_TRIGGER })])).toBe(true);
  });

  it('아무것도 안 골랐으면 쓰지 않는다 — 무엇이 될지 아직 모른다', () => {
    expect(usesBaseDate([])).toBe(false);
  });
});

describe('isSameEquipment · lockedEquipmentId', () => {
  it('비어 있으면 섞일 것이 없다', () => {
    expect(isSameEquipment([])).toBe(true);
    expect(lockedEquipmentId([])).toBeNull();
  });

  it('같은 설비면 참이다', () => {
    expect(isSameEquipment([trigger(), trigger({ key: 'b', sourceId: 9002 })])).toBe(true);
    expect(lockedEquipmentId([trigger()])).toBe(8101);
  });

  it('다른 설비가 섞이면 거짓이다', () => {
    expect(isSameEquipment([trigger(), trigger({ key: 'b', equipmentId: 8102 })])).toBe(false);
  });
});

describe('validateDraft', () => {
  it('다 채우면 오류가 없다', () => {
    expect(hasErrors(validateDraft(draft(), [trigger()]))).toBe(false);
  });

  it('트리거가 없으면 막는다', () => {
    expect(validateDraft(draft(), []).triggers).toBe('트리거를 하나 이상 고르세요.');
  });

  /** ⭐ 섞인 것을 발행하면 지시 하나가 두 설비를 가리키고 되돌릴 길이 없다. */
  it('다른 설비가 섞이면 막는다', () => {
    expect(
      validateDraft(draft(), [trigger(), trigger({ key: 'b', equipmentId: 8102 })]).triggers,
    ).toBe('한 지시에는 같은 설비의 트리거만 묶을 수 있습니다.');
  });

  /** ⭐ 계약: 「부여가 없으면 발행할 수 없다」 — 설비 보전은 항목 마스터를 반드시 가리킨다. */
  it('지시 항목이 없으면 막는다', () => {
    expect(validateDraft(draft({ itemIds: [] }), [trigger()]).itemIds).toBe(
      '지시 항목을 하나 이상 고르세요.',
    );
  });

  it('필수 셋이 비면 각각 사유를 낸다', () => {
    const errors = validateDraft(EMPTY_DRAFT, [trigger()]);

    expect(Object.keys(errors).sort()).toEqual(['assignee', 'itemIds', 'plannedDate', 'target']);
  });
});

describe('toCreateBody', () => {
  it('보전 유형을 싣지 않는다 — 트리거 조합이 정한다', () => {
    expect(toCreateBody(draft(), [trigger()])).not.toHaveProperty('maintenanceTypeCode');
  });

  it('옛 표현(itemNames)을 쓰지 않는다', () => {
    expect(toCreateBody(draft(), [trigger()])).not.toHaveProperty('itemNames');
  });

  it('항목 순서를 1부터 매긴다', () => {
    expect(toCreateBody(draft(), [trigger()]).items).toEqual([
      { inspectionItemId: 5001, sequenceNo: 1 },
      { inspectionItemId: 5002, sequenceNo: 2 },
    ]);
  });

  /** ⛔ 주기 도래는 가리킬 행이 없다 — 계약이 「비운다」로 못 박았다. */
  it('주기 도래 트리거에는 원천 식별자를 싣지 않는다', () => {
    const body = toCreateBody(draft(), [
      trigger({ triggerTypeCode: PM_DUE_TRIGGER, sourceId: null }),
    ]);

    expect(body.triggers?.[0]).toEqual({ triggerTypeCode: PM_DUE_TRIGGER });
  });

  it('나머지 두 유형에는 원천 식별자를 싣는다', () => {
    expect(toCreateBody(draft(), [trigger()]).triggers?.[0]).toEqual({
      triggerTypeCode: BREAKDOWN_TRIGGER,
      sourceId: 9001,
    });
  });

  /** ⛔ 사후인데 기준일이 실리면 다음 주기가 엉뚱한 날부터 시작한다. */
  it('고장이 섞이면 주기 기준일을 싣지 않는다', () => {
    expect(toCreateBody(draft({ baseDate: '2026-08-01' }), [trigger()])).not.toHaveProperty(
      'baseDate',
    );
  });

  it('예방보전이면 주기 기준일을 싣는다', () => {
    expect(
      toCreateBody(draft({ baseDate: '2026-08-01' }), [
        trigger({ triggerTypeCode: PM_DUE_TRIGGER, sourceId: null }),
      ]).baseDate,
    ).toBe('2026-08-01');
  });

  it('공백만 친 지시 내용은 값이 아니다', () => {
    expect(toCreateBody(draft({ orderNote: '   ' }), [trigger()])).not.toHaveProperty('orderNote');
  });
});
