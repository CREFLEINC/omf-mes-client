import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ItemRow } from './recycle';

export const recycleKeys = {
  items: (code: string | null) => ['recycle-items', code] as const,
  warehouses: () => ['recycle-warehouses'] as const,
};

export interface WarehouseRow {
  warehouseId: number;
  warehouseName: string;
}

/**
 * 품목코드로 찾은 행들.
 *
 * 계약에 구분으로 거르는 질의가 없어 서버가 갈라 주지 못한다. 한 코드에 신재와 재생재가
 * 함께 오므로 부르는 쪽이 응답의 구분으로 가른다.
 */
export const useItemsByCode = (code: string | null): UseQueryResult<ItemRow[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: recycleKeys.items(code),
    enabled: code !== null && code !== '',
    queryFn: async () => {
      if (code === null || code === '') {
        throw new Error('품목코드를 적기 전에는 품목을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/items', { params: { query: { q: code, size: 50 } } }),
      );

      return data.items.map((item) => ({
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        mesCategoryCode: item.mesCategoryCode,
        baseUomId: item.baseUomId,
      }));
    },
  });
};

/** 재고를 둘 창고. 단말에 묶인 창고를 알 길이 계약에 없어 사람이 고른다. */
export const useWarehouses = (): UseQueryResult<WarehouseRow[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: recycleKeys.warehouses(),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/warehouses', { params: { query: { size: 200 } } }),
      );

      return data.items.map((warehouse) => ({
        warehouseId: warehouse.warehouseId,
        warehouseName: warehouse.warehouseName,
      }));
    },
  });
};
