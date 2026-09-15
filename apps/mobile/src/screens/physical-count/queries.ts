import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { InventoryCount, InventoryCountLine, InventoryCountSummary } from './count';

/** 한 위치의 라인은 이 안에 다 든다. */
const PAGE_SIZE = 200;

/**
 * 지금 돌고 있는 실사.
 *
 * 마감된 실사를 고르면 쓰기가 서버에서 되돌아온다 - 그 판정을 목록에서 미리 한다.
 */
export const useOpenCounts = (): UseQueryResult<InventoryCount[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['physical-count-open'] as const,
    /*
     * 공유계약 C-6 - 판정에 쓰는 값은 캐시하지 않는다. 실사는 이 화면 밖에서 마감되므로
     * 조금 전에 열려 있었다는 것이 지금 열려 있다는 뜻이 아니다.
     */
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/inventory/counts', {
          params: { query: { inProgressOnly: true, size: PAGE_SIZE } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 이 위치의 실사 라인.
 *
 * 서버가 센 줄과 안 센 줄을 `counted` 로 갈라 준다. 화면이 수량 0 으로 판정하지 않는다 -
 * 세어서 0 인 줄과 아직 안 센 줄이 같은 값을 갖는다.
 */
export const useCountLines = (
  inventoryCountId: number | null,
  locationId: number | null,
): UseQueryResult<InventoryCountLine[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['physical-count-lines', inventoryCountId, locationId] as const,
    enabled: inventoryCountId !== null && locationId !== null,
    /* 다른 단말이 방금 센 것을 낡은 목록으로 보이면 그 값을 덮어쓴다. */
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (inventoryCountId === null || locationId === null) {
        throw new Error('실사와 위치를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/counts/{inventoryCountId}/lines', {
          params: { path: { inventoryCountId }, query: { locationId, size: PAGE_SIZE } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 아직 셀 위치.
 *
 * 대상 위치는 실사 헤더에 없고 라인에 붙어 있다. 안 센 라인에서 위치 코드를 모아 말하지
 * 않으면 위치 코드를 외우고 있는 사람만 이 화면을 쓸 수 있다.
 *
 * 한 쪽만 받는다 - 다 세면 사라지는 목록이라 전부 받을 이유가 없고, 창고 하나의 라인이
 * 수천 건이라 받아 올 수도 없다.
 */
export const useUncountedLocations = (
  inventoryCountId: number | null,
): UseQueryResult<string[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['physical-count-uncounted-locations', inventoryCountId] as const,
    enabled: inventoryCountId !== null,
    /* 한 위치를 끝낼 때마다 줄어든다. 낡은 목록은 이미 센 곳으로 다시 보낸다. */
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (inventoryCountId === null) {
        throw new Error('실사를 고르기 전에는 남은 위치를 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/counts/{inventoryCountId}/lines', {
          params: { path: { inventoryCountId }, query: { uncountedOnly: true, size: PAGE_SIZE } },
        }),
      );

      return [
        ...new Set(
          data.items
            .map((row) => row.locationCode)
            .filter((code): code is string => code !== undefined && code !== ''),
        ),
      ];
    },
  });
};

/**
 * 고른 실사의 진행 요약.
 *
 * 서버가 세어 준다 - 화면이 전체 라인을 받아 세면 쪽 나누기와 어긋나고, 창고 하나의 라인이
 * 수천 건이라 받아 올 수도 없다.
 */
export const useCountSummary = (
  inventoryCountId: number | null,
): UseQueryResult<InventoryCountSummary> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['physical-count-summary', inventoryCountId] as const,
    enabled: inventoryCountId !== null,
    /* 한 위치를 끝낼 때마다 달라진다. 낡은 값을 보이면 다 돌았는지를 잘못 말한다. */
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      if (inventoryCountId === null) {
        throw new Error('실사를 고르기 전에는 진행을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/counts/{inventoryCountId}', {
          params: { path: { inventoryCountId } },
        }),
      );

      return data.summary;
    },
  });
};
