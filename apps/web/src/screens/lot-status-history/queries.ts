import type { ApiClient, components } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { LotFilters } from './filters';
import { lotStatusKeys } from './query-keys';
import { toLotStatusListQuery, toLotStatusSummaryQuery } from './request-queries';
import {
  toLotStatusRow,
  toLotStatusSummaryView,
  type LotStatusRow,
  type LotStatusSummaryView,
} from './types';

type Client = ApiClient['client'];
type PageMeta = components['schemas']['PageMeta'];

export interface LotStatusListResult {
  rows: readonly LotStatusRow[];
  page: PageMeta;
}

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
