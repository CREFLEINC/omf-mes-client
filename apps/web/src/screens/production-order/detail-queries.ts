import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PageMeta } from './types';

type ProductionPlan = components['schemas']['ProductionPlan'];
type WorkOrder = components['schemas']['WorkOrder'];

export interface ProductionOrderPlanFact {
  productionPlanId: number;
  productionOrderId: number;
  planNo: string;
  planDate: string;
  plannedQty: number;
  uomId: number;
  plannedLineId: number | null;
  statusCode: string;
}

export interface ProductionOrderWorkOrderFact {
  workOrderId: number;
  workOrderNo: string;
  productionPlanId: number;
  itemId: number;
  orderQty: number;
  uomId: number;
  workOrderTypeCode: string;
  productionLineId: number | null;
  plannedStartAt: string | null;
  plannedEndAt: string | null;
  statusCode: string;
}

export interface ProductionOrderDetailList<T> {
  items: T[];
  page: PageMeta;
}

export const productionOrderDetailKeys = {
  plans: (productionOrderId: number | null) =>
    ['production-orders', 'detail', productionOrderId, 'plans'] as const,
  workOrders: (productionOrderId: number | null) =>
    ['production-orders', 'detail', productionOrderId, 'work-orders'] as const,
};

const toPlanFact = (plan: ProductionPlan): ProductionOrderPlanFact => ({
  productionPlanId: plan.productionPlanId,
  productionOrderId: plan.productionOrderId,
  planNo: plan.planNo,
  planDate: plan.planDate,
  plannedQty: plan.plannedQty,
  uomId: plan.uomId,
  plannedLineId: plan.plannedLineId ?? null,
  statusCode: plan.statusCode,
});

const toWorkOrderFact = (workOrder: WorkOrder): ProductionOrderWorkOrderFact => ({
  workOrderId: workOrder.workOrderId,
  workOrderNo: workOrder.workOrderNo,
  productionPlanId: workOrder.productionPlanId,
  itemId: workOrder.itemId,
  orderQty: workOrder.orderQty,
  uomId: workOrder.uomId,
  workOrderTypeCode: workOrder.workOrderTypeCode,
  productionLineId: workOrder.productionLineId ?? null,
  plannedStartAt: workOrder.plannedStartAt ?? null,
  plannedEndAt: workOrder.plannedEndAt ?? null,
  statusCode: workOrder.statusCode,
});

export const useProductionOrderPlans = (
  productionOrderId: number | null,
): UseQueryResult<ProductionOrderDetailList<ProductionOrderPlanFact>> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: productionOrderDetailKeys.plans(productionOrderId),
    enabled: productionOrderId !== null,
    queryFn: () => {
      if (productionOrderId === null) throw new Error('생산 P/O 선택이 필요합니다.');
      return runRequest(() =>
        client.GET('/planning/production-plans', {
          params: { query: { productionOrderId } },
        }),
      ).then((data) => ({ items: data.items.map(toPlanFact), page: data.page }));
    },
  });
};

export const useProductionOrderWorkOrders = (
  productionOrderId: number | null,
): UseQueryResult<ProductionOrderDetailList<ProductionOrderWorkOrderFact>> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: productionOrderDetailKeys.workOrders(productionOrderId),
    enabled: productionOrderId !== null,
    queryFn: () => {
      if (productionOrderId === null) throw new Error('생산 P/O 선택이 필요합니다.');
      return runRequest(() =>
        client.GET('/production/work-orders', {
          params: { query: { productionOrderId } },
        }),
      ).then((data) => ({ items: data.items.map(toWorkOrderFact), page: data.page }));
    },
  });
};
