import { AlertBanner, Breadcrumb, Button, PageHeader, SkeletonText } from '@crefle/web-ui';
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

const readProductionOrderId = (params: URLSearchParams): number | null => {
  const raw = params.get('productionOrderId');
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

const quantity = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value);
const BREADCRUMB = (
  <Breadcrumb items={[{ label: '생산' }, { label: '계획·지시' }, { label: 'W/O 전개·편성' }]} />
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
      <section className="pane production-plan-order-summary" aria-label="선택 생산 P/O">
        <header className="production-plan-order-heading">
          <span>선택 생산 P/O</span>
          <h2>{order.productionOrderNo}</h2>
        </header>
        <p className="production-plan-order-facts">
          {describeItem(order.itemId, new Map(itemNames.items.map((item) => [item.itemId, item])))}{' '}
          · {quantity(order.orderQty)} {uomLabel}
          {order.dueDate === null ? '' : ` · 납기 ${order.dueDate}`}
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
        <div role="status" aria-label="생산라인을 불러오는 중">
          <SkeletonText lines={2} />
        </div>
      )}
      {lines.isError && (
        <AlertBanner
          variant="error"
          title="생산라인을 불러오지 못했습니다."
          action={
            <Button size="sm" variant="outlined" onClick={() => void lines.refetch()}>
              생산라인 다시 시도
            </Button>
          }
        />
      )}
      {order.plantId === null && (
        <AlertBanner variant="info">
          P/O에 공장이 없어 생산라인은 미지정으로 저장합니다.
        </AlertBanner>
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
            label: `${line.parentLineId === null ? '' : `${lineNames.get(line.parentLineId) ?? '상위 라인'} > `}${line.lineCode} · ${line.lineName}${line.isActive ? '' : ' · 비활성'}`,
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
      <AlertBanner variant="info">
        생산 LOT 크기와 선발행은 W/O 확정·배포 단계에서 입력합니다.
      </AlertBanner>
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
    ? '요청한 생산 P/O와 다른 상세가 반환되었습니다.'
    : workspaceOrder === null
      ? '생산 P/O를 불러오지 못했습니다.'
      : '최신 생산 P/O를 확인하지 못했습니다.';

  return (
    <>
      <PageHeader title="W/O 전개·편성" breadcrumb={BREADCRUMB} />
      {productionOrderId === null ? (
        <AlertBanner variant="warning" title="생산 P/O를 먼저 선택하세요.">
          <Link to="/production/production-orders">P/O 수신·조회로 이동</Link>
        </AlertBanner>
      ) : order.isPending && workspaceOrder === null ? (
        <div role="status" aria-label="생산 P/O를 불러오는 중">
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
                  다시 시도
                </Button>
              }
            >
              {workspaceOrder !== null && '현재 편집 내용은 유지됩니다.'}
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
