import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  toFilterQuery,
  type ProductionOrderFilterQuery,
  type ProductionOrderFilters,
} from './filters';
import type { ProductionOrderFact, ProductionOrderListResponse } from './types';

type ProductionOrder = components['schemas']['ProductionOrder'];

export const productionOrderKeys = {
  all: ['production-orders'] as const,
  list: (filters: ProductionOrderFilters, page: number) =>
    ['production-orders', 'list', toFilterQuery(filters, page)] as const,
  detail: (productionOrderId: number | null) =>
    ['production-orders', 'detail', productionOrderId] as const,
};

const toFact = (order: ProductionOrder): ProductionOrderFact => ({
  productionOrderId: order.productionOrderId,
  productionOrderNo: order.productionOrderNo,
  erpOrderNo: order.erpOrderNo ?? null,
  parentProductionOrderId: order.parentProductionOrderId ?? null,
  bomLevel: Math.max(0, Math.trunc(order.bomLevel ?? 0)),
  plantId: order.plantId ?? null,
  itemId: order.itemId,
  orderQty: order.orderQty,
  uomId: order.uomId,
  dueDate: order.dueDate ?? null,
  statusCode: order.statusCode,
});

const toListResponse = (response: {
  items: ProductionOrder[];
  page: ProductionOrderListResponse['page'];
}): ProductionOrderListResponse => ({
  items: response.items.map(toFact),
  page: response.page,
});

/** 실제 P/O 목록. 빈 조건도 계약의 목록 조회이며 서버가 정한 순서를 다시 정렬하지 않는다. */
export const useProductionOrderList = (
  filters: ProductionOrderFilters,
  page: number,
): UseQueryResult<ProductionOrderListResponse> => {
  const { client } = useApiClient();
  const query: ProductionOrderFilterQuery = toFilterQuery(filters, page);

  return useQuery({
    queryKey: productionOrderKeys.list(filters, page),
    queryFn: () =>
      runRequest(() => client.GET('/planning/production-orders', { params: { query } })).then(
        toListResponse,
      ),
  });
};

/** 선택한 P/O만 정확한 계약 경로에서 읽고 목록과 같은 사실 형태로 쓴다. */
export const useProductionOrderDetail = (
  productionOrderId: number | null,
): UseQueryResult<ProductionOrderFact> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: productionOrderKeys.detail(productionOrderId),
    enabled: productionOrderId !== null,
    queryFn: () => {
      if (productionOrderId === null) {
        throw new Error('생산 P/O를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/planning/production-orders/{productionOrderId}', {
          params: { path: { productionOrderId } },
        }),
      ).then(toFact);
    },
  });
};
