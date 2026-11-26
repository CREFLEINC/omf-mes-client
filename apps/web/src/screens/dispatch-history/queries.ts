import { keepPreviousData, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type {
  DeliveryPage,
  Department,
  DispatchPage,
  DispatchQuery,
  NotificationEvent,
} from './types';

export const PAGE_SIZE = 50;
/** 한 이벤트의 Zalo 발송은 그 부서 수신자 수만큼이다 — 한 번에 받는다. */
const DELIVERY_SIZE = 200;

export const dispatchHistoryKeys = {
  dispatches: (query: DispatchQuery | null) => ['dispatch-history', 'dispatches', query] as const,
  deliveries: (notificationEventId: number | null, period: { from: string; to: string } | null) =>
    ['dispatch-history', 'deliveries', notificationEventId ?? 0, period] as const,
  resultCount: (query: DispatchQuery | null, status: DispatchResult) =>
    ['dispatch-history', 'result-count', query, status] as const,
  events: ['dispatch-history', 'events'] as const,
  departments: ['dispatch-history', 'departments'] as const,
};

/** 기간이 맞지 않으면(`null`) 부르지 않는다 — 서버가 400 을 낸다. */
export const useDispatches = (query: DispatchQuery | null): UseQueryResult<DispatchPage> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: dispatchHistoryKeys.dispatches(query),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/notification-dispatches', {
          params: { query: query ?? { from: '', to: '' } },
        }),
      ),
  });
};

export type DispatchResult = NonNullable<DispatchQuery['status']>;

/**
 * 위 줄 결과 칩의 건수 — 결과마다 지금 걸린 다른 조건(기간 · 이벤트 · 부서) 그대로 한 줄만 받아 쪽 정보의 전체 건수를
 * 쓴다(다른 화면 칩과 같은 방식 · #358). `base` 가 `null`(기간 오류)이면 세지 않는다. 결과 순서대로 돌려준다.
 */
export const useDispatchResultCounts = (
  base: Omit<DispatchQuery, 'status' | 'page' | 'size'> | null,
  results: readonly DispatchResult[],
): (number | undefined)[] => {
  const { client } = useApiClient();
  const counts = useQueries({
    queries: results.map((status) => {
      const query = base === null ? null : { ...base, status, page: 1, size: 1 };
      return {
        queryKey: dispatchHistoryKeys.resultCount(query, status),
        enabled: query !== null,
        queryFn: () =>
          runRequest(() =>
            client.GET('/app/notification-dispatches', {
              params: { query: query ?? { from: '', to: '' } },
            }),
          ).then((response) => response.page.total),
      };
    }),
  });
  return counts.map((count) => count.data);
};

/**
 * 고른 이벤트의 Zalo 발송. ⭐ **기간도 싣는다** — 서버가 `from`·`to` 를 필수로 받는다. 목록에
 * 적용된 기간을 그대로 넘긴다(그 이벤트는 그 기간 안에서 골랐다).
 */
export const useDeliveries = (
  notificationEventId: number | null,
  period: { from: string; to: string } | null,
): UseQueryResult<DeliveryPage> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: dispatchHistoryKeys.deliveries(notificationEventId, period),
    enabled: notificationEventId !== null && period !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/zalo-deliveries', {
          params: {
            query: {
              ...(period ?? { from: '', to: '' }),
              notificationEventId: notificationEventId ?? 0,
              size: DELIVERY_SIZE,
            },
          },
        }),
      ),
  });
};

export const useEvents = (): UseQueryResult<NotificationEvent[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: dispatchHistoryKeys.events,
    queryFn: async () => (await runRequest(() => client.GET('/app/notification-events'))).items,
  });
};

/** 지난 이력은 지금 쓰지 않는 부서에도 매여 있다 — 미사용 부서까지 받는다. */
export const useDepartments = (): UseQueryResult<Department[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: dispatchHistoryKeys.departments,
    queryFn: async () =>
      (
        await runRequest(() =>
          client.GET('/mdm/departments', {
            params: { query: { includeInactive: true, size: 100 } },
          }),
        )
      ).items,
  });
};
