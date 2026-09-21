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
import { useNavigate } from 'react-router';

import { toWorkOrderPageView } from '../work-order/pagination';
import { useWorkOrderList, type WorkOrderFact } from '../work-order/queries';
import { useRoutingOperations } from '../routing/queries';
import { useProductionPlanDetail } from './queries';
import { ResultPageNav } from './result-page-nav';

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
  const navigate = useNavigate();
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
    { key: 'workOrderNo', header: t.columns.workOrderNo, width: '30%', align: 'center' },
    {
      key: 'operation',
      header: t.columns.operation,
      width: '22%',
      align: 'center',
      render: (row) => operationNames.get(row.routingOperationId) ?? t.operationUnknown,
    },
    {
      key: 'orderQty',
      header: t.columns.orderQty,
      width: '12%',
      align: 'center',
      render: (row) => quantity(row.orderQty, uomLabel),
    },
    { key: 'workOrderTypeCode', header: t.columns.workOrderType, width: '16%', align: 'center' },
    {
      key: 'statusCode',
      header: t.columns.status,
      width: '14%',
      align: 'center',
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
      <div className="production-plan-result-heading">
        <h2>{t.heading(trustedPlan?.planNo ?? t.fallbackPlanName(productionPlanId))}</h2>
        {!failed && !loading && (
          /* 다음 작업으로 가는 보조 동작이다 — 밑줄 링크 대신 테두리 단추로 둔다(사용자 지시). */
          <Button
            variant="outlined"
            onClick={() =>
              void navigate(
                `/production/work-order-assignments?productionPlanId=${String(productionPlanId)}`,
              )
            }
          >
            {messages.workOrder.screen.view.openAssignment}
          </Button>
        )}
      </div>
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
          <ResultPageNav
            view={toWorkOrderPageView(workOrders.data.page, workOrders.data.items.length)}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
};
