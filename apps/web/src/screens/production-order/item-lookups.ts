import { named } from '@omf-mes/i18n';
import { useQueries, useQuery } from '@tanstack/react-query';

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
        return { itemId, status: 'named', label: named(itemName, itemCode) };
      }
      return { itemId, status: isNotFound(result.error) ? 'unknown' : 'failed', label: null };
    }),
    isLoading: results.some((result) => result.isPending),
  };
};

/**
 * 품목 기본 생산 LOT 크기 — 단위가 W/O 단위와 같을 때만 쓴다. 품목 기본값은 기준단위로 적혀 있어
 * 단위가 다르면 슬롯 수가 틀어진다.
 */
export const useItemDefaultLotSize = (
  itemId: number | null,
  uomId: number | null,
): number | null => {
  const { client } = useApiClient();
  const item = useQuery({
    queryKey: productionOrderItemKeys.detail(itemId ?? 0),
    enabled: itemId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId: itemId ?? 0 } } }),
      ),
  });
  const detail = item.data?.item;
  if (detail === undefined || detail.baseUomId !== uomId) return null;
  const size = detail.defaultProductionLotSize ?? null;
  return size !== null && size > 0 ? size : null;
};

export interface ItemCodeName {
  itemCode: string;
  itemName: string;
}

/**
 * 품목 코드와 이름을 따로 돌려준다. 표에서 코드 열과 이름 열을 나누기 위해서다(C-10).
 * 같은 품목 상세 캐시를 쓰므로 화면에 선 품목 수만큼만 부른다.
 */
export const useItemCodeNames = (itemIds: readonly number[]): Map<number, ItemCodeName> => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];
  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: productionOrderItemKeys.detail(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });
  const map = new Map<number, ItemCodeName>();
  results.forEach((result, index) => {
    const itemId = uniqueIds[index];
    if (itemId !== undefined && result.data !== undefined) {
      map.set(itemId, { itemCode: result.data.item.itemCode, itemName: result.data.item.itemName });
    }
  });
  return map;
};
