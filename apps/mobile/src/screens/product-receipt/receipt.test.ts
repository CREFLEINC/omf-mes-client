import { describe, expect, it } from 'vitest';

import {
  MATCHED,
  canSubmit,
  destinationOf,
  differsFromExpected,
  managesLocations,
  putawayTaskIdsOf,
  qtyProblemOf,
  queuedForLotsOf,
  toPutawayDraft,
  toReceiptDraft,
  type DraftLine,
  type Location,
  type Warehouse,
} from './receipt';

const warehouse = (overrides: Partial<Warehouse> = {}): Warehouse => ({
  warehouseId: 1002,
  plantId: 1001,
  businessUnitId: 1001,
  warehouseCode: 'FG',
  warehouseName: '완제품창고',
  warehouseTypeCode: 'PRODUCT',
  managementLevelCode: 'CELL',
  isExternal: false,
  isDefect: false,
  isActive: true,
  ...overrides,
});

const location = (overrides: Partial<Location> = {}): Location => ({
  locationId: 3101,
  warehouseId: 1002,
  locationCode: 'FG-A-02-01',
  locationName: 'A구역 02열 01단',
  locationTypeCode: 'RACK',
  allowMixedItem: true,
  allowMixedLot: true,
  isActive: true,
  ...overrides,
});

const line = (overrides: Partial<DraftLine> = {}): DraftLine => ({
  handlingUnitContentId: 6101,
  itemId: 2101,
  lotId: 8201,
  uomId: 1001,
  expectedQty: 500,
  qty: '500',
  ...overrides,
});

describe('실물 수량 검사', () => {
  it('숫자가 아니면 막는다', () => {
    expect(qtyProblemOf(line({ qty: '오백' }))).toBe('notNumber');
  });

  it('음수를 막는다', () => {
    expect(qtyProblemOf(line({ qty: '-1' }))).toBe('negative');
  });

  /* 계약이 입고 수량에 0 보다 큰 값을 요구한다. 안 들어온 줄은 입고할 것이 없다. */
  it('0 을 막는다', () => {
    expect(qtyProblemOf(line({ qty: '0' }))).toBe('zero');
  });

  it('비어 있으면 막는다', () => {
    expect(qtyProblemOf(line({ qty: '' }))).toBe('zero');
  });

  it('양수면 통과한다', () => {
    expect(qtyProblemOf(line({ qty: '498' }))).toBeNull();
  });
});

/* 생산이 500 을 넘겼는데 실물이 498 이면 실물대로 받는다. 사유를 담을 자리가 없다. */
describe('인식표 수량과의 차이', () => {
  it('다르면 다르다고 본다', () => {
    expect(differsFromExpected(line({ qty: '498' }))).toBe(true);
  });

  it('같으면 다르지 않다', () => {
    expect(differsFromExpected(line({ qty: '500' }))).toBe(false);
  });

  it('안 적은 줄은 차이로 보지 않는다', () => {
    expect(differsFromExpected(line({ qty: '' }))).toBe(false);
  });

  /* 차이가 있어도 막지 않는다. 막으면 물건이 갈 곳이 없다. */
  it('차이가 있어도 완료할 수 있다', () => {
    expect(
      canSubmit({
        warehouse: warehouse(),
        destination: location(),
        lines: [line({ qty: '498' })],
        hasWorker: true,
        plantId: 1001,
        queuedForLots: 0,
        verdict: MATCHED,
        confirmedNoRule: false,
        stocked: new Map(),
      }),
    ).toBe(true);
  });
});

describe('위치 관리 여부', () => {
  it('창고까지만 관리하면 위치를 관리하지 않는다', () => {
    expect(managesLocations(warehouse({ managementLevelCode: 'WAREHOUSE' }))).toBe(false);
  });

  it('셀까지 관리하면 위치를 관리한다', () => {
    expect(managesLocations(warehouse({ managementLevelCode: 'CELL' }))).toBe(true);
  });
});

describe('목적지 위치', () => {
  const rack = location();
  const fallback = location({ locationId: 3199, locationCode: 'FG-DEFAULT' });
  const withDefault = [rack, { ...fallback, locationTypeCode: 'DEFAULT' }];

  it('위치를 관리하면 스캔한 자리다', () => {
    expect(destinationOf(warehouse(), rack, withDefault)?.locationId).toBe(3101);
  });

  it('위치를 관리하는데 아직 안 스캔했으면 목적지가 없다', () => {
    expect(destinationOf(warehouse(), null, withDefault)).toBeNull();
  });

  /* 계약이 목적지를 필수로 요구한다. 비워 보낼 수 없어 흡수용 자리로 들어간다. */
  it('위치를 관리하지 않으면 대표 위치다', () => {
    const unmanaged = warehouse({ managementLevelCode: 'WAREHOUSE' });

    expect(destinationOf(unmanaged, null, withDefault)?.locationId).toBe(3199);
  });

  /* 아무 위치나 골라 넣으면 재고가 남의 자리에 선다. */
  it('대표 위치가 없으면 지어내지 않는다', () => {
    const unmanaged = warehouse({ managementLevelCode: 'WAREHOUSE' });

    expect(destinationOf(unmanaged, null, [rack])).toBeNull();
  });
});

describe('완료 가능 여부', () => {
  const lines = [line()];

  it('창고를 안 고르면 완료할 수 없다', () => {
    expect(
      canSubmit({
        warehouse: null,
        destination: location(),
        lines: lines,
        hasWorker: true,
        plantId: 1001,
        queuedForLots: 0,
        verdict: MATCHED,
        confirmedNoRule: false,
        stocked: new Map(),
      }),
    ).toBe(false);
  });

  it('목적지가 없으면 완료할 수 없다', () => {
    expect(
      canSubmit({
        warehouse: warehouse(),
        destination: null,
        lines: lines,
        hasWorker: true,
        plantId: 1001,
        queuedForLots: 0,
        verdict: MATCHED,
        confirmedNoRule: false,
        stocked: new Map(),
      }),
    ).toBe(false);
  });

  it('사번이 없으면 완료할 수 없다', () => {
    expect(
      canSubmit({
        warehouse: warehouse(),
        destination: location(),
        lines: lines,
        hasWorker: false,
        plantId: 1001,
        queuedForLots: 0,
        verdict: MATCHED,
        confirmedNoRule: false,
        stocked: new Map(),
      }),
    ).toBe(false);
  });

  it('단말 공장을 모르면 완료할 수 없다', () => {
    expect(
      canSubmit({
        warehouse: warehouse(),
        destination: location(),
        lines: lines,
        hasWorker: true,
        plantId: null,
        queuedForLots: 0,
        verdict: MATCHED,
        confirmedNoRule: false,
        stocked: new Map(),
      }),
    ).toBe(false);
  });

  it('담긴 것이 없으면 완료할 수 없다', () => {
    expect(
      canSubmit({
        warehouse: warehouse(),
        destination: location(),
        lines: [],
        hasWorker: true,
        plantId: 1001,
        queuedForLots: 0,
        verdict: MATCHED,
        confirmedNoRule: false,
        stocked: new Map(),
      }),
    ).toBe(false);
  });

  it('수량이 잘못된 줄이 있으면 완료할 수 없다', () => {
    expect(
      canSubmit({
        warehouse: warehouse(),
        destination: location(),
        lines: [line({ qty: '0' })],
        hasWorker: true,
        plantId: 1001,
        queuedForLots: 0,
        verdict: MATCHED,
        confirmedNoRule: false,
        stocked: new Map(),
      }),
    ).toBe(false);
  });

  /* 서버 응답에는 아직 안 간 건이 없다. 큐를 세지 않으면 같은 LOT 이 두 번 재고로 선다. */
  it('큐에 이 LOT 의 입고가 담겨 있으면 완료할 수 없다', () => {
    expect(
      canSubmit({
        warehouse: warehouse(),
        destination: location(),
        lines: lines,
        hasWorker: true,
        plantId: 1001,
        queuedForLots: 1,
        verdict: MATCHED,
        confirmedNoRule: false,
        stocked: new Map(),
      }),
    ).toBe(false);
  });

  it('다 서면 완료한다', () => {
    expect(
      canSubmit({
        warehouse: warehouse(),
        destination: location(),
        lines: lines,
        hasWorker: true,
        plantId: 1001,
        queuedForLots: 0,
        verdict: MATCHED,
        confirmedNoRule: false,
        stocked: new Map(),
      }),
    ).toBe(true);
  });
});

describe('큐에 담긴 LOT', () => {
  const entries = [{ body: { lines: [{ lotId: 8201 }, { lotId: 8202 }] } }, { body: {} }, {}];

  it('같은 LOT 이 담겨 있으면 센다', () => {
    expect(queuedForLotsOf(entries, [8202])).toBe(1);
  });

  it('다른 LOT 은 세지 않는다', () => {
    expect(queuedForLotsOf(entries, [8299])).toBe(0);
  });
});

describe('보낼 것', () => {
  const now = new Date('2026-09-07T09:12:00+09:00');

  it('제품 입고로 보낸다', () => {
    const draft = toReceiptDraft(warehouse(), location(), [line()], 1001, now, '100028');
    const body = draft.body as { receiptTypeCode: string; warehouseId: number; plantId: number };

    expect(draft.method).toBe('POST');
    expect(draft.path).toBe('/logistics/goods-receipts');
    expect(body.receiptTypeCode).toBe('PRODUCT');
    expect(body.warehouseId).toBe(1002);
    expect(body.plantId).toBe(1001);
  });

  /* 한쪽만 채우면 없는 행을 가리킨다. 인식표에서 생산 실적 식별자를 얻을 길이 없다. */
  it('원천 문서 두 칸을 함께 비운다', () => {
    const draft = toReceiptDraft(warehouse(), location(), [line()], 1001, now, '100028');
    const body = draft.body as {
      sourceDocumentTypeCode?: string | null;
      sourceDocumentId?: number | null;
    };

    expect(body.sourceDocumentTypeCode).toBeUndefined();
    expect(body.sourceDocumentId).toBeUndefined();
  });

  /* 입고 시각은 단말 시계다. 서버가 받은 시각으로 덮지 않는다. */
  it('단말 시각과 업무 기준일을 싣는다', () => {
    const draft = toReceiptDraft(warehouse(), location(), [line()], 1001, now, '100028');
    const body = draft.body as { receiptDatetime: string; businessDate: string };

    expect(body.receiptDatetime).toBe(now.toISOString());
    expect(body.businessDate).toBe('2026-09-07');
  });

  it('실물 수량을 라인에 싣는다', () => {
    const draft = toReceiptDraft(
      warehouse(),
      location(),
      [line({ qty: '498' })],
      1001,
      now,
      '100028',
    );
    const body = draft.body as {
      lines: { receiptQty: number; lotId: number; destinationLocationId: number }[];
    };

    expect(body.lines[0]?.receiptQty).toBe(498);
    expect(body.lines[0]?.lotId).toBe(8201);
    expect(body.lines[0]?.destinationLocationId).toBe(3101);
  });

  it('적치 완료는 실제 위치를 싣는다', () => {
    const draft = toPutawayDraft(7701, location(), now, '100028');
    const body = draft.body as { actualLocationId: number };

    expect(draft.path).toBe('/logistics/putaway-tasks/7701:complete');
    expect(body.actualLocationId).toBe(3101);
  });
});

describe('입고 응답의 적치 지시', () => {
  it('라인마다 실린 식별자를 모은다', () => {
    const response = { lines: [{ putawayTaskId: 7701 }, { putawayTaskId: 7702 }] };

    expect(putawayTaskIdsOf(response)).toEqual([7701, 7702]);
  });

  /* 서버가 만들지 않았으면 화면이 지어낼 수 없다. */
  it('없는 라인은 건너뛴다', () => {
    const response = { lines: [{ putawayTaskId: null }, { putawayTaskId: 7702 }] };

    expect(putawayTaskIdsOf(response)).toEqual([7702]);
  });

  it('응답이 없으면 빈 목록이다', () => {
    expect(putawayTaskIdsOf(undefined)).toEqual([]);
  });
});
