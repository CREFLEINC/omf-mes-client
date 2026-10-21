import type { NotificationEventForward } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { requireIfMatch, useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { runRequest } from '../../patterns/request';
import type { Connection, ConnectionReplace } from './types';

export const connectionPath = '/app/zalo-connection';

export const zaloConnectionKeys = {
  connection: ['zalo-connection'] as const,
  events: ['zalo-connection', 'events'] as const,
};

export const useConnection = (): UseQueryResult<Connection> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: zaloConnectionKeys.connection,
    queryFn: () => runRequest(() => client.GET('/app/zalo-connection')),
  });
};

/** 템플릿 행의 이벤트 이름 — 카탈로그가 정본이다. */
export const useEventNames = (): UseQueryResult<NotificationEventForward[]> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: zaloConnectionKeys.events,
    queryFn: async () => (await runRequest(() => client.GET('/app/notification-events'))).items,
  });
};

export const useReplaceConnection = (
  onSuccess: (data: Connection) => void,
): MasterWriteResult<ConnectionReplace> => {
  const { client } = useApiClient();
  return useMasterWrite({
    request: (body, headers) =>
      client.PUT('/app/zalo-connection', {
        params: {
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'If-Match': requireIfMatch(headers),
          },
        },
        body,
      }),
    etagPath: connectionPath,
    invalidateKeys: [],
    knownFields: ['appId', 'secretKey', 'refreshToken', 'paramMaxLength'],
    onSuccess,
  });
};
