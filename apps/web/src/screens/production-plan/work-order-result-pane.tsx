import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';
import { Link } from 'react-router';

import { PageNav } from '../work-order/page-nav';
import { toWorkOrderPageView } from '../work-order/pagination';
import { useWorkOrderList, type WorkOrderFact } from '../work-order/queries';
import { useRoutingOperations } from '../routing/queries';
import { useProductionPlanDetail } from './queries';

const t = messages.productionPlan.result;

const quantity = (value: number, uomLabel: string): string =>
  t.quantity(new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value), uomLabel);

export const WorkOrderResultPane = ({
  productionPlanId,
  uomLabel,
}: {
  productionPlanId: number;
  uomLabel: string;
}) => {
  const [page, setPage] = useState(1);
  const plan = useProductionPlanDetail(productionPlanId);
  const workOrders = useWorkOrderList(productionPlanId, page);
  const trustedPlan = plan.data?.productionPlanId === productionPlanId ? plan.data : undefined;
  const operations = useRoutingOperations(trustedPlan?.routingId ?? null);
  const ownerMismatch =
    (plan.data !== undefined && trustedPlan === undefined) ||
    (workOrders.data?.items.some((item) => item.productionPlanId !== productionPlanId) ?? false) ||
    (trustedPlan !== undefined &&
      (operations.data?.items.some((item) => item.routingId !== trustedPlan.routingId) ?? false));
  const operationNames = new Map(
    operations.data?.items.map((operation, index) => [
      operation.routingOperationId,
      `${String(index + 1)}. ${operation.operationName}`,
    ]) ?? [],
  );
  const columns: Column<WorkOrderFact>[] = [
    { key: 'workOrderNo', header: t.columns.workOrderNo },
    {
      key: 'operation',
      header: t.columns.operation,
      render: (row) => operationNames.get(row.routingOperationId) ?? t.operationUnknown,
    },
    {
      key: 'orderQty',
      header: t.columns.orderQty,
      align: 'end',
      render: (row) => quantity(row.orderQty, uomLabel),
    },
    { key: 'workOrderTypeCode', header: t.columns.workOrderType },
    {
      key: 'statusCode',
      header: t.columns.status,
      render: (row) => (
        <Chip variant="status" status="idle" size="sm">
          {row.statusCode}
        </Chip>
      ),
    },
  ];
  const failed = plan.isError || workOrders.isError || operations.isError || ownerMismatch;
  const loading =
    plan.data === undefined || workOrders.data === undefined || operations.data === undefined;

  return (
    <section className="pane production-plan-section" aria-label={t.pane}>
      <h2>{t.heading(trustedPlan?.planNo ?? t.fallbackPlanName(productionPlanId))}</h2>
      {failed ? (
        <AlertBanner
          variant="error"
          title={ownerMismatch ? t.ownerMismatch : t.loadFailed}
          action={
            <Button
              size="sm"
              variant="outlined"
              onClick={() =>
                void Promise.all([plan.refetch(), workOrders.refetch(), operations.refetch()])
              }
            >
              {t.retry}
            </Button>
          }
        />
      ) : loading ? (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={4} />
        </div>
      ) : (
        <>
          <Link
            to={`/production/work-order-assignments?productionPlanId=${String(productionPlanId)}`}
          >
            {messages.workOrder.screen.view.openAssignment}
          </Link>
          <div className="wide-table">
            <Table
              density="compact"
              columns={columns}
              rows={workOrders.data.items}
              getRowId={(row) => String(row.workOrderId)}
              sort={null}
              empty={<EmptyState size="sm" live title={t.empty} />}
            />
          </div>
          <PageNav
            view={toWorkOrderPageView(workOrders.data.page, workOrders.data.items.length)}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
};
