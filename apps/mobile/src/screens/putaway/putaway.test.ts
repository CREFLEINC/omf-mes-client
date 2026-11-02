import { describe, expect, it } from 'vitest';

import {
  ANYWHERE,
  MATCHED,
  NOT_ALLOWED,
  allowedSummaryOf,
  businessDateOf,
  canComplete,
  scansLocation,
  toOutboxDraft,
  verdictOf,
  type CompleteInput,
  type Location,
  type PutawayTask,
} from './putaway';
import { WAREHOUSE_WHOLE } from '../../patterns/locations';

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
    allowedLocations: [
      {
        locationId: 5,
        locationCode: 'A-01-03',
        locationName: 'A-01-03',
        locationLevelCode: 'CELL',
      },
    ],
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
    aliasName: null,
    locationLevelCode: 'CELL',
    isLeaf: true,
    systemRoleCode: null,
    hasItemRestriction: false,
    isActive: true,
    ...overrides,
  }) as Location;

const two = [
  {
    locationId: 5,
    locationCode: 'A-01-03',
    locationName: 'A-01-03',
    locationLevelCode: 'CELL' as const,
  },
  {
    locationId: 6,
    locationCode: 'A-01-04',
    locationName: 'A-01-04',
    locationLevelCode: 'CELL' as const,
  },
];

describe('위치 판정', () => {
  it('둬도 되는 위치면 받는다', () => {
    expect(verdictOf(task(), location())).toBe(MATCHED);
  });

  it('둬도 되는 위치가 여럿이면 그 중 아무 데나 받는다', () => {
    expect(verdictOf(task({ allowedLocations: two }), location({ locationId: 6 }))).toBe(MATCHED);
  });

  /* 다른 곳에 두면 다음 사람이 찾지 못한다. 서버도 막는다. */
  it('목록 밖이면 받지 않는다', () => {
    expect(verdictOf(task(), location({ locationId: 9 }))).toBe(NOT_ALLOWED);
  });

  /* 보관 위치를 정하지 않은 품목은 이 창고 어디든 둔다(서버 #906). */
  it('목록이 비면 어디든 받는다', () => {
    expect(verdictOf(task({ allowedLocations: [] }), location({ locationId: 9 }))).toBe(ANYWHERE);
  });
});

describe('둘 곳 한 줄', () => {
  it('하나면 그 코드, 여럿이면 첫 코드와 나머지 수, 비면 null', () => {
    expect(allowedSummaryOf(task())).toBe('A-01-03');
    expect(allowedSummaryOf(task({ allowedLocations: two }))).toBe('A-01-03 외 1곳');
    expect(allowedSummaryOf(task({ allowedLocations: [] }))).toBeNull();
  });
});

const LOT_NO = 'RM-LOT-0007';

const input = (overrides: Partial<CompleteInput> = {}): CompleteInput => ({
  task: task(),
  location: location(),
  lotNo: LOT_NO,
  scannedLot: LOT_NO,
  hasWorker: true,
  ...overrides,
});

describe('완료 조건', () => {
  it('둬도 되는 위치이고 LOT 이 맞으면 완료할 수 있다', () => {
    expect(canComplete(input())).toBe(true);
  });

  it('목록 밖 위치면 완료할 수 없다', () => {
    expect(canComplete(input({ location: location({ locationId: 9 }) }))).toBe(false);
  });

  /* 「규칙 없음 확인」은 없어졌다(서버 #906) — 목록이 비면 확인 없이 둔다. */
  it('목록이 비면 확인 없이 완료할 수 있다', () => {
    expect(
      canComplete(
        input({ task: task({ allowedLocations: [] }), location: location({ locationId: 9 }) }),
      ),
    ).toBe(true);
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
});

describe('위치 스캔', () => {
  const whole = location({ locationId: 7, systemRoleCode: WAREHOUSE_WHOLE });
  const onlyWhole = task({
    allowedLocations: [
      {
        locationId: 7,
        locationCode: 'SYS-WHOLE',
        locationName: '창고 전체',
        locationLevelCode: 'ZONE',
      },
    ],
  });

  /* 「창고 전체」에는 붙일 라벨이 없다. */
  it('둘 곳이 「창고 전체」 하나면 스캔하지 않고 고른다', () => {
    expect(scansLocation(onlyWhole, [whole])).toBe(false);
  });

  it('사람이 만든 위치면 스캔한다', () => {
    expect(scansLocation(task(), [location()])).toBe(true);
    expect(scansLocation(task({ allowedLocations: [] }), [location()])).toBe(true);
  });

  /* 모르는 채 선택을 열면 검증 없이 통과한다. 모를 때는 스캔하는 쪽으로 둔다. */
  it('위치를 받지 못했으면 스캔한다', () => {
    expect(scansLocation(onlyWhole, undefined)).toBe(true);
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
    const entry = toOutboxDraft(task(), location(), NOW, '900028');
    const body = entry.body as { actualLocationId: number; businessDate: string };

    expect(body.actualLocationId).toBe(5);
    expect(body.businessDate).toBe('2026-09-02');
    expect(entry.path).toBe('/logistics/putaway-tasks/90:complete');
    expect(entry.workerNo).toBe('900028');
    expect(entry.confirmation).toBe('pending');
  });

  /* 서버 #906 이 확인 표식을 없앴다. */
  it('확인 표식을 싣지 않는다', () => {
    const body = toOutboxDraft(task({ allowedLocations: [] }), location(), NOW, '900028').body;

    expect(body).not.toHaveProperty('confirmedNoRule');
  });
});
