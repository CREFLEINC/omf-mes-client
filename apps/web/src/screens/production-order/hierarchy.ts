import type { ProductionOrderFact } from './types';

export interface ProductionOrderHierarchyEntry {
  order: ProductionOrderFact;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
}

const toRelations = (orders: readonly ProductionOrderFact[]) => {
  const byId = new Map(orders.map((order) => [order.productionOrderId, order]));
  const children = new Map<number, ProductionOrderFact[]>();
  const linked = new Set<number>();
  for (const order of orders) {
    const parentId = order.parentProductionOrderId;
    if (parentId === null || parentId === order.productionOrderId || !byId.has(parentId)) continue;
    const ancestry = new Set([order.productionOrderId]);
    let ancestorId: number | null = parentId;
    while (ancestorId !== null && byId.has(ancestorId) && !ancestry.has(ancestorId)) {
      ancestry.add(ancestorId);
      ancestorId = byId.get(ancestorId)?.parentProductionOrderId ?? null;
    }
    if (ancestorId === order.productionOrderId) continue;
    const siblings = children.get(parentId) ?? [];
    siblings.push(order);
    children.set(parentId, siblings);
    linked.add(order.productionOrderId);
  }
  return { byId, children, linked };
};

export const defaultExpandedProductionOrderIds = (
  orders: readonly ProductionOrderFact[],
): ReadonlySet<number> => new Set(toRelations(orders).children.keys());

export const toVisibleProductionOrderHierarchy = (
  orders: readonly ProductionOrderFact[],
  expandedIds: ReadonlySet<number>,
): ProductionOrderHierarchyEntry[] => {
  const { byId, children, linked } = toRelations(orders);
  const emitted = new Set<number>();
  const visible: ProductionOrderHierarchyEntry[] = [];
  const append = (order: ProductionOrderFact, depth: number): void => {
    if (emitted.has(order.productionOrderId)) return;
    emitted.add(order.productionOrderId);
    const descendants = children.get(order.productionOrderId) ?? [];
    const hasChildren = descendants.length > 0;
    const isExpanded = hasChildren && expandedIds.has(order.productionOrderId);
    visible.push({ order, depth, hasChildren, isExpanded });
    if (isExpanded) descendants.forEach((child) => append(child, depth + 1));
  };

  for (const order of orders) {
    if (!linked.has(order.productionOrderId)) append(order, 0);
  }
  for (const order of orders) {
    if (emitted.has(order.productionOrderId)) continue;
    let parentId = order.parentProductionOrderId;
    const seen = new Set([order.productionOrderId]);
    while (parentId !== null && byId.has(parentId) && !seen.has(parentId)) {
      if (emitted.has(parentId)) break;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentProductionOrderId ?? null;
    }
    if (parentId === null || !byId.has(parentId) || seen.has(parentId)) append(order, 0);
  }
  return visible;
};
