import { AlertBanner, Breadcrumb, Button, PageHeader, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { useProductionOrderItemNames } from '../production-order/item-lookups';
import { useProductionOrderDetail } from '../production-order/queries';
import {
  describeReference,
  resolveReference,
  useUomReferenceLookup,
} from '../production-order/reference-lookups';
import type { ProductionOrderFact } from '../production-order/types';
import { describeItem } from '../production-order/screen-model';
import { ProductionPlanEditorSection } from './editor-section';
import {
  bomRevisionLabel,
  isMasterCheckReady,
  MasterCheckPane,
  routingRevisionLabel,
} from './master-check-pane';
import {
  useBomReferenceQuery,
  useProductionLineReferenceQuery,
  useRoutingReferenceQuery,
} from './reference-queries';
import { WorkOrderResultPane } from './work-order-result-pane';

const tPlan = messages.productionPlan;
const t = tPlan.screen;

const readProductionOrderId = (params: URLSearchParams): number | null => {
  const raw = params.get('productionOrderId');
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

const quantity = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value);
const BREADCRUMB = (
  <Breadcrumb
    items={[
      { label: tPlan.breadcrumbRoot },
      { label: tPlan.breadcrumbGroup },
      { label: tPlan.title },
    ]}
  />
);

const ProductionPlanWorkspace = ({
  order,
  orderUnavailable,
}: {
  order: ProductionOrderFact;
  orderUnavailable: boolean;
}) => {
  const [bomId, setBomId] = useState('');
  const [routingId, setRoutingId] = useState('');
  const [resultPlanId, setResultPlanId] = useState<number | null>(null);
  const boms = useBomReferenceQuery(order.itemId);
  const routings = useRoutingReferenceQuery(order.itemId);
  const lines = useProductionLineReferenceQuery(order.plantId);
  const itemNames = useProductionOrderItemNames([order.itemId]);
  const uoms = useUomReferenceLookup();
  const bomItems = boms.data?.items ?? [];
  const routingItems = routings.data?.items ?? [];
  const lineItems = lines.data?.items ?? [];
  const masterReady = isMasterCheckReady(bomItems, routingItems, bomId, routingId);
  const referencesLoaded = boms.data !== undefined && routings.data !== undefined;
  const linesLoaded = order.plantId === null || lines.data !== undefined;
  const referenceFailed = boms.isError || routings.isError || lines.isError;
  const uomLabel = describeReference(resolveReference(uoms, order.uomId));
  const lineNames = useMemo(
    () => new Map(lineItems.map((line) => [line.productionLineId, line.lineName])),
    [lineItems],
  );
  const defaults = { planDate: '', plannedQty: '', bomId, routingId };

  return (
    <div className="production-plan-workspace">
      <section className="pane production-plan-order-summary" aria-label={tPlan.order.pane}>
        <header className="production-plan-order-heading">
          <span>{tPlan.order.heading}</span>
          <h2>{order.productionOrderNo}</h2>
        </header>
        <p className="production-plan-order-facts">
          {describeItem(order.itemId, new Map(itemNames.items.map((item) => [item.itemId, item])))}{' '}
          · {quantity(order.orderQty)} {uomLabel}
          {order.dueDate === null ? '' : tPlan.order.due(order.dueDate)}
        </p>
      </section>
      <MasterCheckPane
        boms={{
          items: bomItems,
          isLoading: boms.isPending && boms.data === undefined,
          isError: boms.isError,
          refetch: () => void boms.refetch(),
        }}
        routings={{
          items: routingItems,
          isLoading: routings.isPending && routings.data === undefined,
          isError: routings.isError,
          refetch: () => void routings.refetch(),
        }}
        bomId={bomId}
        routingId={routingId}
        onBomChange={setBomId}
        onRoutingChange={setRoutingId}
      />
      {order.plantId !== null && lines.isPending && lines.data === undefined && (
        <div role="status" aria-label={tPlan.lines.loading}>
          <SkeletonText lines={2} />
        </div>
      )}
      {lines.isError && (
        <AlertBanner
          variant="error"
          title={tPlan.lines.loadFailed}
          action={
            <Button size="sm" variant="outlined" onClick={() => void lines.refetch()}>
              {tPlan.lines.retry}
            </Button>
          }
        />
      )}
      {order.plantId === null && (
        <AlertBanner variant="info">{tPlan.lines.plantMissing}</AlertBanner>
      )}
      {referencesLoaded && linesLoaded && (
        <ProductionPlanEditorSection
          productionOrderId={order.productionOrderId}
          orderQty={order.orderQty}
          uomId={order.uomId}
          uomLabel={uomLabel}
          defaults={defaults}
          bomOptions={bomItems.map((item) => ({
            value: String(item.bomId),
            label: bomRevisionLabel(item),
          }))}
          routingOptions={routingItems.map((item) => ({
            value: String(item.routingId),
            label: routingRevisionLabel(item),
          }))}
          lineOptions={lineItems.map((line) => ({
            value: String(line.productionLineId),
            label: `${line.parentLineId === null ? '' : `${lineNames.get(line.parentLineId) ?? tPlan.lines.parentUnknown} > `}${line.lineCode} · ${line.lineName}${line.isActive ? '' : tPlan.lines.inactiveSuffix}`,
          }))}
          addDisabled={!masterReady || referenceFailed || orderUnavailable}
          onShowResults={setResultPlanId}
        />
      )}
      {resultPlanId !== null && (
        <WorkOrderResultPane
          key={resultPlanId}
          productionPlanId={resultPlanId}
          uomLabel={uomLabel}
        />
      )}
      <AlertBanner variant="info">{t.lotNotice}</AlertBanner>
    </div>
  );
};

export const ProductionPlanScreen = () => {
  const [searchParams] = useSearchParams();
  const productionOrderId = readProductionOrderId(searchParams);
  const order = useProductionOrderDetail(productionOrderId);
  const [trustedOrder, setTrustedOrder] = useState<ProductionOrderFact | null>(null);
  const ownerMismatch =
    productionOrderId !== null &&
    order.data !== undefined &&
    order.data.productionOrderId !== productionOrderId;
  const matchingOrder = ownerMismatch ? undefined : order.data;
  useEffect(() => {
    if (matchingOrder !== undefined) setTrustedOrder(matchingOrder);
  }, [matchingOrder]);
  const workspaceOrder =
    matchingOrder ?? (trustedOrder?.productionOrderId === productionOrderId ? trustedOrder : null);
  const orderUnavailable = order.isError || ownerMismatch;
  const failureTitle = ownerMismatch
    ? t.ownerMismatch
    : workspaceOrder === null
      ? t.loadFailed
      : t.stale;

  return (
    <>
      <PageHeader title={tPlan.title} breadcrumb={BREADCRUMB} />
      {productionOrderId === null ? (
        <AlertBanner variant="warning" title={t.unselected}>
          <Link to="/production/production-orders">{t.openProductionOrders}</Link>
        </AlertBanner>
      ) : order.isPending && workspaceOrder === null ? (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          {(workspaceOrder === null || orderUnavailable) && (
            <AlertBanner
              variant="error"
              title={failureTitle}
              action={
                <Button size="sm" variant="outlined" onClick={() => void order.refetch()}>
                  {t.retry}
                </Button>
              }
            >
              {workspaceOrder !== null && t.keepsEdits}
            </AlertBanner>
          )}
          {workspaceOrder !== null && (
            <div hidden={ownerMismatch}>
              <ProductionPlanWorkspace
                key={productionOrderId}
                order={workspaceOrder}
                orderUnavailable={orderUnavailable}
              />
            </div>
          )}
        </>
      )}
    </>
  );
};
