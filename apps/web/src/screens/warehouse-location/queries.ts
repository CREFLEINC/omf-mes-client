import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { WarehouseFilters } from './types';

type PageMeta = components['schemas']['PageMeta'];
type Warehouse = components['schemas']['Warehouse'];

export interface WarehouseListResponse {
  items: Warehouse[];
  page: PageMeta;
}

/**
 * 이 화면이 쓰는 캐시 키. 무효화 범위를 한 곳에서 읽을 수 있게 모아 둔다.
 * all을 무효화하면 목록과 상세가 함께 다시 조회된다.
 */
export const warehouseKeys = {
  all: ['warehouses'] as const,
  list: (filters: WarehouseFilters) => ['warehouses', 'list', filters] as const,
  detail: (warehouseId: number) => ['warehouses', 'detail', warehouseId] as const,
};

/** ETag가 보관된 경로. 쓰기의 If-Match는 언제나 이 경로에서 꺼낸다(사용 중지도 마찬가지다). */
export const warehouseDetailPath = (warehouseId: number): string =>
  `/mdm/warehouses/${String(warehouseId)}`;

/**
 * 창고 목록. 조건은 서버로 보낸다 — 클라이언트에서 거르면 서버가 자른 뒤의 결과만 걸러진다.
 * size는 보내지 않고 서버 기본값을 따른다. 잘림은 page.total로 드러내 안내한다.
 */
export const useWarehouseList = (
  filters: WarehouseFilters,
): UseQueryResult<WarehouseListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: warehouseKeys.list(filters),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/warehouses', {
          params: {
            query: {
              ...(filters.q === '' ? {} : { q: filters.q }),
              ...(filters.warehouseTypeCode === ''
                ? {}
                : { warehouseTypeCode: filters.warehouseTypeCode }),
              includeInactive: filters.includeInactive,
            },
          },
        }),
      ),
  });
};

/** 받은 건수가 전체보다 적으면 목록이 잘린 것이다. */
export const isTruncated = (page: PageMeta, shown: number): boolean => page.total > shown;
