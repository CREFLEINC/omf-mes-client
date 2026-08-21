import type { ApiClient, components } from '@omf-mes/api-client';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { HistoryFilters, LotFilters } from './filters';
import { lotStatusKeys } from './query-keys';
import {
  toLotHoldEventQuery,
  toLotHoldListQuery,
  toLotStatusListQuery,
  toLotStatusSummaryQuery,
} from './request-queries';
import {
  toLotHoldEventView,
  toLotHoldView,
  toLotDetailView,
  toLotStatusRow,
  toLotStatusSummaryView,
  type LotHoldEventView,
  type LotHoldView,
  type LotDetailView,
  type LotStatusRow,
  type LotStatusSummaryView,
} from './types';

type Client = ApiClient['client'];
type PageMeta = components['schemas']['PageMeta'];
type AppUser = components['schemas']['AppUser'];

export interface LotStatusListResult {
  rows: readonly LotStatusRow[];
  page: PageMeta;
}

export interface LotHoldListResult {
  rows: readonly LotHoldView[];
  page: PageMeta;
}

export interface LotHoldEventListResult {
  rows: readonly LotHoldEventView[];
  page: PageMeta;
}

export interface LotActorListResult {
  items: readonly AppUser[];
  page: PageMeta;
}

export const useLotActorOptions = (enabled: boolean): UseQueryResult<LotActorListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotStatusKeys.actors,
    enabled,
    queryFn: () =>
      runRequest(() => client.GET('/app/users', { params: { query: { includeInactive: true } } })),
  });
};

export const useLotDetail = (lotId: number | null): UseQueryResult<LotDetailView> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: lotStatusKeys.detail(lotId),
    enabled: lotId !== null,
    queryFn: async () => {
      if (lotId === null) throw new Error('LOT을 고르기 전에는 상세를 조회하지 않습니다.');
      const data = await runRequest(() =>
        client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
      );
      return toLotDetailView(data);
    },
  });
};

const fetchLotStatuses = async (
  client: Client,
  query: NonNullable<ReturnType<typeof toLotStatusListQuery>>,
): Promise<LotStatusListResult> => {
  const data = await runRequest(() => client.GET('/quality/lot-statuses', { params: { query } }));

  return { rows: data.items.map(toLotStatusRow), page: data.page };
};

export const useLotStatusList = (
  filters: LotFilters,
  page: number,
): UseQueryResult<LotStatusListResult> => {
  const { client } = useApiClient();
  const query = toLotStatusListQuery(filters, page);

  return useQuery({
    queryKey: lotStatusKeys.list(filters, page),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (query === null) throw new Error('LOT 유형을 고르기 전에는 목록을 조회하지 않습니다.');
      return fetchLotStatuses(client, query);
    },
  });
};

const fetchLotStatusSummary = async (
  client: Client,
  query: NonNullable<ReturnType<typeof toLotStatusSummaryQuery>>,
): Promise<LotStatusSummaryView> => {
  const data = await runRequest(() =>
    client.GET('/quality/lot-status-summary', { params: { query } }),
  );

  return toLotStatusSummaryView(data);
};

export const useLotStatusSummary = (filters: LotFilters): UseQueryResult<LotStatusSummaryView> => {
  const { client } = useApiClient();
  const query = toLotStatusSummaryQuery(filters);

  return useQuery({
    queryKey: lotStatusKeys.summary(filters),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) throw new Error('LOT 유형을 고르기 전에는 요약을 조회하지 않습니다.');
      return fetchLotStatusSummary(client, query);
    },
  });
};

const fetchLotHolds = async (
  client: Client,
  query: NonNullable<ReturnType<typeof toLotHoldListQuery>>,
): Promise<LotHoldListResult> => {
  const data = await runRequest(() => client.GET('/quality/lot-holds', { params: { query } }));

  return { rows: data.items.map(toLotHoldView), page: data.page };
};

export const useLotHolds = (lotId: number | null, page = 1): UseQueryResult<LotHoldListResult> => {
  const { client } = useApiClient();
  const query = toLotHoldListQuery(lotId, page);

  return useQuery({
    queryKey: lotStatusKeys.holds(lotId, page),
    enabled: query !== null,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (query === null) throw new Error('LOT을 고르기 전에는 보류 문서를 조회하지 않습니다.');
      return fetchLotHolds(client, query);
    },
  });
};

const fetchLotHoldEvents = async (
  client: Client,
  query: NonNullable<ReturnType<typeof toLotHoldEventQuery>>,
): Promise<LotHoldEventListResult> => {
  const data = await runRequest(() =>
    client.GET('/quality/lot-hold-events', { params: { query } }),
  );

  return { rows: data.items.map(toLotHoldEventView), page: data.page };
};

export const useLotHoldEvents = (
  filters: HistoryFilters,
  page: number,
  offsetMinutes: number,
): UseQueryResult<LotHoldEventListResult> => {
  const { client } = useApiClient();
  const query = toLotHoldEventQuery(filters, page, offsetMinutes);

  return useQuery({
    queryKey: lotStatusKeys.history(filters, page, offsetMinutes),
    enabled: query !== null,
    queryFn: () => {
      if (query === null)
        throw new Error('유효한 기간을 입력하기 전에는 이력을 조회하지 않습니다.');
      return fetchLotHoldEvents(client, query);
    },
  });
};
