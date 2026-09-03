import { describe, expect, it } from 'vitest';

import {
  addLine,
  findScannedLot,
  isMixedLot,
  judgeQuantity,
  toContentUpserts,
  toPackingLine,
  totalQty,
} from './contents';
import type { Lot, PackingLine } from './types';

const lot = (over: Partial<Lot>): Lot =>
  ({
    lotId: 1001,
    lotNo: 'LOT-2026-0804-0031',
    itemId: 2001,
    lotTypeCode: 'PRODUCTION',
    plantId: 1,
    initialQty: 380,
    uomId: 3001,
    sourceTypeCode: 'WORK_ORDER',
    sourceId: 9001,
    statusCode: 'NORMAL',
    ...over,
  }) as Lot;

const line = (over: Partial<PackingLine> = {}): PackingLine => ({
  lotId: 1001,
  lotNo: 'LOT-2026-0804-0031',
  itemId: 2001,
  uomId: 3001,
  qty: 100,
  ...over,
});

describe('judgeQuantity', () => {
  it('빈 칸과 0 이하를 다른 사유로 가른다', () => {
    expect(judgeQuantity('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(judgeQuantity('0')).toEqual({ ok: false, reason: 'notPositive' });
    expect(judgeQuantity('-5')).toEqual({ ok: false, reason: 'notPositive' });
  });

  it('숫자가 아닌 입력을 되돌린다', () => {
    expect(judgeQuantity('열개')).toEqual({ ok: false, reason: 'notNumber' });
  });

  it('양수를 그대로 읽는다', () => {
    expect(judgeQuantity(' 100 ')).toEqual({ ok: true, qty: 100 });
    expect(judgeQuantity('12.5')).toEqual({ ok: true, qty: 12.5 });
  });
});

describe('addLine', () => {
  it('같은 품목·LOT 을 다시 담으면 행을 늘리지 않고 수량을 합산한다', () => {
    const first = addLine([], line({ qty: 100 }));
    const second = addLine(first, line({ qty: 50 }));

    expect(second).toHaveLength(1);
    expect(second[0]?.qty).toBe(150);
  });

  it('다른 LOT 은 새 행으로 담는다', () => {
    const rows = addLine([line()], line({ lotId: 1002, lotNo: 'LOT-…0032', qty: 50 }));

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.qty)).toEqual([100, 50]);
  });

  it('같은 LOT 이라도 품목이 다르면 합산하지 않는다', () => {
    const rows = addLine([line()], line({ itemId: 2002, qty: 20 }));

    expect(rows).toHaveLength(2);
  });

  it('원본 배열을 고치지 않는다', () => {
    const before = [line({ qty: 100 })];

    addLine(before, line({ qty: 50 }));

    expect(before[0]?.qty).toBe(100);
  });
});

describe('totalQty · isMixedLot', () => {
  it('합계를 더한다', () => {
    expect(totalQty([line({ qty: 100 }), line({ lotId: 1002, qty: 50 })])).toBe(150);
    expect(totalQty([])).toBe(0);
  });

  it('LOT 이 둘 이상일 때만 혼적이다', () => {
    expect(isMixedLot([])).toBe(false);
    expect(isMixedLot([line()])).toBe(false);
    expect(isMixedLot([line(), line({ qty: 50 })])).toBe(false);
    expect(isMixedLot([line(), line({ lotId: 1002 })])).toBe(true);
  });
});

describe('toContentUpserts', () => {
  it('담은 것 전부를 싣는다 — 집합을 통째로 치환하기 때문이다', () => {
    const rows = [line({ qty: 100 }), line({ lotId: 1002, lotNo: 'LOT-…0032', qty: 50 })];

    expect(toContentUpserts(rows)).toEqual([
      { itemId: 2001, lotId: 1001, qty: 100, uomId: 3001 },
      { itemId: 2001, lotId: 1002, qty: 50, uomId: 3001 },
    ]);
  });

  it('표시용 번호를 요청에 싣지 않는다', () => {
    expect(Object.keys(toContentUpserts([line()])[0] ?? {})).not.toContain('lotNo');
  });
});

describe('findScannedLot', () => {
  const lots = [lot({}), lot({ lotId: 1002, lotNo: 'LOT-2026-0804-0032' })];

  it('번호가 정확히 같은 LOT 을 찾는다', () => {
    expect(findScannedLot(lots, ' LOT-2026-0804-0032 ')?.lotId).toBe(1002);
  });

  it('목록 밖의 번호는 담지 않는다', () => {
    expect(findScannedLot(lots, 'LOT-2026-0804-9999')).toBeNull();
    expect(findScannedLot(lots, '  ')).toBeNull();
  });
});

describe('toPackingLine', () => {
  it('품목·단위를 LOT 에서 가져온다', () => {
    expect(toPackingLine(lot({}), 100)).toEqual({
      lotId: 1001,
      lotNo: 'LOT-2026-0804-0031',
      itemId: 2001,
      uomId: 3001,
      qty: 100,
    });
  });
});
