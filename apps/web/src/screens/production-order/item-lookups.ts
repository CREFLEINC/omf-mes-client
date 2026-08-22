import { useQueries } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest, toApiError } from '../../patterns/request';

export type ProductionOrderItemNameStatus = 'loading' | 'named' | 'unknown' | 'failed';

export interface ProductionOrderItemName {
  itemId: number;
  status: ProductionOrderItemNameStatus;
  label: string | null;
}

export interface ProductionOrderItemNamesResult {
  items: ProductionOrderItemName[];
  isLoading: boolean;
}

export const productionOrderItemKeys = {
  all: ['production-order-items'] as const,
  detail: (itemId: number) => ['production-order-items', 'detail', itemId] as const,
};

const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);
  return apiError.kind === 'http' && apiError.status === 404;
};

/** P/O 행의 품목 ID를 계약의 exact 상세로만 사람이 읽는 이름에 연결한다. */
export const useProductionOrderItemNames = (
  itemIds: readonly number[],
): ProductionOrderItemNamesResult => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];
  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: productionOrderItemKeys.detail(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });

  return {
    items: results.map((result, index): ProductionOrderItemName => {
      const itemId = uniqueIds[index] as number;
      if (result.isPending) return { itemId, status: 'loading', label: null };
      if (result.data !== undefined) {
        const { itemCode, itemName } = result.data.item;
        return { itemId, status: 'named', label: `${itemCode} · ${itemName}` };
      }
      return { itemId, status: isNotFound(result.error) ? 'unknown' : 'failed', label: null };
    }),
    isLoading: results.some((result) => result.isPending),
  };
};
