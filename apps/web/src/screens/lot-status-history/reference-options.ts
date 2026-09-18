import type { ApiClient, components } from '@omf-mes/api-client';
import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { LookupSource } from '../../patterns/lookup-display';
import { runRequest, toApiError } from '../../patterns/request';

export interface ReferenceOption {
  value: string;
  label: string;
  isActive: boolean;
}

export interface ReferenceOptionsResult {
  entries: readonly ReferenceOption[];
  isTruncated: boolean;
}

export const referenceOptionKeys = {
  warehouses: ['lot-status-history', 'reference-options', 'warehouses'] as const,
  items: ['lot-status-history', 'reference-options', 'items'] as const,
  itemDetail: (itemId: number) =>
    ['lot-status-history', 'reference-options', 'item', itemId] as const,
  locations: (warehouseId: number | null) =>
    ['lot-status-history', 'reference-options', 'locations', warehouseId] as const,
};

type Client = ApiClient['client'];
type PageMeta = components['schemas']['PageMeta'];

const toResult = <Value>(
  values: readonly Value[],
  page: PageMeta,
  toOption: (value: Value) => ReferenceOption,
): ReferenceOptionsResult => ({
  entries: values.map(toOption),
  isTruncated: page.total > values.length,
});

const fetchWarehouseOptions = async (client: Client): Promise<ReferenceOptionsResult> => {
  const data = await runRequest(() =>
    client.GET('/mdm/warehouses', { params: { query: { includeInactive: true } } }),
  );

  return toResult(data.items, data.page, (value) => ({
    value: String(value.warehouseId),
    label: `${value.warehouseCode} · ${value.warehouseName}`,
    isActive: value.isActive,
  }));
};

export const useWarehouseReferenceOptions = (): UseQueryResult<ReferenceOptionsResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: referenceOptionKeys.warehouses,
    queryFn: () => fetchWarehouseOptions(client),
  });
};

const fetchItemOptions = async (client: Client): Promise<ReferenceOptionsResult> => {
  const data = await runRequest(() =>
    client.GET('/mdm/items', { params: { query: { includeInactive: true } } }),
  );

  return toResult(data.items, data.page, (value) => ({
    value: String(value.itemId),
    label: `${value.itemCode} · ${value.itemName}`,
    isActive: value.isActive,
  }));
};

export const useItemReferenceOptions = (): UseQueryResult<ReferenceOptionsResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: referenceOptionKeys.items,
    queryFn: () => fetchItemOptions(client),
  });
};

const isNotFound = (error: unknown): boolean => {
  const apiError = toApiError(error);

  return apiError.kind === 'http' && apiError.status === 404;
};

/**
 * 표시할 품목 이름 — 보이는 행의 품목만 하나씩 상세로 푼다. 품목 ID마다 이름 풀이 원천 하나를 낸다.
 *
 * ⭐ **품목 목록(`useItemReferenceOptions`)으로 풀지 않는다.** LOT 응답은 `itemId` 만 주고, 품목
 * 목록은 한 쪽(계약 기본 50건 · 서버 상한 200건)만 받는다. 품목이 많은 환경에서는 LOT 의 품목이
 * 첫 쪽에 없어 이름이 「알 수 없음」으로 선다(#1336). 전 쪽을 다 받지 않는다 — 품목이 늘수록
 * 부하가 커진다. 보이는 행의 서로 다른 품목 수만큼만 부른다.
 *
 * 품목마다 따로 판정한다 — 한 품목의 실패가 다른 행의 이름을 지우지 않는다. 없는 품목(404)은
 * 실패가 아니라 「알 수 없음」이다.
 */
export const useItemNameSources = (
  itemIds: readonly number[],
): ReadonlyMap<number, LookupSource<ReferenceOption>> => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(itemIds)];

  const results = useQueries({
    queries: uniqueIds.map((itemId) => ({
      queryKey: referenceOptionKeys.itemDetail(itemId),
      queryFn: () =>
        runRequest(() => client.GET('/mdm/items/{itemId}', { params: { path: { itemId } } })),
    })),
  });

  return new Map(
    uniqueIds.map((itemId, index): [number, LookupSource<ReferenceOption>] => {
      const result = results[index];
      const item = result?.data?.item;

      return [
        itemId,
        {
          entries:
            item === undefined
              ? []
              : [
                  {
                    value: String(itemId),
                    label: `${item.itemCode} · ${item.itemName}`,
                    isActive: item.isActive,
                  },
                ],
          isError: result?.isError === true && !isNotFound(result.error),
          isLoading: result === undefined || result.isPending,
        },
      ];
    }),
  );
};

const validIdentifier = (value: number | null): value is number =>
  value !== null && Number.isSafeInteger(value) && value >= 1;

const fetchLocationOptions = async (
  client: Client,
  warehouseId: number,
): Promise<ReferenceOptionsResult> => {
  const data = await runRequest(() =>
    client.GET('/mdm/locations', {
      params: { query: { warehouseId, includeInactive: true } },
    }),
  );

  return toResult(data.items, data.page, (value) => ({
    value: String(value.locationId),
    label: `${value.locationCode} · ${value.locationName}`,
    isActive: value.isActive,
  }));
};

export const useLocationReferenceOptions = (
  warehouseId: number | null,
): UseQueryResult<ReferenceOptionsResult> => {
  const { client } = useApiClient();
  const enabled = validIdentifier(warehouseId);

  return useQuery({
    queryKey: referenceOptionKeys.locations(warehouseId),
    enabled,
    queryFn: () => {
      if (!validIdentifier(warehouseId)) {
        throw new Error('창고를 고르기 전에는 위치 목록을 조회하지 않습니다.');
      }
      return fetchLocationOptions(client, warehouseId);
    },
  });
};
