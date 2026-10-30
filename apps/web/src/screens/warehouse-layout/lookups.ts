import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { type WarehouseFilters, warehouseListQuery } from '../../patterns/warehouse-filter-bar';
import type { LookupEntry } from './types';

/**
 * 이 화면이 푸는 참조 — 창고 하나뿐이다. 조건은 창고·Location 과 같은 조건 상자가 정한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.warehouseLayout;

export interface LookupResult {
  entries: LookupEntry[];
  truncated: boolean;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

const EMPTY_ENTRIES: LookupEntry[] = [];

/** **실패가 잘림보다 앞선다** — 낡은 자료와 실패가 함께 참일 때 실패를 감추지 않는다. */
export const lookupNote = (lookup: LookupResult, failed: string): string | undefined => {
  if (lookup.isError) return failed;
  if (lookup.truncated) return t.warehouse.lookupTruncated;

  return undefined;
};

export const lookupKeys = {
  warehouses: (filters: WarehouseFilters) =>
    ['warehouse-layout-lookups', 'warehouses', filters] as const,
};

/** 조건 상자(창고·Location 과 같은 것)로 거른 창고 — 그 가운데 하나를 고른다. */
export const useWarehouseOptions = (filters: WarehouseFilters): LookupResult => {
  const { client } = useApiClient();
  const query = useQuery({
    queryKey: lookupKeys.warehouses(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: warehouseListQuery(filters) } }),
      ),
  });
  const data = query.data;

  return {
    entries:
      data?.items.map((item) => ({
        value: String(item.warehouseId),
        label: `${item.warehouseCode} · ${item.warehouseName}`,
        isActive: item.isActive,
      })) ?? EMPTY_ENTRIES,
    truncated: data !== undefined && data.page.total > data.items.length,
    isError: query.isError,
    isLoading: query.isPending,
    refetch: () => {
      void query.refetch();
    },
  };
};
