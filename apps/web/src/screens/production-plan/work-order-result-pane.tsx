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

const quantity = (value: number, uomLabel: string): string =>
  `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value)} ${uomLabel}`;

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
    { key: 'workOrderNo', header: 'W/O 번호' },
    {
      key: 'operation',
      header: '공정',
      render: (row) => operationNames.get(row.routingOperationId) ?? '공정 이름 확인 불가',
    },
    {
      key: 'orderQty',
      header: '수량',
      align: 'end',
      render: (row) => quantity(row.orderQty, uomLabel),
    },
    { key: 'workOrderTypeCode', header: 'W/O 유형' },
    {
      key: 'statusCode',
      header: '상태',
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
    <section className="pane" aria-label="전개된 작업지시">
      <h2>{trustedPlan?.planNo ?? `생산계획 ${String(productionPlanId)}`} 전개 결과</h2>
      {failed ? (
        <AlertBanner
          variant="error"
          title={
            ownerMismatch
              ? '다른 계획의 전개 결과가 반환되었습니다.'
              : '전개 결과를 불러오지 못했습니다.'
          }
          action={
            <Button
              size="sm"
              variant="outlined"
              onClick={() =>
                void Promise.all([plan.refetch(), workOrders.refetch(), operations.refetch()])
              }
            >
              다시 시도
            </Button>
          }
        />
      ) : loading ? (
        <div role="status" aria-label="전개 결과를 불러오는 중">
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
              empty={<EmptyState size="sm" live title="생성된 작업지시가 없습니다." />}
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
