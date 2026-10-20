import { AlertBanner, Breadcrumb, Button, PageHeader, useToast } from '@crefle/web-ui';
import type { ProductionOrderAutoPlanResult } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { SaveErrorBanner } from '../../patterns/master';
import { autoPlanReasonLabels } from './auto-plan-chip';
import { useProductionOrderCodeNames } from './code-names';
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
import { useAutoPlanMutation } from './mutations';
import { toPageView } from './pagination';
import { ProductionOrderBasicPane } from './production-order-basic-pane';
import { ProductionOrderDetailListPane } from './production-order-detail-list-pane';
import { ProductionOrderFilterBar } from './production-order-filter-bar';
import { ProductionOrderListPane } from './production-order-list-pane';
import { productionOrderKeys, useProductionOrderDetail, useProductionOrderList } from './queries';
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

/**
 * 자동 계획을 한 번도 하지 않은(`autoPlan === null`) P/O 는 계획이 없으므로, 아직 수신 상태면
 * 수량 전부가 남은 것이다 — 지난 납기·옛 P/O 도 필요할 때 계획할 수 있게 단추를 낸다.
 */
const canAutoPlan = (order: ProductionOrderFact | undefined): boolean =>
  order !== undefined &&
  (order.autoPlan === null
    ? order.statusCode === 'RECEIVED'
    : order.autoPlan.status === 'NEEDS_REVIEW');

const autoPlanToast = (result: ProductionOrderAutoPlanResult) => {
  switch (result.outcome) {
    case 'CONFIRMED':
      return { variant: 'success', description: t.autoPlan.confirmed } as const;
    case 'DRAFT':
      return { variant: 'info', description: t.autoPlan.draft } as const;
    case 'NOT_PLANNED':
      return {
        variant: 'warning',
        title: t.autoPlan.notPlanned,
        description: autoPlanReasonLabels(result.reasons).join(' · '),
      } as const;
  }
};

export const ProductionOrderScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
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
  const codeNames = useProductionOrderCodeNames();
  const autoPlan = useAutoPlanMutation({
    onSuccess: (result) => toast.show(autoPlanToast(result)),
  });
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
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
      />
      <section
        className="pane production-order-pane production-order-filter-pane"
        aria-label={t.panes.filters}
      >
        <h2>{t.panes.filters}</h2>
        <ProductionOrderFilterBar
          appliedFilters={filters}
          businessUnitOptions={[...businessUnits.entries]}
          plantOptions={[...plants.entries]}
          itemOptions={itemOptions}
          statusOptions={filters.status === '' ? [] : [filters.status]}
          businessUnitNote={lookupNote(businessUnits)}
          plantNote={lookupNote(plants)}
          itemNote={itemNames.isLoading ? t.values.itemLoading : undefined}
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
          statusNameOf={codeNames.productionOrderStatus}
          onSelect={(id) => {
            autoPlan.reset();
            setSearchParams(toSelectionSearchParams(searchParams, id));
          }}
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

      <SaveErrorBanner
        error={autoPlan.error}
        onReload={() => {
          autoPlan.reset();
          void queryClient.invalidateQueries({ queryKey: productionOrderKeys.all });
        }}
      />
      <div className="production-order-detail-grid">
        <ProductionOrderBasicPane
          isSelected={isSelected}
          detailState={toBasicDetailState(selectedId, detail)}
          itemName={selectedItemName}
          businessUnits={businessUnits}
          plants={plants}
          uoms={uoms}
          statusNameOf={codeNames.productionOrderStatus}
          action={
            selectedId === null ? undefined : (
              <div className="production-order-pane-actions">
                {canAutoPlan(detail.data) && (
                  <Button
                    variant="outlined"
                    disabled={autoPlan.isSaving}
                    onClick={() => autoPlan.write(selectedId)}
                  >
                    {t.actions.autoPlan}
                  </Button>
                )}
                {/* 「초기화」와 같은 DS 테두리 단추. 누르면 W/O 전개·편성 화면으로 이동만 한다. */}
                <Button
                  variant="outlined"
                  onClick={() => {
                    void navigate(
                      `/production/production-plans?productionOrderId=${String(selectedId)}`,
                    );
                  }}
                >
                  {t.actions.productionPlan}
                </Button>
              </div>
            )
          }
        />
        <ProductionOrderDetailListPane
          kind="plans"
          isSelected={isSelected}
          state={toDetailListState(plans)}
          uoms={uoms}
          codeNames={codeNames}
        />
        <ProductionOrderDetailListPane
          kind="workOrders"
          isSelected={isSelected}
          state={toDetailListState(workOrders)}
          uoms={uoms}
          codeNames={codeNames}
        />
      </div>
      <AlertBanner className="production-order-erp-notice" variant="info">
        {t.values.erpReadOnlyNotice}
        <br />
        {t.values.erpSyncHint}{' '}
        <Link to="/master-data/integration-sync">{t.actions.integrationSync}</Link>
      </AlertBanner>
    </>
  );
};
