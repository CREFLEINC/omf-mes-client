import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { ProductionOrderPlanFact } from './detail-queries';
import type { ProductionOrderHierarchyEntry } from './hierarchy';
import type { ProductionOrderItemName } from './item-lookups';
import type { ReferenceSource } from './reference-lookups';
import { toBasicDetailState, toDetailListState, toProductionOrderRows } from './screen-model';
import type { ProductionOrderFact } from './types';

const t = messages.productionOrder;
const order = (id: number, overrides: Partial<ProductionOrderFact> = {}): ProductionOrderFact => ({
  productionOrderId: id,
  productionOrderNo: `SYN-PO-${String(id)}`,
  erpOrderNo: `SYN-ERP-${String(id)}`,
  parentProductionOrderId: null,
  bomLevel: 0,
  businessUnitId: 2101,
  plantId: 3101,
  itemId: 7100 + id,
  orderQty: 12.5,
  uomId: 8101,
  dueDate: '2026-08-31',
  statusCode: 'SYN-READY',
  remarks: null,
  expandedWorkOrderCount: 2,
  plannedWorkOrderCount: 3,
  ...overrides,
});
const entry = (
  fact: ProductionOrderFact,
  overrides: Partial<ProductionOrderHierarchyEntry> = {},
): ProductionOrderHierarchyEntry => ({
  order: fact,
  depth: 0,
  hasChildren: false,
  isExpanded: false,
  ...overrides,
});
const references = (overrides: Partial<ReferenceSource> = {}): ReferenceSource => ({
  entries: [{ value: '8101', label: 'SYN-EA · Synthetic each' }],
  isLoading: false,
  isError: false,
  truncated: false,
  ...overrides,
});
const item = (
  itemId: number,
  status: ProductionOrderItemName['status'] = 'named',
): ProductionOrderItemName => ({
  itemId,
  status,
  label: status === 'named' ? `SYN-ITEM-${String(itemId)} · Synthetic item` : null,
});

describe('toProductionOrderRows', () => {
  it('서버 계층 순서·깊이와 사람이 읽는 품목·UOM 사실을 보존한다', () => {
    const parent = order(1, { itemId: 7101 });
    const child = order(2, { itemId: 7102, erpOrderNo: null, dueDate: null, orderQty: 0 });

    expect(
      toProductionOrderRows(
        [entry(parent, { hasChildren: true, isExpanded: true }), entry(child, { depth: 1 })],
        [item(7102), item(7101)],
        references(),
      ),
    ).toEqual([
      {
        productionOrderId: 1,
        productionOrderNo: 'SYN-PO-1',
        erpProductionOrderNo: 'SYN-ERP-1',
        itemLabel: 'SYN-ITEM-7101 · Synthetic item',
        orderedQtyLabel: '12.5 SYN-EA · Synthetic each',
        dueDateLabel: '2026-08-31',
        statusCode: 'SYN-READY',
        depth: 0,
        hasChildren: true,
        isExpanded: true,
        expandedWorkOrderCount: 2,
        plannedWorkOrderCount: 3,
      },
      expect.objectContaining({
        productionOrderId: 2,
        erpProductionOrderNo: null,
        orderedQtyLabel: '0 SYN-EA · Synthetic each',
        dueDateLabel: null,
        depth: 1,
      }),
    ]);
  });

  it('품목과 UOM 상태를 내부 ID 대신 fail-closed 문구로 표시한다', () => {
    const facts = [
      order(1, { itemId: 7101 }),
      order(2, { itemId: 7102 }),
      order(3, { itemId: 7103 }),
      order(4, { itemId: 7104 }),
    ];
    const rows = toProductionOrderRows(
      facts.map((fact) => entry(fact)),
      [item(7101, 'loading'), item(7102, 'unknown'), item(7103, 'failed'), item(9999)],
      references({ isError: true }),
    );

    expect(rows.map((row) => row.itemLabel)).toEqual([
      t.values.itemLoading,
      t.values.itemUnknown,
      t.values.itemFailed,
      t.values.itemUnknown,
    ]);
    for (const row of rows) expect(row.orderedQtyLabel).toContain(t.values.referenceFailed);
  });
});

describe('screen query state adapters', () => {
  it('선택과 정확히 일치하는 상세만 DATA로 허용한다', () => {
    const selected = order(701);
    expect(toBasicDetailState(701, { data: selected, isError: false })).toEqual({
      kind: 'DATA',
      data: selected,
    });
    expect(toBasicDetailState(702, { data: selected, isError: false })).toEqual({
      kind: 'LOADING',
    });
    expect(toBasicDetailState(null, { data: selected, isError: false })).toEqual({
      kind: 'LOADING',
    });
    expect(toBasicDetailState(701, { data: selected, isError: true })).toEqual({ kind: 'ERROR' });
  });

  it('상세 목록의 error·loading·data를 빈 성공과 구분한다', () => {
    const plans: ProductionOrderPlanFact[] = [];
    expect(toDetailListState({ data: undefined, isError: false })).toEqual({ kind: 'LOADING' });
    expect(toDetailListState({ data: { items: plans }, isError: true })).toEqual({ kind: 'ERROR' });
    expect(toDetailListState({ data: { items: plans }, isError: false })).toEqual({
      kind: 'DATA',
      items: [],
    });
  });
});
