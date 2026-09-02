import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PutawayTask } from './putaway';

export const putawayKeys = {
  tasks: (workerId: number | null) => ['putaway-tasks', workerId] as const,
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
