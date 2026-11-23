import { describe, expect, it } from 'vitest';

import {
  MANAGEMENT_CODE_MAX,
  activeLots,
  canReplace,
  chooseLine,
  codeProblem,
  lineTiles,
  partiesText,
  oqcTone,
  pickRejectionOf,
  replacedLots,
  replaceEffect,
  type ShipmentRequestLine,
  type ShipmentRequestLot,
  inTerminalScope,
  onlyOutOfScope,
  terminalShareDone,
  warehouseTagOf,
} from './picking';

const lot = (overrides: Partial<ShipmentRequestLot> = {}): ShipmentRequestLot => ({
  shipmentRequestLotId: 1,
  lotId: 11,
  lotNo: 'P2611-0001',
  itemId: 31,
  pickedQty: 40,
  uomId: 9,
  statusCode: 'PICKED',
  managementCode: null,
  pickedAt: '2026-11-18T01:00:00Z',
  pickedWorker: null,
  shipmentId: null,
  portions: [],
  oqcLotStatus: 'NOT_INSPECTED',
  oqcResult: null,
  replacement: null,
  ...overrides,
});

const line = (overrides: Partial<ShipmentRequestLine> = {}): ShipmentRequestLine => ({
  shipmentRequestLineId: 77,
  lineNo: 1,
  itemId: 31,
  itemCode: 'FG-A100',
  itemName: '센서 모듈',
  requestedQty: 100,
  allocatedQty: 100,
  pickedQty: 80,
  shippedQty: 0,
  uomId: 9,
  uomCode: 'EA',
  salesOrderLine: null,
  shippingInspectionRequired: true,
  picks: [],
  overQty: 0,
  lots: [],
  /* 피처 012 — 줄 출고 창고. 옛 줄(창고 미지정)과 같다. */
  warehouse: null,
  ...overrides,
});

describe('스캔한 LOT 의 라인 고르기', () => {
  it('US1-1 스캔한 LOT 의 품목으로 라인을 찾는다', () => {
    const lines = [
      line({ shipmentRequestLineId: 1, itemId: 50 }),
      line({ shipmentRequestLineId: 2 }),
    ];

    expect(chooseLine(lines, 31)?.shipmentRequestLineId).toBe(2);
  });

  it('US1-1 같은 품목 라인이 둘이면 남은 수량이 있는 앞 라인이다', () => {
    const lines = [
      line({ shipmentRequestLineId: 1, pickedQty: 100 }),
      line({ shipmentRequestLineId: 2, pickedQty: 10 }),
      line({ shipmentRequestLineId: 3, pickedQty: 0 }),
    ];

    expect(chooseLine(lines, 31)?.shipmentRequestLineId).toBe(2);
  });

  /* 모두 채웠으면 앞 라인으로 보낸다 — 서버가 「목표 수량을 채웠습니다」로 거절해 그 말을 보인다. */
  it('US1-2 같은 품목 라인이 모두 목표를 채웠으면 앞 라인이다', () => {
    const lines = [
      line({ shipmentRequestLineId: 1, pickedQty: 110 }),
      line({ shipmentRequestLineId: 2, pickedQty: 100 }),
    ];

    expect(chooseLine(lines, 31)?.shipmentRequestLineId).toBe(1);
  });

  it('FR-006 그 품목 라인이 없으면 고르지 않는다', () => {
    expect(chooseLine([line()], 99)).toBeNull();
  });
});

describe('라인 수치', () => {
  it('US1-1 목표에 못 미치면 남음을 보인다', () => {
    expect(lineTiles(line({ pickedQty: 80 }))).toEqual({
      target: 100,
      picked: 80,
      kind: 'remaining',
      value: 20,
    });
  });

  it('US1-1 목표를 넘으면 초과를 보인다(서버 overQty)', () => {
    expect(lineTiles(line({ pickedQty: 110, overQty: 10 }))).toEqual({
      target: 100,
      picked: 110,
      kind: 'over',
      value: 10,
    });
  });

  it('US1-1 목표와 같으면 초과 0 이다', () => {
    expect(lineTiles(line({ pickedQty: 100, overQty: 0 })).kind).toBe('over');
  });

  it('US2-2 교체된 LOT 은 피킹 LOT 에서 빠지고 이력으로만 남는다', () => {
    const lots = [
      lot({ shipmentRequestLotId: 1 }),
      lot({ shipmentRequestLotId: 2, statusCode: 'REPLACED' }),
      lot({ shipmentRequestLotId: 3, statusCode: 'SHIPPED' }),
    ];

    expect(activeLots(line({ lots })).map((each) => each.shipmentRequestLotId)).toEqual([1, 3]);
    expect(replacedLots(line({ lots })).map((each) => each.shipmentRequestLotId)).toEqual([2]);
  });

  it('US1-1 새로 집은 LOT 이 라인 맨 위에 온다', () => {
    const lots = [
      lot({ shipmentRequestLotId: 1, pickedAt: '2026-11-18T01:00:00Z' }),
      lot({ shipmentRequestLotId: 2, pickedAt: '2026-11-18T03:00:00Z' }),
    ];

    expect(activeLots(line({ lots }))[0]?.shipmentRequestLotId).toBe(2);
  });
});

describe('[교체]', () => {
  it('US2-1 판정이 불합격인 피킹 LOT 에만 있다', () => {
    expect(canReplace(lot({ oqcLotStatus: 'REJECTED' }))).toBe(true);
    expect(canReplace(lot({ oqcLotStatus: 'HELD' }))).toBe(false);
    expect(canReplace(lot({ oqcLotStatus: 'ACCEPTED' }))).toBe(false);
  });

  it('US2-6 재검 합격으로 덮이면 사라진다', () => {
    expect(canReplace(lot({ oqcLotStatus: 'ACCEPTED' }))).toBe(false);
  });

  it('US2-1 출하된 LOT 이나 교체한 LOT 에는 없다', () => {
    expect(canReplace(lot({ oqcLotStatus: 'REJECTED', statusCode: 'SHIPPED' }))).toBe(false);
    expect(canReplace(lot({ oqcLotStatus: 'REJECTED', statusCode: 'REPLACED' }))).toBe(false);
  });

  it('US2-2 빠지는 수량과 라인이 다시 받는 수량을 미리 센다', () => {
    const effect = replaceEffect(line({ pickedQty: 110 }), lot({ pickedQty: 30 }));

    expect(effect).toEqual({ before: 110, after: 80, receive: 20 });
  });

  it('US2-2 빠져도 목표 이상이면 다시 받지 않는다', () => {
    expect(replaceEffect(line({ pickedQty: 150 }), lot({ pickedQty: 30 })).receive).toBe(0);
  });
});

describe('LOT 판정 배지 6종', () => {
  it('FR-007 판정마다 색이 다르다', () => {
    expect(oqcTone('ACCEPTED')).toBe('success');
    expect(oqcTone('REJECTED')).toBe('error');
    expect(oqcTone('HELD')).toBe('warning');
    expect(oqcTone('NOT_INSPECTED')).toBe('info');
    expect(oqcTone('NOT_REQUIRED')).toBe('idle');
    expect(oqcTone('SKIPPED')).toBe('idle');
  });
});

describe('출하 관리 코드', () => {
  it('US5-2 100자를 넘으면 막는다', () => {
    expect(MANAGEMENT_CODE_MAX).toBe(100);
    expect(codeProblem('a'.repeat(100))).toBeNull();
    expect(codeProblem('a'.repeat(101))).toBe('tooLong');
  });

  it('US5-1 비워 둬도 된다', () => {
    expect(codeProblem('')).toBeNull();
  });
});

describe('피킹 거절', () => {
  it('US1-2 서버 코드로 가른다', () => {
    expect(
      pickRejectionOf({ kind: 'conflict', cause: 'user', code: 'LOT_TARGET_REACHED', message: '' }),
    ).toEqual({ kind: 'code', code: 'LOT_TARGET_REACHED' });
    expect(
      pickRejectionOf({
        kind: 'conflict',
        cause: 'user',
        code: 'LOT_ALREADY_RESERVED',
        message: '',
      }),
    ).toEqual({ kind: 'code', code: 'LOT_ALREADY_RESERVED' });
    expect(
      pickRejectionOf({ kind: 'conflict', cause: 'user', code: 'LOT_ALREADY_PICKED', message: '' }),
    ).toEqual({ kind: 'code', code: 'LOT_ALREADY_PICKED' });
    expect(
      pickRejectionOf({ kind: 'conflict', cause: 'user', code: 'NO_LINE_FOR_ITEM', message: '' }),
    ).toEqual({ kind: 'code', code: 'NO_LINE_FOR_ITEM' });
    /* 피처 013 Q14 — 확인 전 분리 LOT. */
    expect(
      pickRejectionOf({
        kind: 'conflict',
        cause: 'user',
        code: 'LOT_SPLIT_UNCONFIRMED',
        message: '',
      }),
    ).toEqual({ kind: 'code', code: 'LOT_SPLIT_UNCONFIRMED' });
  });

  it('FR-006 보류·불량·재고 없음은 서버 문구를 그대로 쓴다', () => {
    expect(
      pickRejectionOf({
        kind: 'conflict',
        cause: 'user',
        code: 'INVALID_STATE',
        message: '보류 중인 LOT 입니다. (사유: QC)',
      }),
    ).toEqual({ kind: 'server', message: '보류 중인 LOT 입니다. (사유: QC)' });
    expect(
      pickRejectionOf({
        kind: 'validation',
        status: 400,
        errors: [
          { scope: 'field', field: 'lotId', code: 'RANGE', message: '잔여 유효기간이 모자랍니다.' },
        ],
      }),
    ).toEqual({ kind: 'server', message: '잔여 유효기간이 모자랍니다.' });
  });

  it('연결이 끊기면 다시 스캔하라고 한다', () => {
    expect(pickRejectionOf({ kind: 'network' })).toEqual({ kind: 'failed' });
  });
});

describe('partiesText', () => {
  it('US4-4 고객과 납품처를 쉼표로 잇고, 같거나 없으면 고객만 쓴다', () => {
    expect(partiesText('가나전자', '가나전자 2공장')).toBe('가나전자, 가나전자 2공장');
    expect(partiesText('가나전자', '가나전자')).toBe('가나전자');
    expect(partiesText('가나전자', null)).toBe('가나전자');
  });
});

/* ── 피처 012 — 이 기기 범위 · 줄 창고 ─────────────────────────────────── */

describe('이 기기 범위 줄 고르기(피처 012)', () => {
  const inside = (patch: Partial<ShipmentRequestLine>) =>
    line({ inTerminalScope: true, outOfScopeReason: null, ...patch });
  const outside = (patch: Partial<ShipmentRequestLine>) =>
    line({ inTerminalScope: false, outOfScopeReason: 'OTHER_PLANT', ...patch });

  it('US2-1 범위 밖 줄은 경로로 보내지 않는다 — 같은 품목이면 범위 안 줄을 고른다', () => {
    const lines = [
      outside({ shipmentRequestLineId: 1, pickedQty: 0 }),
      inside({ shipmentRequestLineId: 2, pickedQty: 0 }),
    ];

    expect(chooseLine(lines, 31)?.shipmentRequestLineId).toBe(2);
  });

  it('US2-4 범위 안 같은 품목 줄이 둘이면 남은 수량이 있는 앞 줄(서버가 LOT 창고로 다시 고른다)', () => {
    const lines = [
      inside({ shipmentRequestLineId: 1, pickedQty: 100 }),
      inside({ shipmentRequestLineId: 3, pickedQty: 0 }),
    ];

    expect(chooseLine(lines, 31)?.shipmentRequestLineId).toBe(3);
  });

  it('그 품목 줄이 범위 밖뿐이면 고르지 않고 「범위 밖」으로 가른다', () => {
    const lines = [outside({ shipmentRequestLineId: 1 })];

    expect(chooseLine(lines, 31)).toBeNull();
    expect(onlyOutOfScope(lines, 31)).toBe(true);
    expect(onlyOutOfScope(lines, 99)).toBe(false);
  });

  it('US6-2 범위 칸이 없는 옛 응답은 범위 안으로 본다', () => {
    expect(inTerminalScope(line({}))).toBe(true);
  });

  it('시안 ⑦ 이 기기 줄이 다 찼고 범위 밖 줄이 남았을 때만 「이 기기 몫은 끝났습니다」', () => {
    expect(terminalShareDone([inside({ pickedQty: 100 }), outside({ shipmentRequestLineId: 2 })])).toBe(true);
    expect(terminalShareDone([inside({ pickedQty: 50 }), outside({ shipmentRequestLineId: 2 })])).toBe(false);
    expect(terminalShareDone([inside({ pickedQty: 100 })])).toBe(false);
  });

  it('US6-1 줄 창고 꼬리표 — 창고 (공장), 옛 줄은 창고 미지정', () => {
    const words = { tag: (w: string, p: string) => `${w} (${p})`, unassigned: '창고 미지정' };

    expect(
      warehouseTagOf(
        line({ warehouse: { warehouseId: 1, warehouseCode: 'A', warehouseName: '완제품창고 A', plantId: 1, plantName: '1공장' } }),
        words,
      ),
    ).toBe('완제품창고 A (1공장)');
    expect(warehouseTagOf(line({ warehouse: null }), words)).toBe('창고 미지정');
  });

  it('US2-5 409 LOT_NOT_IN_LINE_WAREHOUSE 는 LOT 이 있는 창고들을 함께 가른다', () => {
    expect(
      pickRejectionOf({
        kind: 'conflict',
        cause: 'user',
        code: 'LOT_NOT_IN_LINE_WAREHOUSE',
        message: '',
        warehouses: [{ warehouseId: 2, warehouseName: '완제품창고 B', plantName: '2공장' }],
      }),
    ).toEqual({
      kind: 'code',
      code: 'LOT_NOT_IN_LINE_WAREHOUSE',
      warehouses: [{ warehouseId: 2, warehouseName: '완제품창고 B', plantName: '2공장' }],
    });
    expect(
      pickRejectionOf({ kind: 'conflict', cause: 'user', code: 'LINE_WAREHOUSE_UNAVAILABLE', message: '' }),
    ).toEqual({ kind: 'code', code: 'LINE_WAREHOUSE_UNAVAILABLE' });
  });
});
