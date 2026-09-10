import { describe, expect, it } from 'vitest';

import {
  DEFECT_RETURN,
  NORMAL,
  canArrive,
  canShip,
  heldLines,
  isSameWarehouse,
  mixedSourceWarehouses,
  sourceEndOf,
  sourcePickOf,
  qtyProblemOf,
  queuedShipsFor,
  toArriveDraft,
  toShipDraft,
  type DraftLine,
  type StockTransfer,
  type StockTransferLine,
} from './transfer';

const line = (overrides: Partial<DraftLine> = {}): DraftLine => ({
  lotId: 8001,
  lotNo: 'MLOT-2026-0001',
  itemId: 2002,
  uomId: 1001,
  fromLocationId: 3001,
  warehouseId: 1001,
  businessUnitId: 1001,
  onHandQty: 120,
  held: false,
  qty: '',
  ...overrides,
});

const from = { warehouseId: 1001, businessUnitId: 1001 };
const to = { warehouseId: 1003, businessUnitId: 1001 };

const transfer = (): StockTransfer => ({
  stockTransferId: 7001,
  stockTransferNo: 'ST-2026-000001',
  transferTypeCode: NORMAL,
  fromBusinessUnitId: 1001,
  toBusinessUnitId: 1001,
  fromWarehouseId: 1001,
  toWarehouseId: 1003,
  requestedAt: '2026-09-07T09:00:00+09:00',
  statusCode: 'IN_TRANSIT',
});

const shippedLine = (overrides: Partial<StockTransferLine> = {}): StockTransferLine => ({
  stockTransferLineId: 7101,
  stockTransferId: 7001,
  lineNo: 1,
  itemId: 2002,
  lotId: 8001,
  requestedQty: 80,
  shippedQty: 80,
  receivedQty: 0,
  uomId: 1001,
  fromLocationId: 3001,
  toLocationId: 3005,
  ...overrides,
});

describe('반출 수량 검사', () => {
  it('숫자가 아니면 막는다', () => {
    expect(qtyProblemOf(line({ qty: '열' }))).toBe('notNumber');
  });

  /* 0 을 옮기는 것은 이동이 아니다. 빈 이동 건을 기록으로 남기지 않는다. */
  it('0 이하를 막는다', () => {
    expect(qtyProblemOf(line({ qty: '0' }))).toBe('notPositive');
    expect(qtyProblemOf(line({ qty: '-1' }))).toBe('notPositive');
  });

  /* 재고보다 많이 내보내면 반출이 되돌아오는데, 그때 물건은 이미 옮겨진 뒤다. */
  it('재고보다 많이 내보낼 수 없다', () => {
    expect(qtyProblemOf(line({ qty: '120' }))).toBeNull();
    expect(qtyProblemOf(line({ qty: '121' }))).toBe('overStock');
  });

  it('안 적은 줄은 문제로 보지 않는다', () => {
    expect(qtyProblemOf(line())).toBeNull();
  });
});

describe('반출 가능 여부', () => {
  const lines = [line({ qty: '80' })];

  it('사번이 없으면 반출할 수 없다', () => {
    expect(canShip(lines, false, 0)).toBe(false);
  });

  it('한 줄도 적지 않으면 반출할 수 없다', () => {
    expect(canShip([line()], true, 0)).toBe(false);
  });

  it('수량이 잘못된 줄이 있으면 반출할 수 없다', () => {
    expect(canShip([line({ qty: '121' })], true, 0)).toBe(false);
  });

  /* 서버 응답에는 아직 안 간 건이 없다. 큐를 세지 않으면 오프라인에서 둘 다 통과한다. */
  it('큐에 이 LOT 의 반출이 담겨 있으면 반출할 수 없다', () => {
    expect(canShip(lines, true, 1)).toBe(false);
  });

  it('적은 줄이 있고 수량이 맞으면 반출한다', () => {
    expect(canShip(lines, true, 0)).toBe(true);
  });

  it('큐에서 이 LOT 의 반출만 센다', () => {
    const entries = [
      { body: { lines: [{ lotId: 8001 }] } },
      { body: { lines: [{ lotId: 8002 }] } },
      { body: { lines: [{ lotId: 8003 }, { lotId: 8001 }] } },
    ];

    expect(queuedShipsFor(entries, [8001])).toBe(2);
    expect(queuedShipsFor(entries, [8004])).toBe(0);
  });

  it('본문이 없는 건은 세지 않는다', () => {
    expect(queuedShipsFor([{}], [8001])).toBe(0);
  });
});

/* 결정 14 — 보류는 막지 않고 알린다. 막으면 현장이 물건을 못 옮긴다. */
describe('보류 중인 LOT', () => {
  it('보류여도 반출을 막지 않는다', () => {
    expect(canShip([line({ qty: '80', held: true })], true, 0)).toBe(true);
  });

  it('보류인 줄을 번호로 짚는다', () => {
    const lines = [line({ qty: '80', held: true }), line({ lotId: 8002, lotNo: 'B', qty: '10' })];

    expect(heldLines(lines).map((each) => each.lotNo)).toEqual(['MLOT-2026-0001']);
  });

  /* 안 적은 줄은 이번 이동에 없다. 없는 것을 두고 보류라 말하면 경고가 헐거워진다. */
  it('안 적은 줄은 보류여도 짚지 않는다', () => {
    expect(heldLines([line({ held: true })])).toHaveLength(0);
  });
});

/*
 * 이동 헤더가 창고 간만 받는다. 같은 창고 안은 수불에 직접 적어야 하는데 계약에 그 쓰기
 * 경로가 없다.
 */
describe('같은 창고 안 이동', () => {
  it('출발과 도착 창고가 같으면 같은 창고 안이다', () => {
    expect(isSameWarehouse(1001, 1001)).toBe(true);
    expect(isSameWarehouse(1001, 1003)).toBe(false);
  });
});

/*
 * 이동 헤더는 출발 창고를 하나만 받는다. 섞어 담으면 헤더가 첫 줄의 창고를 말하는데 나머지
 * 줄의 재고는 다른 창고에 있어, 있지도 않은 자리에서 빼는 것이 된다.
 */
describe('서로 다른 창고의 LOT 을 섞으면', () => {
  const mixed = [
    line({ qty: '80' }),
    line({ lotId: 8002, lotNo: 'B', warehouseId: 1002, businessUnitId: 1002, qty: '10' }),
  ];

  it('섞였다고 판정한다', () => {
    expect(mixedSourceWarehouses(mixed)).toBe(true);
    expect(mixedSourceWarehouses([line({ qty: '80' })])).toBe(false);
  });

  it('반출을 막는다', () => {
    expect(canShip(mixed, true, 0)).toBe(false);
  });

  /* 안 적은 줄은 이번 이동에 없다. 그것 때문에 막으면 옮길 수 있는 것도 못 옮긴다. */
  it('안 적은 줄이 다른 창고여도 막지 않는다', () => {
    const idle = [
      line({ qty: '80' }),
      line({ lotId: 8002, warehouseId: 1002, businessUnitId: 1002 }),
    ];

    expect(mixedSourceWarehouses(idle)).toBe(false);
    expect(canShip(idle, true, 0)).toBe(true);
  });
});

describe('반출에 쓸 잔고 줄', () => {
  const wh = [
    { warehouseId: 1001, businessUnitId: 1001 },
    { warehouseId: 1002, businessUnitId: 2002 },
  ];

  it('줄에 사업장이 실려 오면 그것을 쓴다', () => {
    const pick = sourcePickOf(
      [{ onHandQty: 300, locationId: 3001, warehouseId: 1001, businessUnitId: 9009 }],
      wh,
    );

    expect(pick).toMatchObject({ kind: 'row', businessUnitId: 9009 });
  });

  /* 계약이 사업장을 선택 항목으로 둔다. 없다고 재고 없음으로 읽으면 반출이 통째로 막힌다. */
  it('줄에 사업장이 없으면 출발 창고에서 가져온다', () => {
    const pick = sourcePickOf([{ onHandQty: 300, locationId: 3001, warehouseId: 1002 }], wh);

    expect(pick).toMatchObject({ kind: 'row', businessUnitId: 2002 });
  });

  it('사업장이 없어도 재고 없음으로 읽지 않는다', () => {
    const pick = sourcePickOf([{ onHandQty: 300, locationId: 3001, warehouseId: 1002 }], wh);

    expect(pick.kind).not.toBe('noStock');
  });

  it('재고가 없으면 재고 없음이다', () => {
    expect(sourcePickOf([{ onHandQty: 0, locationId: 3001, warehouseId: 1001 }], wh).kind).toBe(
      'noStock',
    );
  });

  it('위치가 없는 줄은 받지 않는다', () => {
    expect(sourcePickOf([{ onHandQty: 300, warehouseId: 1001 }], wh).kind).toBe('noStock');
  });

  /* 재고는 있는데 사업장만 못 정한 자리다. 사람이 할 일이 달라 문구를 가른다. */
  it('출발 창고를 모르면 재고 없음과 다르게 말한다', () => {
    const pick = sourcePickOf([{ onHandQty: 300, locationId: 3001, warehouseId: 7777 }], wh);

    expect(pick.kind).toBe('unknownBusinessUnit');
  });
});

/*
 * 출발 사업장을 도착 쪽에서 빌리면, 두 창고가 다른 사업장일 때 틀린 값이 기록된다.
 * 되돌릴 수 없는 재고 이동이라 뒤에 고칠 수 없다.
 */
describe('출발 쪽 사업장', () => {
  it('적은 줄에서 창고와 사업장을 함께 꺼낸다', () => {
    const end = sourceEndOf([line({ qty: '80', warehouseId: 1002, businessUnitId: 1002 })]);

    expect(end).toEqual({ warehouseId: 1002, businessUnitId: 1002 });
  });

  it('적은 줄이 없으면 아직 정해지지 않았다', () => {
    expect(sourceEndOf([line()])).toBeNull();
  });

  it('도착 사업장과 다른 값이 그대로 실린다', () => {
    const now = new Date('2026-09-07T09:12:00+09:00');
    const draft = toShipDraft(
      NORMAL,
      { warehouseId: 1001, businessUnitId: 1001 },
      { warehouseId: 1003, businessUnitId: 2002 },
      3005,
      [line({ qty: '80' })],
      now,
      '100028',
    );
    const body = draft.body as { fromBusinessUnitId: number; toBusinessUnitId: number };

    expect(body.fromBusinessUnitId).toBe(1001);
    expect(body.toBusinessUnitId).toBe(2002);
  });
});

describe('도착 가능 여부', () => {
  it('반출된 이동이 없으면 도착할 수 없다', () => {
    expect(canArrive(null, 3005, true)).toBe(false);
  });

  it('도착 위치가 없으면 도착할 수 없다', () => {
    expect(canArrive(transfer(), null, true)).toBe(false);
  });

  it('사번이 없으면 도착할 수 없다', () => {
    expect(canArrive(transfer(), 3005, false)).toBe(false);
  });

  it('셋이 갖춰지면 도착한다', () => {
    expect(canArrive(transfer(), 3005, true)).toBe(true);
  });
});

describe('보낼 것', () => {
  const now = new Date('2026-09-07T09:12:00+09:00');

  it('적은 줄만 싣는다', () => {
    const draft = toShipDraft(
      NORMAL,
      from,
      to,
      3005,
      [line({ qty: '80' }), line({ lotId: 8002 })],
      now,
      '100028',
    );
    const body = draft.body as { lines: { lotId: number }[] };

    expect(body.lines).toHaveLength(1);
    expect(body.lines[0]?.lotId).toBe(8001);
  });

  /* 계약이 라인마다 도착 위치를 필수로 요구한다. 빠지면 반출 자체가 서지 않는다. */
  it('도착 위치를 라인마다 싣는다', () => {
    const draft = toShipDraft(NORMAL, from, to, 3005, [line({ qty: '80' })], now, '100028');
    const body = draft.body as { lines: { toLocationId: number }[] };

    expect(body.lines[0]?.toLocationId).toBe(3005);
  });

  it('사업장 식별자를 창고에서 가져와 싣는다', () => {
    const draft = toShipDraft(NORMAL, from, to, 3005, [line({ qty: '80' })], now, '100028');
    const body = draft.body as { fromBusinessUnitId: number; toBusinessUnitId: number };

    expect(body.fromBusinessUnitId).toBe(1001);
    expect(body.toBusinessUnitId).toBe(1001);
  });

  it('불량 반출도 같은 경로로 보낸다', () => {
    const draft = toShipDraft(DEFECT_RETURN, from, to, 3005, [line({ qty: '80' })], now, '100028');
    const body = draft.body as { transferTypeCode: string };

    expect(body.transferTypeCode).toBe('DEFECT_RETURN');
    expect(draft.path).toBe('/logistics/stock-transfers');
  });

  /* 오프라인에서 늦게 닿아도 언제 한 일인지가 남아야 수불이 그날로 선다. */
  it('업무일자를 함께 싣는다', () => {
    const draft = toShipDraft(NORMAL, from, to, 3005, [line({ qty: '80' })], now, '100028');
    const body = draft.body as { businessDate: string };

    expect(body.businessDate).toBe(now.toISOString().slice(0, 10));
  });

  it('도착은 그 이동을 가리켜 보낸다', () => {
    const draft = toArriveDraft(transfer(), [shippedLine()], 3005, now, '100028');

    expect(draft.path).toBe('/logistics/stock-transfers/7001:arrive');
  });

  /* 반출한 만큼 도착한 것으로 적는다. 줄여 적을 자리는 있으나 왜 줄었는지를 담을 곳이 없다. */
  it('도착 수량은 반출한 만큼으로 적는다', () => {
    const draft = toArriveDraft(transfer(), [shippedLine({ shippedQty: 75 })], 3005, now, '100028');
    const body = draft.body as { lines: { receivedQty: number; toLocationId: number }[] };

    expect(body.lines[0]?.receivedQty).toBe(75);
    expect(body.lines[0]?.toLocationId).toBe(3005);
  });

  /* 반출 수량이 아직 없으면 요청한 만큼으로 본다 - 큐에 담긴 채 도착하는 회차가 있다. */
  it('반출 수량이 비면 요청 수량으로 적는다', () => {
    const draft = toArriveDraft(
      transfer(),
      [shippedLine({ shippedQty: undefined })],
      3005,
      now,
      '100028',
    );
    const body = draft.body as { lines: { receivedQty: number }[] };

    expect(body.lines[0]?.receivedQty).toBe(80);
  });
});
