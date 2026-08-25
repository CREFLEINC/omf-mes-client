import { messages } from '@omf-mes/i18n';

import type { ProductionOrderHierarchyEntry } from './hierarchy';
import type { ProductionOrderItemName } from './item-lookups';
import type { ProductionOrderBasicDetailState } from './production-order-basic-pane';
import type { ProductionOrderDetailListState } from './production-order-detail-list-pane';
import { describeReference, resolveReference, type ReferenceSource } from './reference-lookups';
import type { ProductionOrderFact, ProductionOrderRow } from './types';

const t = messages.productionOrder;

export interface QuerySnapshot<T> {
  data: T | undefined;
  isError: boolean;
}

const describeItem = (
  itemId: number,
  itemNames: ReadonlyMap<number, ProductionOrderItemName>,
): string => {
  const item = itemNames.get(itemId);
  if (item === undefined || item.itemId !== itemId || item.status === 'unknown') {
    return t.values.itemUnknown;
  }
  if (item.status === 'loading') return t.values.itemLoading;
  if (item.status === 'failed') return t.values.itemFailed;
  return item.label === null || item.label.trim() === '' ? t.values.itemUnknown : item.label;
};

export const toProductionOrderRows = (
  entries: readonly ProductionOrderHierarchyEntry[],
  itemNames: readonly ProductionOrderItemName[],
  uoms: ReferenceSource,
): ProductionOrderRow[] => {
  const namesById = new Map(itemNames.map((item) => [item.itemId, item]));

  return entries.map(({ order, depth, hasChildren, isExpanded }) => ({
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    erpProductionOrderNo: order.erpOrderNo,
    itemLabel: describeItem(order.itemId, namesById),
    orderedQtyLabel: `${String(order.orderQty)} ${describeReference(resolveReference(uoms, order.uomId))}`,
    dueDateLabel: order.dueDate,
    statusCode: order.statusCode,
    depth,
    hasChildren,
    isExpanded,
    expandedWorkOrderCount: order.expandedWorkOrderCount,
    plannedWorkOrderCount: order.plannedWorkOrderCount,
  }));
};

export const toBasicDetailState = (
  selectedProductionOrderId: number | null,
  query: QuerySnapshot<ProductionOrderFact>,
): ProductionOrderBasicDetailState => {
  if (query.isError) return { kind: 'ERROR' };
  if (
    selectedProductionOrderId === null ||
    query.data === undefined ||
    query.data.productionOrderId !== selectedProductionOrderId
  ) {
    return { kind: 'LOADING' };
  }
  return { kind: 'DATA', data: query.data };
};

export const toDetailListState = <T>(
  query: QuerySnapshot<{ items: T[] }>,
): ProductionOrderDetailListState<T> => {
  if (query.isError) return { kind: 'ERROR' };
  if (query.data === undefined) return { kind: 'LOADING' };
  return { kind: 'DATA', items: query.data.items };
};
