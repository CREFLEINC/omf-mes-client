import { describe, expect, it } from 'vitest';

import {
  MATCHED,
  NOT_RECOMMENDED,
  NO_RULE,
  businessDateOf,
  canComplete,
  isSingleItemOnly,
  toOutboxDraft,
  verdictOf,
  type Location,
  type PutawayTask,
} from './putaway';

const task = (overrides: Partial<PutawayTask> = {}): PutawayTask =>
  ({
    putawayTaskId: 90,
    putawayTaskNo: 'PT-2026-0007',
    goodsReceiptLineId: 12,
    itemId: 31,
    lotId: 4,
    taskQty: 120,
    uomId: 9,
    fromLocationId: 1,
    recommendedLocationId: 5,
    warehouseId: 2,
    priorityNo: 1,
    statusCode: 'ASSIGNED',
    ...overrides,
  }) as PutawayTask;

const location = (overrides: Partial<Location> = {}): Location =>
  ({
    locationId: 5,
    warehouseId: 2,
    locationCode: 'A-01-03',
    locationName: '자재 A열 1단 3',
    locationTypeCode: 'RACK',
    allowMixedItem: true,
    allowMixedLot: true,
    isActive: true,
    ...overrides,
  }) as Location;

describe('위치 판정', () => {
  it('권장과 같으면 그대로 받는다', () => {
    expect(verdictOf(task(), location())).toBe(MATCHED);
  });

  /* 다른 곳에 두면 다음 사람이 찾지 못한다. 서버도 막는다. */
  it('권장이 있는데 다른 곳이면 받지 않는다', () => {
    expect(verdictOf(task(), location({ locationId: 9 }))).toBe(NOT_RECOMMENDED);
  });

  /* 규칙이 없다고 막으면 미등록 품목이 적치 자체를 못 해 현장이 선다. */
  it('권장이 없으면 확인을 받는 갈래로 간다', () => {
    expect(verdictOf(task({ recommendedLocationId: null }), location({ locationId: 9 }))).toBe(
      NO_RULE,
    );
  });
});

describe('완료 조건', () => {
  it('권장과 같으면 확인 없이 완료할 수 있다', () => {
    expect(canComplete(task(), location(), false, true)).toBe(true);
  });

  it('권장이 있는데 다른 곳이면 확인해도 완료할 수 없다', () => {
    expect(canComplete(task(), location({ locationId: 9 }), true, true)).toBe(false);
  });

  it('권장이 없으면 확인해야 완료할 수 있다', () => {
    const noRule = task({ recommendedLocationId: null });

    expect(canComplete(noRule, location(), false, true)).toBe(false);
    expect(canComplete(noRule, location(), true, true)).toBe(true);
  });

  /* 누가 한 일인지 없이 기록을 남길 수 없다. */
  it('사번이 없으면 완료할 수 없다', () => {
    expect(canComplete(task(), location(), false, false)).toBe(false);
  });

  it('지시나 위치를 고르지 않으면 완료할 수 없다', () => {
    expect(canComplete(null, location(), true, true)).toBe(false);
    expect(canComplete(task(), null, true, true)).toBe(false);
  });
});

describe('위치 속성', () => {
  it('한 품목만 받는 위치를 가려 낸다', () => {
    expect(isSingleItemOnly(location({ allowMixedItem: false }))).toBe(true);
    expect(isSingleItemOnly(location())).toBe(false);
  });
});

describe('업무 기준일', () => {
  /* 서버가 수신 시각으로 잡으면 날짜 경계에서 이중 계상이 난다. */
  it('단말의 날짜를 그대로 낸다', () => {
    expect(businessDateOf(new Date(2026, 8, 2, 23, 40))).toBe('2026-09-02');
  });
});

describe('완료 본문', () => {
  const NOW = new Date(2026, 8, 2, 9, 12);

  it('실제 적치한 위치를 싣고 경로에 지시 번호를 넣는다', () => {
    const entry = toOutboxDraft(task(), location(), false, NOW, '900028');
    const body = entry.body as { actualLocationId: number; businessDate: string };

    expect(body.actualLocationId).toBe(5);
    expect(body.businessDate).toBe('2026-09-02');
    expect(entry.path).toBe('/logistics/putaway-tasks/90:complete');
    expect(entry.workerNo).toBe('900028');
    expect(entry.confirmation).toBe('pending');
  });

  /* 권장이 있는 건에까지 참을 실으면 확인한 적 없는 통과가 기록으로 남는다. */
  it('권장이 있는 건에는 확인 표식을 싣지 않는다', () => {
    const body = toOutboxDraft(task(), location(), true, NOW, '900028').body as {
      confirmedNoRule: boolean;
    };

    expect(body.confirmedNoRule).toBe(false);
  });

  it('권장이 없는 건은 확인 표식을 싣는다', () => {
    const noRule = task({ recommendedLocationId: null });
    const body = toOutboxDraft(noRule, location(), true, NOW, '900028').body as {
      confirmedNoRule: boolean;
    };

    expect(body.confirmedNoRule).toBe(true);
  });
});
