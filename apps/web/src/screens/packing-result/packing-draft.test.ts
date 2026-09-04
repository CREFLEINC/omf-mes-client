import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  addLine,
  normalizeScanCode,
  packedTotal,
  qtyError,
  remainingOf,
  remainingTotal,
  removeLine,
  toProgress,
} from './packing-draft';
import type { PackedLine, ShipmentLotAllocation } from './types';

const t = messages.packingResult;

/** 배분 하나. 값은 전부 지어낸 것이다. */
const allocation = (overrides: Partial<ShipmentLotAllocation> = {}): ShipmentLotAllocation => ({
  shipmentLotAllocationId: 9001,
  shipmentId: 501,
  shipmentLineId: 701,
  itemId: 5001,
  itemCode: 'SYN-FG-1001',
  lotId: 8001,
  lotNo: 'SYN-LOT-000123450',
  warehouseId: 1001,
  allocatedQty: 180,
  uomId: 920001,
  oqcPassed: true,
  packedQty: 0,
  ...overrides,
});

const lineOfAllocation = (source: ShipmentLotAllocation, qty: number): PackedLine => ({
  shipmentLotAllocationId: source.shipmentLotAllocationId,
  itemId: source.itemId,
  itemCode: source.itemCode,
  lotId: source.lotId,
  lotNo: source.lotNo ?? '',
  uomId: source.uomId,
  qty,
  remaining: remainingOf(source),
});

describe('remainingOf', () => {
  it('배분 잔여는 서버가 준 두 칸의 차다', () => {
    expect(remainingOf(allocation({ allocatedQty: 180, packedQty: 60 }))).toBe(120);
  });

  it('이미 배정보다 많이 담긴 배분에서도 음수를 내지 않는다', () => {
    expect(remainingOf(allocation({ allocatedQty: 100, packedQty: 140 }))).toBe(0);
  });
});

describe('qtyError', () => {
  it('잔여와 «같은» 수량은 통과한다 — 경계는 넘긴 것이 아니다', () => {
    expect(qtyError('180', allocation(), [])).toBeUndefined();
  });

  it('잔여를 1 넘기면 한도를 말한다', () => {
    expect(qtyError('181', allocation(), [])).toBe(t.qty.overRemaining(180));
  });

  it('이미 담은 몫을 «빼고» 한도를 잰다 — 잔여만 보면 두 번 담아 넘긴다', () => {
    const source = allocation();
    const lines = [lineOfAllocation(source, 120)];

    expect(qtyError('61', source, lines)).toBe(t.qty.overRemaining(60));
    expect(qtyError('60', source, lines)).toBeUndefined();
  });

  it('0과 빈 값과 숫자가 아닌 것은 담지 못한다', () => {
    expect(qtyError('0', allocation(), [])).toBe(t.qty.notPositive);
    expect(qtyError('', allocation(), [])).toBe(t.qty.notPositive);
    expect(qtyError('abc', allocation(), [])).toBe(t.qty.notPositive);
    expect(qtyError('-5', allocation(), [])).toBe(t.qty.notPositive);
  });
});

describe('addLine', () => {
  it('새 배분은 줄로 담긴다', () => {
    const outcome = addLine([], allocation(), 120);

    expect(outcome.lines).toHaveLength(1);
    expect(outcome.lines[0]?.qty).toBe(120);
    expect(outcome.merged).toBeUndefined();
  });

  it('같은 배분을 다시 담으면 «합치고» 합쳤다고 말한다', () => {
    const source = allocation();
    const first = addLine([], source, 120);
    const second = addLine(first.lines, source, 60);

    expect(second.lines).toHaveLength(1);
    expect(second.lines[0]?.qty).toBe(180);
    expect(second.merged).toEqual({ before: 120, added: 60, after: 180 });
  });

  it('다른 배분은 별개의 줄이다', () => {
    const first = addLine([], allocation(), 120);
    const second = addLine(first.lines, allocation({ shipmentLotAllocationId: 9002 }), 60);

    expect(second.lines).toHaveLength(2);
    expect(second.merged).toBeUndefined();
  });
});

describe('removeLine · 합계', () => {
  it('줄을 빼면 그 줄만 사라진다', () => {
    const lines = addLine(
      addLine([], allocation(), 120).lines,
      allocation({ shipmentLotAllocationId: 9002 }),
      60,
    ).lines;

    expect(removeLine(lines, 9001)).toHaveLength(1);
    expect(removeLine(lines, 9001)[0]?.shipmentLotAllocationId).toBe(9002);
  });

  it('합계는 담은 것의 합이고 분모는 그 줄들의 잔여 합이다', () => {
    const lines = addLine(
      addLine([], allocation(), 120).lines,
      allocation({ shipmentLotAllocationId: 9002, allocatedQty: 60 }),
      60,
    ).lines;

    expect(packedTotal(lines)).toBe(180);
    expect(remainingTotal(lines)).toBe(240);
  });
});

describe('toProgress', () => {
  it('포장 개수는 «서로 다른» 포장 식별자의 수다', () => {
    const progress = toProgress([
      allocation({ shipmentLotAllocationId: 1, handlingUnitId: 4001, packedQty: 180 }),
      allocation({ shipmentLotAllocationId: 2, handlingUnitId: 4001, packedQty: 180 }),
      allocation({ shipmentLotAllocationId: 3, handlingUnitId: 4002, packedQty: 180 }),
    ]);

    expect(progress.packedCount).toBe(2);
  });

  it('포장에 담기지 않은 배분은 세지 않고, 미포장 수량은 잔여의 합이다', () => {
    const progress = toProgress([
      allocation({ shipmentLotAllocationId: 1, handlingUnitId: null, packedQty: 60 }),
      allocation({ shipmentLotAllocationId: 2, handlingUnitId: 4001, packedQty: 180 }),
    ]);

    expect(progress.packedCount).toBe(1);
    expect(progress.unpackedQty).toBe(120);
  });
});

describe('normalizeScanCode', () => {
  it('앞뒤 공백만 턴다 — ⛔ 대소문자를 화면이 정하지 않는다', () => {
    expect(normalizeScanCode('  dl-2026-0455-001 ')).toBe('dl-2026-0455-001');
  });

  it('빈 스캔은 보내지 않는다', () => {
    expect(normalizeScanCode('   ')).toBeNull();
  });
});
