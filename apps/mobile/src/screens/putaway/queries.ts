import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LocationContent, PutawayRule, PutawayTask } from './putaway';

/** 아직 적치하지 않은 지시만. 끝낸 것이 목록에 남으면 같은 자리를 두 번 다녀온다. */
const PENDING = 'PENDING';

export const putawayKeys = {
  tasks: (workerId: number | null) => ['putaway-tasks', workerId] as const,
  task: (putawayTaskId: number | null) => ['putaway-task', putawayTaskId] as const,
  contents: (warehouseId: number | null, locationId: number | null) =>
    ['putaway-location-contents', warehouseId, locationId] as const,
  lotNo: (lotId: number | null) => ['putaway-lot-no', lotId] as const,
  rule: (putawayRuleId: number | null) => ['putaway-rule', putawayRuleId] as const,
};

/**
 * 이 작업자에게 할당된 적치 지시.
 *
 * 담당자를 비우고 묻지 않는다 - 비우면 남의 지시까지 함께 오고, 서버가 본인을 풀 근거도 없다.
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
          params: { query: { assignedWorkerId: workerId, statusCode: PENDING, size: 100 } },
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

/**
 * 지금 그 위치에 들어 있는 것.
 *
 * 혼적 판정과 수용량은 지시만 보고는 설 수 없다 - 자리에 무엇이 얼마나 있는지가 판정의
 * 근거다. 창고를 함께 싣는다: 계약이 셋 중 하나는 있어야 한다고 못 박았고, 위치 번호만으로는
 * 다른 창고의 같은 번호와 갈리지 않는다.
 */
export const useLocationContents = (
  warehouseId: number | null,
  locationId: number | null,
): UseQueryResult<LocationContent[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: putawayKeys.contents(warehouseId, locationId),
    enabled: warehouseId !== null && locationId !== null,
    queryFn: async () => {
      if (warehouseId === null || locationId === null) {
        throw new Error('위치를 정하기 전에는 잔액을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/balances', {
          params: { query: { warehouseId, locationId, groupBy: 'LOT' } },
        }),
      );

      return data.items.map((each) => ({
        itemId: each.itemId,
        lotId: each.lotId,
        onHandQty: each.onHandQty,
      }));
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

/** 권장 위치를 낸 규칙. 왜 이 자리인지를 함께 보이면 사람에게 판단할 근거가 생긴다. */
export const usePutawayRule = (putawayRuleId: number | null): UseQueryResult<PutawayRule> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: putawayKeys.rule(putawayRuleId),
    enabled: putawayRuleId !== null,
    queryFn: async () => {
      if (putawayRuleId === null) {
        throw new Error('권장 규칙이 없는 지시에서는 규칙을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/logistics/putaway-rules/{putawayRuleId}', {
          params: { path: { putawayRuleId } },
        }),
      );

      return data.putawayRule;
    },
  });
};
