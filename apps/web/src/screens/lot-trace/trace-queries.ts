import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { BackwardChain, ForwardChain } from './trace-types';

type Client = ReturnType<typeof useApiClient>['client'];

export const traceKeys = {
  chain: (direction: 'forward' | 'backward', lotId: number) =>
    ['lot-trace', 'chain', direction, lotId] as const,
};

const fetchForwardChain = (client: Client, lotId: number) =>
  runRequest(() => client.GET('/trace/lots/{lotId}/forward-flow', { params: { path: { lotId } } }));

const fetchBackwardChain = (client: Client, lotId: number) =>
  runRequest(() =>
    client.GET('/trace/lots/{lotId}/backward-flow', { params: { path: { lotId } } }),
  );

export const useForwardChain = (lotId: number): UseQueryResult<ForwardChain> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: traceKeys.chain('forward', lotId),
    queryFn: () => fetchForwardChain(client, lotId),
  });
};

export const useBackwardChain = (lotId: number, enabled = true): UseQueryResult<BackwardChain> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: traceKeys.chain('backward', lotId),
    enabled,
    queryFn: () => fetchBackwardChain(client, lotId),
  });
};
