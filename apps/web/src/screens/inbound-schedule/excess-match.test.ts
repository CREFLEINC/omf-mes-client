import { describe, expect, it } from 'vitest';

import { canTakeExcess, excessesByLine, lineExcessesOf, roomOf } from './excess-match';
import { excessFixture, scheduleLine } from './fixtures';

describe('roomOf — 발주 + 초과 허용치 − 받은 수량', () => {
  it('허용치까지 더해 남은 자리를 잰다', () => {
    expect(roomOf(scheduleLine({ orderedQty: 100, toleranceOverQty: 5, receivedQty: 80 }))).toBe(
      25,
    );
  });
});

describe('canTakeExcess — 서버 후보 규칙을 미리 짐작한다', () => {
  const line = scheduleLine();

  it('같은 공장·공급사·품목·단위이고 자리가 넉넉하면 연결할 수 있다', () => {
    expect(canTakeExcess(line, excessFixture())).toBe(true);
  });

  it('자리가 초과분과 같으면 연결할 수 있다 — 경계는 포함이다', () => {
    expect(canTakeExcess(scheduleLine({ receivedQty: 70 }), excessFixture())).toBe(true);
    expect(canTakeExcess(scheduleLine({ receivedQty: 71 }), excessFixture())).toBe(false);
  });

  it.each([
    ['공장', { plantId: 1 }],
    ['공급사', { supplierId: 1 }],
    ['품목', { itemId: 1 }],
    ['단위', { uomId: 1 }],
  ])('%s 이 다르면 연결하지 않는다', (_name, overrides) => {
    expect(canTakeExcess(line, excessFixture(overrides))).toBe(false);
  });

  it('초과분이 나온 줄 자신의 라인도 자리가 있으면 연결할 수 있다 — ERP 가 발주 수량을 늘려 준 경우(서버와 같다)', () => {
    const excess = excessFixture({
      allocations: [
        {
          inboundReceiptPoAllocationId: 9701,
          inboundReceiptLineId: 9411,
          allocatedQty: 100,
          allocatedAt: '2026-10-20T02:00:00.000Z',
          orderLine: {
            purchaseOrderLineId: line.purchaseOrderLineId,
            purchaseOrderId: line.purchaseOrderId,
            purchaseOrderNo: line.purchaseOrderNo,
            erpPurchaseOrderNo: null,
            lineNo: line.lineNo,
          },
        },
      ],
    });

    expect(canTakeExcess(scheduleLine({ orderedQty: 130, receivedQty: 100 }), excess)).toBe(true);
    expect(canTakeExcess(scheduleLine({ orderedQty: 100, receivedQty: 100 }), excess)).toBe(false);
  });

  it('취소된 라인에는 연결하지 않는다', () => {
    expect(
      canTakeExcess(
        scheduleLine({ cancelledAt: '2026-10-05T03:00:00.000Z', receiptStatusCode: 'CANCELLED' }),
        excessFixture(),
      ),
    ).toBe(false);
  });
});

describe('excessesByLine', () => {
  it('연결할 초과분을 라인마다 모으고, 없는 라인은 담지 않는다', () => {
    const lines = [scheduleLine(), scheduleLine({ purchaseOrderLineId: 7309, itemId: 8399 })];
    const map = excessesByLine(lines, [
      excessFixture(),
      excessFixture({ inboundReceiptLineId: 9412, lineNo: 2 }),
    ]);

    expect(map.size).toBe(1);
    expect(lineExcessesOf(map, 7301).map((row) => row.inboundReceiptLineId)).toEqual([9411, 9412]);
    expect(lineExcessesOf(map, 7309)).toEqual([]);
  });
});
