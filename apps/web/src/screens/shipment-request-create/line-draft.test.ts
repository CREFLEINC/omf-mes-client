import { describe, expect, it } from 'vitest';

import { salesOrderDetailFixture } from './fixtures';
import {
  addLineDraft,
  appendItemLines,
  clearWarehousesOutside,
  emptyLineDraft,
  lineDraftsFromSalesOrder,
  patchLineDraft,
  removeLineDraft,
  setLineWarehouse,
  splitLineDraft,
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

/* ── 피처 012 — 출고 창고 기본값·S/O 줄 나누기·사업부 바꿈 ─────────────────── */

describe('출고 창고 기본값(FR-004)', () => {
  it('US1-4 첫 줄 창고를 고르면 아직 빈 줄을 그 창고로 채우고 「첫 줄 창고로 채움」 표시를 단다', () => {
    const lines = [emptyLineDraft(), emptyLineDraft()];
    const next = setLineWarehouse(lines, lines[0]!.key, '9101');

    expect(next[0]).toMatchObject({ warehouseId: '9101', warehouseFilled: false });
    expect(next[1]).toMatchObject({ warehouseId: '9101', warehouseFilled: true });
  });

  it('US1-4 새 줄은 첫 줄 창고로 시작하고 바꿀 수 있다', () => {
    const lines = setLineWarehouse([emptyLineDraft()], 'none', '');
    const first = setLineWarehouse(lines, lines[0]!.key, '9101');
    const added = addLineDraft(first);

    expect(added[1]).toMatchObject({ warehouseId: '9101', warehouseFilled: true });

    const changed = setLineWarehouse(added, added[1]!.key, '9102');

    expect(changed[1]).toMatchObject({ warehouseId: '9102', warehouseFilled: false });
    /* 첫 줄이 아닌 줄을 바꿔도 다른 줄은 그대로다. */
    expect(changed[0]?.warehouseId).toBe('9101');
  });

  it('US1-4 품목 팝업으로 붙인 줄도 첫 줄 창고로 시작한다', () => {
    const first = setLineWarehouse([emptyLineDraft()], 'x', '');
    const picked = setLineWarehouse(first, first[0]!.key, '9101');
    const next = appendItemLines(picked, [{ itemId: 8302, baseUomId: 8401 }]);

    expect(next[1]).toMatchObject({ itemId: '8302', warehouseId: '9101', warehouseFilled: true });
  });

  it('사람이 고른 창고는 첫 줄을 바꿔도 덮지 않는다', () => {
    const lines = [emptyLineDraft(), emptyLineDraft()];
    const second = setLineWarehouse(lines, lines[1]!.key, '9102');
    const next = setLineWarehouse(second, lines[0]!.key, '9101');

    expect(next[1]?.warehouseId).toBe('9102');
  });
});

describe('S/O 줄 나누기(FR-005)', () => {
  const orderLines = () =>
    lineDraftsFromSalesOrder(toSalesOrderDetailView(salesOrderDetailFixture).lines);

  it('US1-5 [나누기] 줄은 같은 S/O 줄·품목, 배정 0, 첫 줄 창고로 원 줄 바로 아래 붙는다', () => {
    const base = orderLines();
    const withWarehouse = setLineWarehouse(base, base[0]!.key, '9101');
    const next = splitLineDraft(withWarehouse, base[0]!.key);

    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      salesOrderLineId: 8601,
      itemId: '8301',
      allocatedQty: '0',
      requestedQty: '',
      warehouseId: '9101',
      warehouseFilled: true,
      splitOf: base[0]!.key,
      salesOrderLineNo: 1,
    });
  });

  it('US1-5 두 번 나누면 묶음 끝에 차례로 붙는다', () => {
    const base = orderLines();
    const once = splitLineDraft(base, base[0]!.key);
    const twice = splitLineDraft(once, base[0]!.key);

    expect(twice.map((line) => line.splitOf)).toEqual([null, base[0]!.key, base[0]!.key]);
    expect(twice[2]?.key).not.toBe(twice[1]?.key);
  });

  it('US1-5 나눈 줄은 [삭제]로 되돌리고, 나눈 줄을 다시 나누지 않는다', () => {
    const base = orderLines();
    const split = splitLineDraft(base, base[0]!.key);

    expect(splitLineDraft(split, split[1]!.key)).toHaveLength(2);
    expect(removeLineDraft(split, split[1]!.key)).toEqual(base);
  });
});

describe('사업부 바꿈(FR-004)', () => {
  it('US1-7 바꾼 사업부 밖 창고를 고른 줄의 창고를 비우고 노란 표시를 단다', () => {
    const lines = [emptyLineDraft(), emptyLineDraft()];
    const picked = setLineWarehouse(setLineWarehouse(lines, lines[0]!.key, '9101'), lines[1]!.key, '9105');
    const next = clearWarehousesOutside(picked, new Set(['9105']));

    expect(next[0]).toMatchObject({ warehouseId: '', warehouseCleared: true });
    expect(next[1]).toMatchObject({ warehouseId: '9105', warehouseCleared: false });
  });

  it('US1-7 같은 사업부로 되돌려도 비운 값을 살리지 않는다', () => {
    const lines = [emptyLineDraft()];
    const picked = setLineWarehouse(lines, lines[0]!.key, '9101');
    const cleared = clearWarehousesOutside(picked, new Set(['9105']));
    const back = clearWarehousesOutside(cleared, new Set(['9101']));

    expect(back[0]).toMatchObject({ warehouseId: '', warehouseCleared: true });
  });

  it('US1-7 비운 줄은 첫 줄 창고로 다시 채우지 않고, 사람이 고르면 노란 표시가 걷힌다', () => {
    const lines = [emptyLineDraft(), emptyLineDraft()];
    const picked = setLineWarehouse(lines, lines[0]!.key, '9101');
    const cleared = clearWarehousesOutside(picked, new Set());
    const firstAgain = setLineWarehouse(cleared, lines[0]!.key, '9105');

    expect(firstAgain[1]).toMatchObject({ warehouseId: '', warehouseCleared: true });

    const second = setLineWarehouse(firstAgain, lines[1]!.key, '9105');

    expect(second[1]).toMatchObject({ warehouseId: '9105', warehouseCleared: false });
  });
});
