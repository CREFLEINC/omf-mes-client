import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type {
  ProductionPlanAllResponse,
  ProductionPlanFact,
  ProductionPlanListResponse,
} from './types';

type ProductionPlan = components['schemas']['ProductionPlan'];
type Client = ApiClient['client'];
const EDITOR_PAGE_SIZE = 100;

export const productionPlanKeys = {
  all: ['production-plans'] as const,
  list: (productionOrderId: number | null, page: number) =>
    ['production-plans', 'list', productionOrderId, page] as const,
  allForOrder: (productionOrderId: number | null) =>
    ['production-plans', 'all-for-order', productionOrderId] as const,
  detail: (productionPlanId: number | null) =>
    ['production-plans', 'detail', productionPlanId] as const,
};

export const productionPlanDetailPath = (productionPlanId: number): string =>
  `/planning/production-plans/${String(productionPlanId)}`;

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

const fetchAllProductionPlans = async (
  client: Client,
  productionOrderId: number,
): Promise<ProductionPlanAllResponse> => {
  const requestPage = (page: number): Promise<ProductionPlanListResponse> =>
    runRequest(() =>
      client.GET('/planning/production-plans', {
        params: {
          query: {
            productionOrderId,
            size: EDITOR_PAGE_SIZE,
            ...(page > 1 ? { page } : {}),
          },
        },
      }),
    ).then(toListResponse);

  const first = await requestPage(1);
  if (first.items.some((item) => item.productionOrderId !== productionOrderId)) {
    throw new Error('다른 생산 P/O의 계획이 전체 목록 응답에 섞였습니다.');
  }
  const unique = new Map(first.items.map((item) => [item.productionPlanId, item]));
  if (!Number.isFinite(first.page.size) || first.page.size < 1) {
    throw new Error('생산계획 전체 목록의 쪽 크기를 확인할 수 없습니다.');
  }
  if (
    first.page.page !== 1 ||
    !Number.isSafeInteger(first.page.total) ||
    first.page.total < 0 ||
    unique.size > first.page.total
  ) {
    throw new Error('생산계획 전체 목록의 쪽 정보가 일관되지 않습니다.');
  }
  if (unique.size === first.page.total) {
    return { items: [...unique.values()], total: first.page.total };
  }

  const totalPages = Math.ceil(first.page.total / first.page.size);
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await requestPage(page);
    if (next.items.some((item) => item.productionOrderId !== productionOrderId)) {
      throw new Error('다른 생산 P/O의 계획이 전체 목록 응답에 섞였습니다.');
    }
    if (
      next.page.page !== page ||
      next.page.size !== first.page.size ||
      next.page.total !== first.page.total
    ) {
      throw new Error('생산계획 전체 목록의 쪽 정보가 일관되지 않습니다.');
    }
    next.items.forEach((item) => unique.set(item.productionPlanId, item));
  }
  if (unique.size !== first.page.total) {
    throw new Error('생산계획 전체 목록을 완성하지 못했습니다.');
  }

  return { items: [...unique.values()], total: first.page.total };
};

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

export const useAllProductionPlans = (
  productionOrderId: number | null,
): UseQueryResult<ProductionPlanAllResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionPlanKeys.allForOrder(productionOrderId),
    enabled: productionOrderId !== null,
    queryFn: () => {
      if (productionOrderId === null) {
        throw new Error('생산 P/O를 고르기 전에는 전체 계획 목록을 조회하지 않습니다.');
      }

      return fetchAllProductionPlans(client, productionOrderId);
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
