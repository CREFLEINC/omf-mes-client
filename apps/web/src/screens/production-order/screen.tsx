import { AlertBanner, Breadcrumb, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useProductionOrderPlans, useProductionOrderWorkOrders } from './detail-queries';
import {
  DEFAULT_PRODUCTION_ORDER_FILTERS,
  readFilters,
  readPage,
  readSelectedProductionOrderId,
  toSearchParams,
  toSelectionSearchParams,
} from './filters';
import { defaultExpandedProductionOrderIds, toVisibleProductionOrderHierarchy } from './hierarchy';
import { useProductionOrderItemNames } from './item-lookups';
import { toPageView } from './pagination';
import { ProductionOrderBasicPane } from './production-order-basic-pane';
import { ProductionOrderDetailListPane } from './production-order-detail-list-pane';
import { ProductionOrderFilterBar } from './production-order-filter-bar';
import { ProductionOrderListPane } from './production-order-list-pane';
import { useProductionOrderDetail, useProductionOrderList } from './queries';
import {
  lookupNote,
  useBusinessUnitReferenceLookup,
  usePlantReferenceLookup,
  useUomReferenceLookup,
} from './reference-lookups';
import { toBasicDetailState, toDetailListState, toProductionOrderRows } from './screen-model';
import type { ProductionOrderFact, SelectOption } from './types';

const t = messages.productionOrder;
const EMPTY_FACTS: ProductionOrderFact[] = [];

export const ProductionOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const page = readPage(searchParams);
  const selectedId = readSelectedProductionOrderId(searchParams);

  const list = useProductionOrderList(filters, page);
  const detail = useProductionOrderDetail(selectedId);
  const plans = useProductionOrderPlans(selectedId);
  const workOrders = useProductionOrderWorkOrders(selectedId);
  const businessUnits = useBusinessUnitReferenceLookup();
  const plants = usePlantReferenceLookup();
  const uoms = useUomReferenceLookup();
  const facts = list.data?.items ?? EMPTY_FACTS;
  const itemIds = useMemo(() => {
    const ids = facts.map((order) => order.itemId);
    if (filters.item !== '') ids.push(Number(filters.item));
    if (detail.data !== undefined) ids.push(detail.data.itemId);
    return ids;
  }, [detail.data, facts, filters.item]);
  const itemNames = useProductionOrderItemNames(itemIds);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<number>>(new Set());
  const expandedIds = useMemo(() => {
    const expanded = new Set(defaultExpandedProductionOrderIds(facts));
    collapsedIds.forEach((id) => expanded.delete(id));
    return expanded;
  }, [collapsedIds, facts]);
  const rows = toProductionOrderRows(
    toVisibleProductionOrderHierarchy(facts, expandedIds),
    itemNames.items,
    uoms,
  );
  const pageView = toPageView(list.data?.page ?? { page, size: 25, total: 0 }, facts.length);
  const itemOptions: SelectOption[] = itemNames.items.flatMap((item) =>
    item.status === 'named' && item.label !== null
      ? [{ value: String(item.itemId), label: item.label }]
      : [],
  );
  const selectedItemName =
    detail.data === undefined
      ? null
      : (itemNames.items.find((item) => item.itemId === detail.data?.itemId) ?? null);
  const isSelected = selectedId !== null;

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      <section className="pane" aria-label={t.panes.filters}>
        <ProductionOrderFilterBar
          appliedFilters={filters}
          businessUnitOptions={[...businessUnits.entries]}
          plantOptions={[...plants.entries]}
          itemOptions={itemOptions}
          statusOptions={filters.status === '' ? [] : [filters.status]}
          businessUnitNote={lookupNote(businessUnits)}
          plantNote={lookupNote(plants)}
          itemNote={itemNames.isLoading ? t.values.itemLoading : undefined}
          statusNote={t.values.statusOptionsPending}
          onSearch={(next) => setSearchParams(toSearchParams(next, 1))}
          onReset={() => setSearchParams(toSearchParams(DEFAULT_PRODUCTION_ORDER_FILTERS, 1))}
        />
      </section>

      {list.isError ? (
        <AlertBanner variant="error" title={t.listLoadFailedTitle}>
          {t.listLoadFailedDescription}
        </AlertBanner>
      ) : (
        <ProductionOrderListPane
          rows={rows}
          isLoading={list.isPending}
          page={pageView}
          selectedProductionOrderId={selectedId}
          onSelect={(id) => setSearchParams(toSelectionSearchParams(searchParams, id))}
          onToggleExpanded={(id) => {
            setCollapsedIds((current) => {
              const next = new Set(current);
              if (expandedIds.has(id)) next.add(id);
              else next.delete(id);
              return next;
            });
          }}
          onChangePage={(nextPage) => setSearchParams(toSearchParams(filters, nextPage))}
        />
      )}

      <div className="three-pane">
        <ProductionOrderBasicPane
          isSelected={isSelected}
          detailState={toBasicDetailState(selectedId, detail)}
          itemName={selectedItemName}
          businessUnits={businessUnits}
          plants={plants}
          uoms={uoms}
        />
        <ProductionOrderDetailListPane
          kind="plans"
          isSelected={isSelected}
          state={toDetailListState(plans)}
          uoms={uoms}
        />
        <ProductionOrderDetailListPane
          kind="workOrders"
          isSelected={isSelected}
          state={toDetailListState(workOrders)}
          uoms={uoms}
        />
      </div>
    </>
  );
};
