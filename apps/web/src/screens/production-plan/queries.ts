import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ProductionPlanFact, ProductionPlanListResponse } from './types';

type ProductionPlan = components['schemas']['ProductionPlan'];

export const productionPlanKeys = {
  all: ['production-plans'] as const,
  list: (productionOrderId: number | null, page: number) =>
    ['production-plans', 'list', productionOrderId, page] as const,
  detail: (productionPlanId: number | null) =>
    ['production-plans', 'detail', productionPlanId] as const,
};

export const toProductionPlanFact = (plan: ProductionPlan): ProductionPlanFact => ({
  productionPlanId: plan.productionPlanId,
  productionOrderId: plan.productionOrderId,
  planNo: plan.planNo,
  planDate: plan.planDate,
  plannedQty: plan.plannedQty,
  uomId: plan.uomId,
  bomId: plan.bomId,
  routingId: plan.routingId,
  plannedLineId: plan.plannedLineId ?? null,
  statusCode: plan.statusCode,
  confirmedAt: plan.confirmedAt ?? null,
  remarks: plan.remarks ?? null,
});

const toListResponse = (response: {
  items: ProductionPlan[];
  page: ProductionPlanListResponse['page'];
}): ProductionPlanListResponse => ({
  items: response.items.map(toProductionPlanFact),
  page: response.page,
});

export const useProductionPlanList = (
  productionOrderId: number | null,
  page: number,
): UseQueryResult<ProductionPlanListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionPlanKeys.list(productionOrderId, page),
    enabled: productionOrderId !== null,
    queryFn: () => {
      if (productionOrderId === null) {
        throw new Error('생산 P/O를 고르기 전에는 계획 목록을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/production-plans', {
          params: { query: { productionOrderId, page } },
        }),
      ).then(toListResponse);
    },
  });
};

export const useProductionPlanDetail = (
  productionPlanId: number | null,
): UseQueryResult<ProductionPlanFact> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionPlanKeys.detail(productionPlanId),
    enabled: productionPlanId !== null,
    queryFn: () => {
      if (productionPlanId === null) {
        throw new Error('생산 계획을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/production-plans/{productionPlanId}', {
          params: { path: { productionPlanId } },
        }),
      ).then(toProductionPlanFact);
    },
  });
};
