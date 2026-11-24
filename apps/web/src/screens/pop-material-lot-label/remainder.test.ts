import { describe, expect, it } from 'vitest';

import { remainderLotIds } from './label-table';
import type { LabelLot } from './types';

/** 미출력 탭 한 줄 — 자동, P/O 라인 7101, 100 EA. */
const row = (lotId: number, seq: number, over: Partial<LabelLot> = {}): LabelLot => ({
  lotId,
  lotNo: `SYN|100|261124|SYN-S|${String(lotId)}`,
  supplierId: 1,
  supplierCode: 'SYN-S',
  supplierName: '합성 공급사',
  itemId: 2,
  itemCode: 'SYN',
  itemName: '합성 품목',
  uomCode: 'EA',
  lotQty: 100,
  package: null,
  supplierLotNo: null,
  lifecycleStatusCode: 'WAITING',
  statusCode: 'INSPECTION_PENDING',
  inboundLotNo: null,
  lastIssue: null,
  seq,
  creationModeCode: 'AUTO',
  purchaseOrderLine: { purchaseOrderLineId: 7101, purchaseOrderNo: 'PO-1', lineNo: 1 },
  ...over,
});

describe('US3-1 FR-004 「나머지」 칩은 P/O 라인 마지막 자동 LOT 에만', () => {
  it('FR-004 P/O 250 → 100 · 100 · 50 이면 마지막 50 에만 붙는다', () => {
    const lots = [row(1, 1), row(2, 2), row(3, 3, { lotQty: 50 })];

    expect([...remainderLotIds(lots, 100, false)]).toEqual([3]);
  });

  it('US3-1 [수정]으로 줄인 LOT(100 → 80)에는 붙지 않는다 — 빈 몫 20 은 더 큰 차례로 다시 만들어진다', () => {
    const lots = [
      row(1, 1, { lotQty: 80 }),
      row(2, 2),
      row(3, 3, { lotQty: 50 }),
      row(4, 4, { lotQty: 20 }),
    ];

    expect([...remainderLotIds(lots, 100, false)]).toEqual([4]);
  });

  it('FR-004 라인마다 따로 — 수동 LOT · P/O 라인 없는 LOT 에는 붙지 않는다', () => {
    const other = { purchaseOrderLineId: 7102, purchaseOrderNo: 'PO-2', lineNo: 1 };
    const lots = [
      row(1, 1, { creationModeCode: 'MANUAL', purchaseOrderLine: null, lotQty: 30 }),
      row(2, 2, { lotQty: 40 }),
      row(3, 3, { purchaseOrderLine: other }),
      row(4, 4, { purchaseOrderLine: other, lotQty: 60 }),
    ];

    expect([...remainderLotIds(lots, 100, false)].sort()).toEqual([2, 4]);
  });

  it('FR-004 이 쪽 마지막 줄이고 뒤에 쪽이 더 있으면 라인이 이어질 수 있어 붙이지 않는다', () => {
    const lots = [row(1, 1), row(2, 2, { lotQty: 80 })];

    expect([...remainderLotIds(lots, 100, true)]).toEqual([]);
    expect([...remainderLotIds(lots, 100, false)]).toEqual([2]);
  });

  it('FR-004 품목 기본 수량을 모르면 붙이지 않는다', () => {
    expect([...remainderLotIds([row(1, 1, { lotQty: 50 })], null, false)]).toEqual([]);
  });
});
