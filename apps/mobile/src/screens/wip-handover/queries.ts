import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { Lot } from '../../patterns/lots';
import { runRequest } from '../../patterns/request';
import { toBody, type LotProgress, type WorkOrder } from './handover';

export const handoverKeys = {
  successors: (workOrderId: number | null) => ['handover-successors', workOrderId] as const,
  progress: (lotId: number | null) => ['handover-lot-progress', lotId] as const,
};

/**
 * 이 LOT 이 실제로 만들어 낸 양.
 *
 * 넘길 수 있는 상한이 이 값이다. LOT 이 들고 있는 초기 수량은 «계획»이라, 미달 마감된 LOT
 * 에서는 만들지 않은 양까지 넘길 수 있게 된다.
 *
 * 목록 응답에는 이 값이 없다 - 진척은 LOT 마다 세야 해서 상세에서만 내려준다.
 */
export const useLotProgress = (lotId: number | null): UseQueryResult<LotProgress | null> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: handoverKeys.progress(lotId),
    enabled: lotId !== null,
    queryFn: async () => {
      if (lotId === null) {
        throw new Error('LOT 을 찾기 전에는 진척을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/trace/lots/{lotId}', {
          params: { path: { lotId }, query: { withProgress: true } },
        }),
      );

      return data.lot.progress ?? null;
    },
  });
};

/**
 * 이 W/O 다음에 오는 W/O.
 *
 * 서버가 공정 의존을 푼다 - 화면이 라우팅을 걸어 맞추지 않는다. 여럿이면 여럿이 오고 그때는
 * 작업자가 고른다. 외주·재작업 분기가 있어 하나뿐이어도 바꿀 수 있게 둔다.
 */
export const useSuccessors = (workOrderId: number | null): UseQueryResult<WorkOrder[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: handoverKeys.successors(workOrderId),
    enabled: workOrderId !== null,
    queryFn: async () => {
      if (workOrderId === null) {
        throw new Error('출발 W/O 를 알기 전에는 다음 공정을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/production/work-orders', {
          params: { query: { successorOfWorkOrderId: workOrderId, size: 50 } },
        }),
      );

      return data.items;
    },
  });
};

interface HandoverVariables {
  lot: Lot;
  fromWorkOrderId: number;
  toWorkOrderId: number;
  qty: string;
  workerNo: string;
  /** 이번 확정의 키. 재시도는 같은 값으로 온다 — 서버가 중복을 그것으로 막는다. */
  idempotencyKey: string;
}

/**
 * 인계 확정.
 *
 * 셸의 outbox 에 담지 않는다 - 이 화면은 온라인 전용이고 연결이 끊기면 진입 자체가 막힌다.
 * 멱등키는 오프라인 큐 때문이 아니라 재시도 중복을 막기 위해 싣는다. 그래서 화면이 만들어
 * 넘긴다 - 여기서 만들면 재시도마다 새 값이 되어 막으려던 중복을 그대로 낸다.
 *
 * If-Match 를 싣지 않는다. 신규 생성이라 대조할 판이 아직 없다.
 */
export const useConfirmHandover = (): UseMutationResult<unknown, Error, HandoverVariables> => {
  const { client } = useApiClient();

  return useMutation({
    mutationFn: ({
      lot,
      fromWorkOrderId,
      toWorkOrderId,
      qty,
      workerNo,
      idempotencyKey,
    }: HandoverVariables) =>
      runRequest(() =>
        client.POST('/production/operation-handovers', {
          params: {
            header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
          },
          body: toBody(lot, fromWorkOrderId, toWorkOrderId, qty, new Date()),
        }),
      ),
  });
};
