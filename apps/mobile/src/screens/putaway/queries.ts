import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { Location, PutawayTask } from './putaway';

export const putawayKeys = {
  tasks: (workerId: number | null) => ['putaway-tasks', workerId] as const,
  locations: (warehouseId: number | null) => ['putaway-locations', warehouseId] as const,
  byCode: (warehouseId: number | null, code: string | null) =>
    ['putaway-location-code', warehouseId, code] as const,
};

/**
 * 이 작업자에게 할당된 적치 지시.
 *
 * 담당자를 비우고 묻지 않는다 - 비우면 남의 지시까지 함께 오고, 서버가 본인을 풀 근거도 없다.
 * 상태 코드로 거르지 않는다 - 값 목록이 확정 전이라 지어내 실으면 목록이 조용히 빈다.
 */
export const usePutawayTasks = (workerId: number | null): UseQueryResult<PutawayTask[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: putawayKeys.tasks(workerId),
    enabled: workerId !== null,
    queryFn: async () => {
      if (workerId === null) {
        throw new Error('작업자를 확인하기 전에는 지시를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/putaway-tasks', {
          params: { query: { assignedWorkerId: workerId, size: 100 } },
        }),
      );

      return data.items;
    },
  });
};

/** 이 창고의 위치. 창고는 지시가 준다 - 지시가 시작되는 위치와 다른 창고일 수 있다. */
export const useLocations = (warehouseId: number | null): UseQueryResult<Location[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: putawayKeys.locations(warehouseId),
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
    queryKey: putawayKeys.byCode(warehouseId, code),
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
