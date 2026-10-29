import { describe, expect, it } from 'vitest';

import {
  activeFilterCount,
  emptyLotlessFilter,
  initialLotlessFilter,
  matchesLotlessFilter,
  shortDate,
} from './lotless';
import { queuedQtyOf, toLotlessOutboxDraft, type PurchaseOrder } from './receipt';

const order = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  purchaseOrderId: 7,
  purchaseOrderNo: 'PO-2026-0003',
  supplierId: 2,
  businessUnitId: 1,
  plantId: 1,
  orderDate: '2026-08-20',
  expectedReceiptDate: '2026-10-21',
  statusCode: 'OPEN',
  ...overrides,
});

describe('라벨 미부착 입고 예정 거르기', () => {
  it('조건이 없으면 모두 남긴다', () => {
    expect(matchesLotlessFilter(order(), '합성공급사', emptyLotlessFilter)).toBe(true);
    expect(activeFilterCount(emptyLotlessFilter)).toBe(0);
  });

  it('공급사명은 대소문자 없이 일부만 맞으면 된다', () => {
    const filter = { ...emptyLotlessFilter, supplierName: ' 합성 ' };

    expect(matchesLotlessFilter(order(), '(주)합성공급사', filter)).toBe(true);
    expect(matchesLotlessFilter(order(), '대한부품', filter)).toBe(false);
    expect(matchesLotlessFilter(order(), 'ACME Korea', { ...filter, supplierName: 'acme' })).toBe(
      true,
    );
  });

  it('기간은 고른 기준의 날짜로 두 끝을 포함해 견준다', () => {
    const expected = {
      ...emptyLotlessFilter,
      period: ['2026-10-21', '2026-10-31'] as [string, string],
    };

    expect(matchesLotlessFilter(order(), '합성', expected)).toBe(true);
    expect(
      matchesLotlessFilter(order({ expectedReceiptDate: '2026-10-20' }), '합성', expected),
    ).toBe(false);
    /* 발주일 기준이면 예정일은 보지 않는다. */
    expect(matchesLotlessFilter(order(), '합성', { ...expected, basis: 'ordered' })).toBe(false);
    expect(
      matchesLotlessFilter(order(), '합성', {
        ...expected,
        basis: 'ordered',
        period: ['2026-08-01', '2026-08-20'],
      }),
    ).toBe(true);
    /* 기간은 접지 않고 늘 보여 「필터」 단추의 수에 넣지 않는다(사용자 지시 2026-10-22). */
    expect(activeFilterCount(expected)).toBe(0);
    expect(activeFilterCount({ ...expected, doneOnly: true })).toBe(0);
  });

  /* 처음 여는 2-1 은 납기예정일 오늘 ±2주 - 전체 기간을 매번 받지 않는다(사용자 지시 2026-10-22). */
  it('처음 조건은 납기예정일 오늘 앞뒤 2주다', () => {
    expect(initialLotlessFilter(new Date(2026, 9, 22))).toEqual({
      ...emptyLotlessFilter,
      period: ['2026-10-08', '2026-11-05'],
    });
  });

  /* 예정일이 없는 발주를 기간 안이라고 말할 수 없다. */
  it('예정일 기준 기간을 걸면 예정일이 없는 발주는 빠진다', () => {
    const filter = {
      ...emptyLotlessFilter,
      period: ['2000-01-01', '2099-12-31'] as [string, string],
    };

    expect(matchesLotlessFilter(order({ expectedReceiptDate: null }), '합성', filter)).toBe(false);
  });

  it('표 칸의 날짜는 YY.MM.DD 이고 없으면 줄표다', () => {
    expect(shortDate('2026-08-20')).toBe('26.08.20');
    expect(shortDate('2025-12-30')).toBe('25.12.30');
    expect(shortDate(null)).toBe('—');
  });
});

describe('라벨 미부착 일괄 입하 본문', () => {
  const line = (id: number, itemId: number, qty: number) => ({
    purchaseOrderLineId: id,
    purchaseOrderId: 7,
    lineNo: id - 40,
    itemId,
    orderedQty: qty,
    uomId: 9,
    receivedQty: 0,
    toleranceOverQty: 0,
    toleranceUnderQty: 0,
  });

  it('체크한 라인을 품목마다 입하 한 건(:per-line)으로 담고 라인마다 LOT 번호 없음과 사유를 싣는다', () => {
    const entry = toLotlessOutboxDraft(
      order({ plantId: 3 }),
      [
        { line: line(41, 31, 500), receivedQty: 500 },
        { line: line(42, 32, 80), receivedQty: 70 },
      ],
      'NO_LABEL',
      new Date('2026-10-21T01:00:00Z'),
      '900028',
    );
    const body = entry.body as {
      supplierId: number;
      plantId: number;
      lines: Record<string, unknown>[];
    };

    /* 입하번호는 품목마다 하나 — 본문은 입하 등록과 같고 보내는 곳만 다르다(장부 P-117). */
    expect(entry.path).toBe('/logistics/inbound-receipts:per-line');
    expect(body.supplierId).toBe(2);
    expect(body.plantId).toBe(3);
    expect(body.lines).toHaveLength(2);
    expect(body.lines[1]).toMatchObject({
      purchaseOrderLineId: 42,
      itemId: 32,
      receivedQty: 70,
      uomId: 9,
      supplierLotNo: null,
      supplierLotMissing: true,
      supplierLotLabelAttached: false,
      substituteLotReasonCode: 'NO_LABEL',
    });
    /* 담긴 채 못 간 수량으로 셈에 들어가야 같은 라인을 두 번 받지 않는다. */
    expect(queuedQtyOf([entry], 42)).toBe(70);
  });
});
