import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

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
