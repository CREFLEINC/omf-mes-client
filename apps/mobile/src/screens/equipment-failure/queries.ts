import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

export const equipmentFailureKeys = {
  openBreakdowns: (equipmentId: number | null) =>
    ['equipment-failure-open-breakdowns', equipmentId] as const,
};

/**
 * 이 설비에 아직 끝나지 않은 고장이 몇 건인가.
 *
 * 막는 데 쓰지 않는다. 다른 증상일 수 있으므로 사람이 보고 정한다.
 */
export const useOpenBreakdownCount = (equipmentId: number | null): UseQueryResult<number> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: equipmentFailureKeys.openBreakdowns(equipmentId),
    enabled: equipmentId !== null,
    queryFn: async () => {
      if (equipmentId === null) {
        throw new Error('설비를 고르기 전에는 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/maintenance/breakdowns', {
          params: { query: { equipmentId, openOnly: true, page: 0, size: 1 } },
        }),
      );

      // 건수만 필요하다. page 가 없으면 셀 수 없으므로 목록 길이로 물러난다.
      return data.page?.total ?? data.items.length;
    },
  });
};
