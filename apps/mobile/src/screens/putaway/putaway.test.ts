import { describe, expect, it } from 'vitest';

import {
  MATCHED,
  MIXED_ITEM,
  MIXED_LOT,
  NOT_RECOMMENDED,
  NO_RULE,
  businessDateOf,
  canComplete,
  mixProblemOf,
  overCapacityOf,
  scansLocation,
  toOutboxDraft,
  verdictOf,
  type CompleteInput,
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
    statusCode: 'PENDING',
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

const LOT_NO = 'RM-LOT-0007';

const input = (overrides: Partial<CompleteInput> = {}): CompleteInput => ({
  task: task(),
  location: location(),
  lotNo: LOT_NO,
  scannedLot: LOT_NO,
  contents: [],
  confirmedNoRule: false,
  hasWorker: true,
  ...overrides,
});

describe('완료 조건', () => {
  it('권장과 같고 LOT 이 맞으면 확인 없이 완료할 수 있다', () => {
    expect(canComplete(input())).toBe(true);
  });

  it('권장이 있는데 다른 곳이면 확인해도 완료할 수 없다', () => {
    expect(
      canComplete(input({ location: location({ locationId: 9 }), confirmedNoRule: true })),
    ).toBe(false);
  });

  it('권장이 없으면 확인해야 완료할 수 있다', () => {
    const noRule = task({ recommendedLocationId: null });

    expect(canComplete(input({ task: noRule }))).toBe(false);
    expect(canComplete(input({ task: noRule, confirmedNoRule: true }))).toBe(true);
  });

  /*
   * 지시만 보고 적치하면 손에 든 것이 그 지시의 자재인지 아무도 확인하지 않는다. 다른 자재를
   * 얹으면 그 뒤로 재고가 있다는 자리에 없다.
   */
  it('스캔한 LOT 이 지시의 것이 아니면 완료할 수 없다', () => {
    expect(canComplete(input({ scannedLot: 'RM-LOT-0009' }))).toBe(false);
  });

  it('LOT 을 아직 스캔하지 않았으면 완료할 수 없다', () => {
    expect(canComplete(input({ scannedLot: null }))).toBe(false);
  });

  /* 누가 한 일인지 없이 기록을 남길 수 없다. */
  it('사번이 없으면 완료할 수 없다', () => {
    expect(canComplete(input({ hasWorker: false }))).toBe(false);
  });

  it('지시나 위치를 고르지 않으면 완료할 수 없다', () => {
    expect(canComplete(input({ task: null }))).toBe(false);
    expect(canComplete(input({ location: null }))).toBe(false);
  });

  /* 한 품목만 받는 자리에 얹으면 그 재고는 다음 사람이 찾지 못한다. */
  it('혼적이 막힌 자리에 다른 품목이 있으면 완료할 수 없다', () => {
    expect(
      canComplete(
        input({
          location: location({ allowMixedItem: false }),
          contents: [{ itemId: 99, lotId: 7, onHandQty: 10 }],
        }),
      ),
    ).toBe(false);
  });
});

describe('혼적 판정', () => {
  const single = location({ allowMixedItem: false });

  it('한 품목만 받는 자리에 다른 품목이 있으면 막는다', () => {
    expect(mixProblemOf(task(), single, [{ itemId: 99, lotId: 7, onHandQty: 10 }])).toBe(
      MIXED_ITEM,
    );
  });

  it('같은 품목만 있으면 막지 않는다', () => {
    expect(mixProblemOf(task(), single, [{ itemId: 31, lotId: 7, onHandQty: 10 }])).toBeNull();
  });

  /* 잔액이 0 인 줄은 자리를 차지하지 않는다. 그것으로 막으면 빈 자리를 못 쓴다. */
  it('잔액이 0 인 줄로는 막지 않는다', () => {
    expect(mixProblemOf(task(), single, [{ itemId: 99, lotId: 7, onHandQty: 0 }])).toBeNull();
  });

  it('한 LOT 만 받는 자리에 다른 LOT 이 있으면 막는다', () => {
    const singleLot = location({ allowMixedLot: false });

    expect(mixProblemOf(task(), singleLot, [{ itemId: 31, lotId: 7, onHandQty: 10 }])).toBe(
      MIXED_LOT,
    );
  });

  it('혼적을 허용하는 자리는 무엇이 있든 막지 않는다', () => {
    expect(mixProblemOf(task(), location(), [{ itemId: 99, lotId: 7, onHandQty: 10 }])).toBeNull();
  });
});

describe('수용량', () => {
  it('지금 있는 양에 지시 수량을 더해 한도와 견준다', () => {
    const over = overCapacityOf(task(), location({ capacityQty: 200 }), [
      { itemId: 31, lotId: 4, onHandQty: 100 },
    ]);

    expect(over).toEqual({ held: 100, after: 220, capacity: 200 });
  });

  it('한도 안이면 말하지 않는다', () => {
    expect(
      overCapacityOf(task(), location({ capacityQty: 500 }), [
        { itemId: 31, lotId: 4, onHandQty: 100 },
      ]),
    ).toBeNull();
  });

  it('한도가 없는 자리는 말하지 않는다', () => {
    expect(overCapacityOf(task(), location({ capacityQty: null }), [])).toBeNull();
  });
});

describe('위치 관리 수준', () => {
  /* 관리하는 창고에서 목록 선택을 열면 라벨을 읽지 않고 화면만 보고 적치가 끝난다. */
  it('창고 수준이면 스캔하지 않고 고른다', () => {
    expect(scansLocation(task({ warehouseManagementLevelCode: 'WAREHOUSE' }))).toBe(false);
  });

  it('구역 아래를 관리하면 스캔한다', () => {
    expect(scansLocation(task({ warehouseManagementLevelCode: 'ZONE' }))).toBe(true);
    expect(scansLocation(task({ warehouseManagementLevelCode: 'CELL' }))).toBe(true);
  });

  /* 모르는 채 선택을 열면 검증 없이 통과한다. 모를 때는 막는 쪽으로 둔다. */
  it('관리 수준을 받지 못했으면 스캔한다', () => {
    expect(scansLocation(task({ warehouseManagementLevelCode: undefined }))).toBe(true);
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
