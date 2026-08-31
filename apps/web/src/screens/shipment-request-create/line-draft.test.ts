import { describe, expect, it } from 'vitest';

import { salesOrderDetailFixture } from './fixtures';
import {
  addLineDraft,
  emptyLineDraft,
  lineDraftsFromSalesOrder,
  patchLineDraft,
  removeLineDraft,
} from './line-draft';
import { toSalesOrderDetailView } from './types';

describe('lineDraftsFromSalesOrder', () => {
  it('잔여가 있는 라인만 승계한다', () => {
    const detail = toSalesOrderDetailView(salesOrderDetailFixture);
    const drafts = lineDraftsFromSalesOrder(detail.lines);

    /* 라인 8602는 주문 50 · 출하 50이라 잔여가 0이라 빠진다. */
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.salesOrderLineId).toBe(8601);
  });

  it('요청 수량·배정 수량 기본값이 잔여 수량이다', () => {
    const detail = toSalesOrderDetailView(salesOrderDetailFixture);
    const [draft] = lineDraftsFromSalesOrder(detail.lines);

    /* 주문 100 · 출하 20 → 잔여 80. */
    expect(draft?.requestedQty).toBe('80');
    expect(draft?.allocatedQty).toBe('80');
  });

  it('줄마다 서로 다른 안정 키를 만든다', () => {
    const detail = toSalesOrderDetailView({
      ...salesOrderDetailFixture,
      lines: [
        { salesOrderLineId: 1, lineNo: 1, itemId: 1, orderedQty: 10, uomId: 1, shippedQty: 0 },
        { salesOrderLineId: 2, lineNo: 2, itemId: 2, orderedQty: 10, uomId: 1, shippedQty: 0 },
      ],
    });
    const drafts = lineDraftsFromSalesOrder(detail.lines);

    expect(drafts[0]?.key).not.toBe(drafts[1]?.key);
  });
});

describe('addLineDraft', () => {
  it('빈 줄을 더한다 — 값을 지어내지 않는다', () => {
    const next = addLineDraft([]);

    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      salesOrderLineId: null,
      itemId: '',
      requestedQty: '',
      allocatedQty: '',
    });
  });
});

describe('removeLineDraft', () => {
  it('그 줄만 뺀다', () => {
    const a = emptyLineDraft();
    const b = emptyLineDraft();

    expect(removeLineDraft([a, b], a.key)).toEqual([b]);
  });
});

describe('patchLineDraft', () => {
  it('한 줄의 값만 바꾼다', () => {
    const a = emptyLineDraft();
    const b = emptyLineDraft();

    const next = patchLineDraft([a, b], a.key, { itemId: '8301' });

    expect(next.find((line) => line.key === a.key)?.itemId).toBe('8301');
    expect(next.find((line) => line.key === b.key)?.itemId).toBe('');
  });

  it('없는 키는 그냥 지나간다', () => {
    const a = emptyLineDraft();

    expect(patchLineDraft([a], 'no-such-key', { itemId: '1' })).toEqual([a]);
  });
});
