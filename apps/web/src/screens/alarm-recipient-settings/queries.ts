import { messages } from '@omf-mes/i18n';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type {
  AppUser,
  BusinessUnit,
  NotificationEvent,
  NotificationSubscription,
  NotificationSubscriptionReplace,
  PreviewResult,
  Role,
} from './types';

export const subscriptionPath = '/app/notification-subscriptions';

export const alarmRecipientKeys = {
  all: ['alarm-recipient-settings'] as const,
  events: ['alarm-recipient-settings', 'events'] as const,
  subscriptions: ['alarm-recipient-settings', 'subscriptions'] as const,
  detail: (eventCode: string | null) =>
    ['alarm-recipient-settings', 'detail', eventCode ?? ''] as const,
  businessUnits: ['alarm-recipient-settings', 'business-units'] as const,
  roles: ['alarm-recipient-settings', 'roles'] as const,
  users: ['alarm-recipient-settings', 'users'] as const,
};

export const useEvents = (): UseQueryResult<NotificationEvent[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: alarmRecipientKeys.events,
    queryFn: async () => (await runRequest(() => client.GET('/app/notification-events'))).items,
  });
};

export const useSubscriptions = (): UseQueryResult<NotificationSubscription[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: alarmRecipientKeys.subscriptions,
    queryFn: async () => (await runRequest(() => client.GET(subscriptionPath))).items,
  });
};

export const useSubscription = (
  eventCode: string | null,
): UseQueryResult<NotificationSubscription | null> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: alarmRecipientKeys.detail(eventCode),
    enabled: eventCode !== null,
    queryFn: async () => {
      if (eventCode === null) return null;
      const response = await runRequest(() =>
        client.GET(subscriptionPath, { params: { query: { eventCode } } }),
      );
      return response.items.find((item) => item.eventCode === eventCode) ?? null;
    },
  });
};

type PagedItem = BusinessUnit | Role | AppUser;

const loadAll = async <T extends PagedItem>(
  getPage: (page: number) => Promise<{ items: T[]; page: { total: number } }>,
): Promise<T[]> => {
  const result: T[] = [];
  let page = 1;
  let total = 0;
  do {
    const response = await getPage(page);
    total = response.page.total;
    result.push(...response.items);
    page += 1;
    if (response.items.length === 0) break;
    if (result.length >= response.page.total) break;
  } while (page <= 100);
  if (result.length < total)
    throw new Error(messages.alarmRecipientSettings.errors.lookupIncomplete);
  return result;
};

export const useReferenceLists = (): {
  businessUnits: UseQueryResult<BusinessUnit[]>;
  roles: UseQueryResult<Role[]>;
  users: UseQueryResult<AppUser[]>;
} => {
  const { client } = useApiClient();
  const query = { includeInactive: true, size: 100 };
  return {
    businessUnits: useQuery({
      queryKey: alarmRecipientKeys.businessUnits,
      queryFn: () =>
        loadAll((page) =>
          runRequest(() =>
            client.GET('/mdm/business-units', { params: { query: { ...query, page } } }),
          ),
        ),
    }),
    roles: useQuery({
      queryKey: alarmRecipientKeys.roles,
      queryFn: () =>
        loadAll((page) =>
          runRequest(() => client.GET('/app/roles', { params: { query: { ...query, page } } })),
        ),
    }),
    users: useQuery({
      queryKey: alarmRecipientKeys.users,
      queryFn: () =>
        loadAll((page) =>
          runRequest(() => client.GET('/app/users', { params: { query: { ...query, page } } })),
        ),
    }),
  };
};

export const usePreview = (
  onSuccess: (data: PreviewResult) => void,
): MasterWriteResult<NotificationSubscriptionReplace> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.POST('/app/notification-subscriptions/recipients:preview', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [],
    knownFields: ['recipients'],
    onSuccess,
  });
};

export const useReplaceSubscription = (
  eventCode: string | null,
  onSuccess: (data: NotificationSubscription) => void,
): MasterWriteResult<NotificationSubscriptionReplace> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.PUT(subscriptionPath, {
        params: {
          query: { eventCode: eventCode ?? '' },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: eventCode === null ? null : subscriptionPath,
    invalidateKeys: [alarmRecipientKeys.subscriptions, alarmRecipientKeys.detail(eventCode)],
    knownFields: ['recipients'],
    onSuccess,
  });
};
