import { describe, expect, it } from 'vitest';

import { defaultExpandedProductionOrderIds, toVisibleProductionOrderHierarchy } from './hierarchy';
import type { ProductionOrderFact } from './types';

const order = (id: number, parent: number | null = null): ProductionOrderFact => ({
  productionOrderId: id,
  productionOrderNo: `PO-${String(id)}`,
  erpOrderNo: null,
  parentProductionOrderId: parent,
  bomLevel: 0,
  businessUnitId: null,
  plantId: null,
  itemId: id,
  orderQty: 1,
  uomId: 1,
  dueDate: null,
  statusCode: 'READY',
  remarks: null,
  expandedWorkOrderCount: null,
  plannedWorkOrderCount: null,
});

const ids = (rows: ReturnType<typeof toVisibleProductionOrderHierarchy>): number[] =>
  rows.map(({ order: item }) => item.productionOrderId);

describe('production-order hierarchy', () => {
  it('서버의 루트·형제 순서를 지키고 기본 전체 펼침을 만든다', () => {
    const orders = [order(20), order(22, 20), order(21, 20), order(10), order(11, 10)];
    const expanded = defaultExpandedProductionOrderIds(orders);
    const rows = toVisibleProductionOrderHierarchy(orders, expanded);

    expect([...expanded]).toEqual([20, 10]);
    expect(ids(rows)).toEqual([20, 22, 21, 10, 11]);
    expect(
      rows.map(({ depth, hasChildren, isExpanded }) => [depth, hasChildren, isExpanded]),
    ).toEqual([
      [0, true, true],
      [1, false, false],
      [1, false, false],
      [0, true, true],
      [1, false, false],
    ]);
  });

  it('부분 접기는 그 자손만 숨기고 다시 펼치면 복원한다', () => {
    const orders = [order(1), order(2, 1), order(3, 2), order(4)];

    expect(ids(toVisibleProductionOrderHierarchy(orders, new Set([2])))).toEqual([1, 4]);
    expect(ids(toVisibleProductionOrderHierarchy(orders, new Set([1, 2])))).toEqual([1, 2, 3, 4]);
  });

  it('누락 부모·자기 참조·순환도 모든 항목을 한 번씩 안전하게 보존한다', () => {
    const orders = [order(7, 99), order(8, 8), order(9, 10), order(10, 9)];
    const rows = toVisibleProductionOrderHierarchy(
      orders,
      defaultExpandedProductionOrderIds(orders),
    );

    expect(ids(rows)).toEqual([7, 8, 9, 10]);
    expect(new Set(ids(rows)).size).toBe(orders.length);
    expect(ids(toVisibleProductionOrderHierarchy(orders, new Set()))).toEqual([7, 8, 9, 10]);
  });

  it('자기참조 부모 아래의 정상 자식 edge는 보존한다', () => {
    const orders = [order(1, 1), order(2, 1)];
    const expanded = defaultExpandedProductionOrderIds(orders);

    expect([...expanded]).toEqual([1]);
    expect(toVisibleProductionOrderHierarchy(orders, expanded)).toMatchObject([
      { order: { productionOrderId: 1 }, depth: 0, hasChildren: true, isExpanded: true },
      { order: { productionOrderId: 2 }, depth: 1, hasChildren: false, isExpanded: false },
    ]);

    const cycleWithChild = [order(3, 4), order(4, 3), order(5, 3)];
    const cycleExpanded = defaultExpandedProductionOrderIds(cycleWithChild);
    expect([...cycleExpanded]).toEqual([3]);
    expect(ids(toVisibleProductionOrderHierarchy(cycleWithChild, cycleExpanded))).toEqual([
      3, 5, 4,
    ]);
  });
});
