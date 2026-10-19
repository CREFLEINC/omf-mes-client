import { describe, expect, it } from 'vitest';

import { inboundReceiptLine } from './fixtures';
import { chooseReceiptTarget, receiptTargetsOf, splitQtyOf } from './receipt-target';

const SPLIT = {
  lotId: 9602,
  lotNo: 'SAMPLE-LOT-0001-S1',
  statusCode: 'DEFECTIVE',
  receivableQty: 15,
};

describe('receiptTargetsOf', () => {
  it('원 LOT 은 입고 가능 수량(양품)으로, 선별 불량분은 따로 선다', () => {
    const line = inboundReceiptLine({ receivedQty: 50, receivableQty: 35, splitLots: [SPLIT] });

    expect(receiptTargetsOf(line)).toEqual([
      { lotId: 9601, splitLotNo: null, qty: 35 },
      { lotId: 9602, splitLotNo: 'SAMPLE-LOT-0001-S1', qty: 15 },
    ]);
    expect(splitQtyOf(line)).toBe(15);
  });

  it('서버가 입고 가능 수량을 싣지 않으면 입하 수량을 쓴다(지금까지의 동작)', () => {
    expect(receiptTargetsOf(inboundReceiptLine({ receivedQty: 100 }))).toEqual([
      { lotId: 9601, splitLotNo: null, qty: 100 },
    ]);
  });

  it('이미 다 입고한 선별 불량분은 대상에서 빠진다', () => {
    const line = inboundReceiptLine({ splitLots: [{ ...SPLIT, receivableQty: 0 }] });
    expect(receiptTargetsOf(line)).toHaveLength(1);
  });
});

describe('chooseReceiptTarget', () => {
  const targets = [
    { lotId: 1, splitLotNo: null, qty: 0 },
    { lotId: 2, splitLotNo: 'X-S1', qty: 15 },
  ];

  it('고른 것이 있으면 그것, 없으면 수량이 남은 첫 대상', () => {
    expect(chooseReceiptTarget(targets, 1)?.lotId).toBe(1);
    expect(chooseReceiptTarget(targets, null)?.lotId).toBe(2);
    expect(chooseReceiptTarget([], null)).toBeNull();
  });
});
