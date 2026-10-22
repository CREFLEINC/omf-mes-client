import type { components, WorkOrderForward } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';

type WorkOrderClose = components['schemas']['WorkOrderClose'];

/** 서버 마감 전이가 받는 출발 상태. */
export const CLOSABLE_STATUSES: readonly string[] = ['IN_PROGRESS', 'SUSPENDED', 'COMPLETED'];

export const workOrderClosePath = (workOrderId: number): string =>
  `/production/work-orders/${String(workOrderId)}`;

const closeKeys = {
  target: (workOrderId: number) => ['production-flow', 'close-target', workOrderId] as const,
  openLots: (workOrderId: number) => ['production-flow', 'close-open-lots', workOrderId] as const,
};

/**
 * 창을 열 때 다시 읽는 마감 대상. 마감은 `If-Match` 가 필수라, 판정과 잠금 값이 같은 응답에서
 * 와야 한다 — 화면이 오래 들고 있던 상세로 판정하면 그사이 쌓인 실적이 빠진다.
 */
export const useCloseTarget = (
  workOrderId: number,
  enabled: boolean,
): UseQueryResult<WorkOrderForward> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: closeKeys.target(workOrderId),
    enabled,
    staleTime: 0,
    queryFn: async () =>
      (await runRequest(() =>
        client.GET('/production/work-orders/{workOrderId}', {
          params: {
            path: { workOrderId },
            query: { withProgress: true, withPreIssuedLots: true },
          },
        }),
      )) as WorkOrderForward,
  });
};

const OPEN_LOT_PAGE_SIZE = 100;

/** 마감해도 그대로 남는 진행 중(ACTIVE·미완료) LOT 번호. 실적 없는 대기 슬롯은 폐번되므로 뺀다. */
export const useCloseOpenLots = (
  workOrderId: number,
  enabled: boolean,
): UseQueryResult<string[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: closeKeys.openLots(workOrderId),
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/trace/lots', {
          params: {
            query: { workOrderId, completed: false, page: 1, size: OPEN_LOT_PAGE_SIZE },
          },
        }),
      );

      return data.items
        .filter((lot) => lot.lifecycleStatusCode === 'ACTIVE')
        .map((lot) => lot.lotNo);
    },
  });
};

/**
 * 작업지시 마감. 되돌릴 수 없는 전이라 멱등 키는 적용될 때까지 같은 값을 쓴다.
 * ⛔ 오프라인 큐에 싣지 않는다 — `If-Match` 가 필수라 큐가 잠금 값을 실어 보낼 수 없다.
 */
export const useWorkOrderCloseWrite = ({
  workOrderId,
  workerNo,
  onSuccess,
}: {
  workOrderId: number;
  workerNo: string;
  onSuccess: () => void;
}): MasterWriteResult<WorkOrderClose> => {
  const { client } = useApiClient();

  return useMasterWrite<WorkOrderClose, components['schemas']['WorkOrder']>({
    request: (body, headers) =>
      client.POST('/production/work-orders/{workOrderId}:close', {
        params: {
          path: { workOrderId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
            'X-Worker-No': workerNo,
          },
        },
        body,
      }),
    etagPath: workOrderClosePath(workOrderId),
    invalidateKeys: [['production-flow'], ['production-result']],
    knownFields: [],
    keyLifetime: 'until-applied',
    onSuccess,
  });
};
