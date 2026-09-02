import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

export type Location = components['schemas']['Location'];

export const locationKeys = {
  inWarehouse: (warehouseId: number | null) => ['locations', warehouseId] as const,
  byCode: (warehouseId: number | null, code: string | null) =>
    ['location-by-code', warehouseId, code] as const,
};

/** 이 창고의 위치. 창고는 지시가 준다 - 지시가 시작되는 위치와 다른 창고일 수 있다. */
export const useLocations = (warehouseId: number | null): UseQueryResult<Location[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: locationKeys.inWarehouse(warehouseId),
    enabled: warehouseId !== null,
    queryFn: async () => {
      if (warehouseId === null) {
        throw new Error('지시를 고르기 전에는 위치를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/locations', { params: { query: { warehouseId, size: 200 } } }),
      );

      return data.items;
    },
  });
};

/**
 * 스캔한 위치 코드가 가리키는 한 건.
 *
 * 정확 일치로 묻는다. 부분 일치는 여러 건을 내고, 찾는 줄이 첫 쪽 밖으로 밀리면 없는 것과
 * 구별되지 않는다.
 */
export const useLocationByCode = (
  warehouseId: number | null,
  code: string | null,
): UseQueryResult<Location | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: locationKeys.byCode(warehouseId, code),
    enabled: warehouseId !== null && code !== null,
    queryFn: async () => {
      if (warehouseId === null || code === null) {
        throw new Error('지시를 고르고 스캔하기 전에는 위치를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/locations', {
          params: { query: { warehouseId, locationCode: code } },
        }),
      );

      return data.items.find((location) => location.locationCode === code) ?? null;
    },
  });
};
