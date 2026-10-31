import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PutawayTask } from './putaway';

/** 아직 적치하지 않은 지시만. 끝낸 것이 목록에 남으면 같은 자리를 두 번 다녀온다. */
const PENDING = 'PENDING';

export const putawayKeys = {
  tasks: (workerId: number | null) => ['putaway-tasks', workerId] as const,
  task: (putawayTaskId: number | null) => ['putaway-task', putawayTaskId] as const,
  lotNo: (lotId: number | null) => ['putaway-lot-no', lotId] as const,
};

/**
 * 단말 공장의 대기 중인 적치 지시.
 *
 * 담당자로 거르지 않는다 - 적치에는 담당자가 없고 누구나 대기 지시를 처리한다(omf-all-around#26 ·
 * 사용자 결정 2026-09-19). 실제 지시가 모두 담당자 없이 만들어져 담당자로 거르면 목록이 늘 빈다.
 * 공장 범위는 서버가 단말로 좁힌다. 사번은 조회 조건이 아니라 「사번을 확인한 뒤에 목록을 보인다」는
 * 화면 흐름의 문으로만 쓴다 - 캐시 키에 남겨 두어 등록 뒤 무효화(`screen.tsx`)와 어긋나지 않게 한다.
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
          params: { query: { statusCode: PENDING, size: 100 } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 지시 한 건을 서버에서 다시 읽는다.
 *
 * 앞 화면이 라우터 상태로 넘긴 것은 굳은 스냅숏이다. 등록을 마친 뒤 같은 상태로 다시 들어오면
 * 실제 적치 위치가 여전히 비어 있어, 그것만 보고는 이미 끝난 지시를 또 적을 수 있다.
 */
export const usePutawayTask = (putawayTaskId: number | null): UseQueryResult<PutawayTask> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: putawayKeys.task(putawayTaskId),
    enabled: putawayTaskId !== null,
    queryFn: async () => {
      if (putawayTaskId === null) {
        throw new Error('지시를 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/logistics/putaway-tasks/{putawayTaskId}', {
          params: { path: { putawayTaskId } },
        }),
      );
    },
  });
};

/** 지시가 가리키는 LOT 의 사람이 읽는 번호. 스캔한 라벨을 이 값과 맞춘다. */
export const useTaskLotNo = (lotId: number | null): UseQueryResult<string> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: putawayKeys.lotNo(lotId),
    enabled: lotId !== null,
    queryFn: async () => {
      if (lotId === null) {
        throw new Error('지시를 고르기 전에는 LOT 을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
      );

      return data.lot.lotNo;
    },
  });
};
