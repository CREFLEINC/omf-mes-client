import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { InventoryCount, InventoryCountLine } from './count';

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
