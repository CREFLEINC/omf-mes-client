import type { components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from './api-context';
import { runRequest } from './request';

export type Location = components['schemas']['Location'];

/*
 * `systemRoleCode`: 서버가 창고마다 두는 자리(적치 대기 PUTAWAY_STAGING · 창고 전체 WAREHOUSE_WHOLE). 사람이 만든 위치는 null.
 * `isLeaf`: 켜진 하위가 없는 맨 아래 위치 — 재고는 여기에만 들어간다(서버 #894).
 */

export const PUTAWAY_STAGING = 'PUTAWAY_STAGING';
export const WAREHOUSE_WHOLE = 'WAREHOUSE_WHOLE';

/** 사람이 만든 켜진 위치. 이것이 하나라도 있으면 창고를 위치로 나눈 것이다(서버 장부 P-149). */
export const isDividingLocation = (location: Location): boolean =>
  location.isActive && location.systemRoleCode === null;

/** 「창고 전체」 — 사람이 위치를 나누지 않은 창고에 서버가 두는 자리. 붙일 라벨이 없다. */
export const isWarehouseWhole = (location: Location): boolean =>
  location.systemRoleCode === WAREHOUSE_WHOLE;

/** 재고를 둘 수 있는 자리 — 맨 아래 위치이고 적치 대기가 아니다. */
export const isStockableLocation = (location: Location): boolean =>
  location.isLeaf && location.systemRoleCode !== PUTAWAY_STAGING;

export const locationKeys = {
  inWarehouse: (warehouseId: number | null) => ['locations', warehouseId] as const,
  byId: (locationId: number | null) => ['location', locationId] as const,
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

/**
 * 위치 한 건.
 *
 * 창고를 모르는 자리를 가리킬 때 쓴다 - 출발 창고 목록으로는 다른 창고의 자리를 찾을 수 없다.
 */
export const useLocation = (locationId: number | null): UseQueryResult<Location> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: locationKeys.byId(locationId),
    enabled: locationId !== null,
    queryFn: async () => {
      if (locationId === null) {
        throw new Error('위치를 가리키기 전에는 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/mdm/locations/{locationId}', { params: { path: { locationId } } }),
      );

      return data.location;
    },
  });
};
