import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  backwardQuery,
  forwardQuery,
  type TraceDirection,
  type TraceFilters,
} from './trace-filters';
import type { BackwardChain, BackwardListPage, ForwardChain, ForwardListPage } from './trace-types';

type Client = ReturnType<typeof useApiClient>['client'];

export const traceKeys = {
  list: (direction: TraceDirection, filters: TraceFilters) =>
    ['lot-trace', 'trace-list', direction, filters] as const,
  chain: (direction: TraceDirection, lotId: number) =>
    ['lot-trace', 'chain', direction, lotId] as const,
};

export type TraceListPage = ForwardListPage | BackwardListPage;

export const fetchForwardPage = (
  client: Client,
  filters: TraceFilters,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<ForwardListPage> =>
  runRequest(() =>
    client.GET('/trace/material-lot-flows', {
      params: { query: forwardQuery(filters, page, size) },
      ...(signal === undefined ? {} : { signal }),
    }),
  );

export const fetchBackwardPage = (
  client: Client,
  filters: TraceFilters,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<BackwardListPage> =>
  runRequest(() =>
    client.GET('/trace/product-lot-flows', {
      params: { query: backwardQuery(filters, page, size) },
      ...(signal === undefined ? {} : { signal }),
    }),
  );

/** 진입점이 없거나 기간이 맞지 않으면(`enabled` 거짓) 부르지 않는다 — 서버가 400을 낸다. */
export const useTraceList = (
  direction: TraceDirection,
  filters: TraceFilters,
  enabled: boolean,
): UseQueryResult<TraceListPage> => {
  const { client } = useApiClient();
  return useQuery<TraceListPage>({
    queryKey: traceKeys.list(direction, filters),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
    queryFn: () =>
      direction === 'forward'
        ? fetchForwardPage(client, filters, filters.page, filters.size)
        : fetchBackwardPage(client, filters, filters.page, filters.size),
  });
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

export const useBackwardChain = (lotId: number): UseQueryResult<BackwardChain> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: traceKeys.chain('backward', lotId),
    queryFn: () => fetchBackwardChain(client, lotId),
  });
};
