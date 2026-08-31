import { describe, expect, it } from 'vitest';

import {
  addAllocation,
  allocationSum,
  createLineAllocationDrafts,
  isLineBalanced,
  lineAllocationIssues,
  removeAllocation,
  setAllocationLot,
  setAllocationQty,
  setShippedQty,
  toAllocationRows,
  type LineAllocationDraft,
} from './line-allocation-draft';
import type { ShipmentRequestLineCandidate } from './types';

const sourceLine = (
  overrides: Partial<ShipmentRequestLineCandidate> = {},
): ShipmentRequestLineCandidate => ({
  shipmentRequestLineId: 701,
  lineNo: 1,
  itemId: 910001,
  requestedQty: 100,
  allocatedQty: 100,
  pickedQty: 100,
  shippedQty: 0,
  uomId: 920001,
  shippingInspectionRequired: false,
  ...overrides,
});

const draft = (overrides: Partial<LineAllocationDraft> = {}): LineAllocationDraft => ({
  shipmentRequestLineId: 701,
  lineNo: 1,
  itemId: 910001,
  uomId: 920001,
  requestedQty: 100,
  allocatedQty: 100,
  pickedQty: 100,
  shippedQty: '',
  allocations: [],
  ...overrides,
});

describe('createLineAllocationDrafts', () => {
  it('라인마다 빈 초안을 만든다', () => {
    const drafts = createLineAllocationDrafts([sourceLine(), sourceLine({ lineNo: 2 })]);

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ shippedQty: '', allocations: [] });
  });
});

describe('addAllocation·removeAllocation', () => {
  it('추가하면 배분이 하나 늘고 서로 다른 draftId를 받는다', () => {
    const withOne = addAllocation(draft());
    const withTwo = addAllocation(withOne);

    expect(withTwo.allocations).toHaveLength(2);
    expect(withTwo.allocations[0]?.draftId).not.toBe(withTwo.allocations[1]?.draftId);
  });

  it('삭제하면 그 배분만 없어진다', () => {
    const withTwo = addAllocation(addAllocation(draft()));
    const targetId = withTwo.allocations[0]?.draftId ?? '';

    const removed = removeAllocation(withTwo, targetId);

    expect(removed.allocations).toHaveLength(1);
    expect(removed.allocations.some((allocation) => allocation.draftId === targetId)).toBe(false);
  });
});

describe('setAllocationLot·setAllocationQty·setShippedQty', () => {
  it('지정한 배분만 값을 바꾼다', () => {
    const withTwo = addAllocation(addAllocation(draft()));
    const [first, second] = withTwo.allocations;

    const updated = setAllocationQty(
      setAllocationLot(withTwo, first?.draftId ?? '', 1001),
      first?.draftId ?? '',
      '40',
    );

    expect(updated.allocations[0]).toMatchObject({ lotId: 1001, qty: '40' });
    expect(updated.allocations[1]).toEqual(second);
  });

  it('출하수량을 바꾼다', () => {
    expect(setShippedQty(draft(), '120').shippedQty).toBe('120');
  });
});

describe('allocationSum', () => {
  it('읽을 수 있는 수량만 더한다', () => {
    const line = draft({
      allocations: [
        { draftId: 'a', lotId: 1001, qty: '40' },
        { draftId: 'b', lotId: 1002, qty: '60' },
      ],
    });

    expect(allocationSum(line)).toBe(100);
  });

  it('못 읽는 값은 0으로 접는다', () => {
    const line = draft({
      allocations: [
        { draftId: 'a', lotId: 1001, qty: '40' },
        { draftId: 'b', lotId: 1002, qty: '' },
        { draftId: 'c', lotId: 1003, qty: '-5' },
      ],
    });

    expect(allocationSum(line)).toBe(40);
  });
});

describe('lineAllocationIssues·isLineBalanced', () => {
  it('출하수량이 없으면 SHIPPED_QTY_INVALID를 낸다', () => {
    const line = draft({ allocations: [{ draftId: 'a', lotId: 1001, qty: '100' }] });

    expect(lineAllocationIssues(line)).toContain('SHIPPED_QTY_INVALID');
  });

  it('배분이 없으면 NO_ALLOCATIONS를 낸다', () => {
    const line = draft({ shippedQty: '100' });

    expect(lineAllocationIssues(line)).toContain('NO_ALLOCATIONS');
  });

  it('LOT을 고르지 않은 배분이 있으면 LOT_NOT_SELECTED를 낸다', () => {
    const line = draft({
      shippedQty: '100',
      allocations: [{ draftId: 'a', lotId: null, qty: '100' }],
    });

    expect(lineAllocationIssues(line)).toContain('LOT_NOT_SELECTED');
  });

  it('수량을 못 읽는 배분이 있으면 ALLOCATION_QTY_INVALID를 낸다', () => {
    const line = draft({
      shippedQty: '100',
      allocations: [{ draftId: 'a', lotId: 1001, qty: '' }],
    });

    expect(lineAllocationIssues(line)).toContain('ALLOCATION_QTY_INVALID');
  });

  it('같은 LOT을 두 번 고르면 DUPLICATE_LOT을 낸다', () => {
    const line = draft({
      shippedQty: '100',
      allocations: [
        { draftId: 'a', lotId: 1001, qty: '50' },
        { draftId: 'b', lotId: 1001, qty: '50' },
      ],
    });

    expect(lineAllocationIssues(line)).toContain('DUPLICATE_LOT');
  });

  it('다른 항목이 온전한데 합이 다르면 SUM_MISMATCH를 낸다', () => {
    const line = draft({
      shippedQty: '100',
      allocations: [{ draftId: 'a', lotId: 1001, qty: '40' }],
    });

    expect(lineAllocationIssues(line)).toEqual(['SUM_MISMATCH']);
    expect(isLineBalanced(line)).toBe(false);
  });

  it('다른 항목이 어긋난 채로는 SUM_MISMATCH를 내지 않는다 — 원인이 가려지지 않게 한다', () => {
    const line = draft({
      shippedQty: '',
      allocations: [{ draftId: 'a', lotId: null, qty: '' }],
    });

    expect(lineAllocationIssues(line)).not.toContain('SUM_MISMATCH');
  });

  it('전부 맞으면 문제가 없다', () => {
    const line = draft({
      shippedQty: '100',
      allocations: [
        { draftId: 'a', lotId: 1001, qty: '40' },
        { draftId: 'b', lotId: 1002, qty: '60' },
      ],
    });

    expect(lineAllocationIssues(line)).toEqual([]);
    expect(isLineBalanced(line)).toBe(true);
  });
});

describe('toAllocationRows', () => {
  it('배분이 없는 라인은 자리표시 행 하나를 낸다', () => {
    const rows = toAllocationRows([draft()]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ isPlaceholder: true, lotId: null, qty: '' });
  });

  it('배분이 있는 라인은 배분마다 행을 낸다', () => {
    const rows = toAllocationRows([
      draft({
        allocations: [
          { draftId: 'a', lotId: 1001, qty: '40' },
          { draftId: 'b', lotId: 1002, qty: '60' },
        ],
      }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.every((row) => !row.isPlaceholder)).toBe(true);
    expect(rows.map((row) => row.rowKey)).toEqual(['701:a', '701:b']);
  });

  it('여러 라인이 섞이면 각자의 행을 낸다', () => {
    const rows = toAllocationRows([
      draft(),
      draft({
        shipmentRequestLineId: 702,
        lineNo: 2,
        allocations: [{ draftId: 'c', lotId: 2001, qty: '10' }],
      }),
    ]);

    expect(rows.map((row) => row.shipmentRequestLineId)).toEqual([701, 702]);
  });
});
