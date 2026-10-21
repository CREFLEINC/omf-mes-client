import type {
  NotificationDispatch,
  NotificationDispatchQuery,
  NotificationEventForward,
  ZaloDelivery,
  components,
} from '@omf-mes/api-client';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type PageMeta = components['schemas']['PageMeta'];
type Department = components['schemas']['Department'];

export const PAGE_SIZE = 50;
/** 한 이벤트의 Zalo 발송은 그 부서 수신자 수만큼이다 — 한 번에 받는다. */
const DELIVERY_SIZE = 200;

export const dispatchHistoryKeys = {
  dispatches: (query: NotificationDispatchQuery | null) =>
    ['dispatch-history', 'dispatches', query] as const,
  deliveries: (notificationEventId: number | null) =>
    ['dispatch-history', 'deliveries', notificationEventId ?? 0] as const,
  events: ['dispatch-history', 'events'] as const,
  departments: ['dispatch-history', 'departments'] as const,
};

/** 기간이 맞지 않으면(`null`) 부르지 않는다 — 서버가 400 을 낸다. */
export const useDispatches = (
  query: NotificationDispatchQuery | null,
): UseQueryResult<{ items: NotificationDispatch[]; page: PageMeta }> => {
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

export const useDeliveries = (
  notificationEventId: number | null,
): UseQueryResult<{ items: ZaloDelivery[]; page: PageMeta }> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: dispatchHistoryKeys.deliveries(notificationEventId),
    enabled: notificationEventId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/app/zalo-deliveries', {
          params: { query: { notificationEventId: notificationEventId ?? 0, size: DELIVERY_SIZE } },
        }),
      ),
  });
};

export const useEvents = (): UseQueryResult<NotificationEventForward[]> => {
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
