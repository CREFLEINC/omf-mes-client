import type { ApiClient, components } from '@omf-mes/api-client';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { InspectionInsightFilters, InspectionResultSort } from './filters';
import { toInspectionListQuery, toInspectionSummaryQuery } from './request-queries';

type Client = ApiClient['client'];
export type InspectionResult = components['schemas']['InspectionResult'];
export type InspectionSummary = components['schemas']['InspectionSummary'];
type PageMeta = components['schemas']['PageMeta'];

export interface InspectionResultList {
  items: readonly InspectionResult[];
  page: PageMeta;
}

const fetchInspectionResults = async (
  client: Client,
  query: NonNullable<ReturnType<typeof toInspectionListQuery>>,
): Promise<InspectionResultList> =>
  runRequest(() => client.GET('/quality/inspection-results', { params: { query } }));

export const useInspectionResults = (
  filters: InspectionInsightFilters,
  sort: InspectionResultSort,
  page: number,
): UseQueryResult<InspectionResultList> => {
  const { client } = useApiClient();
  const query = toInspectionListQuery(filters, sort, page);
  return useQuery({
    queryKey: ['inspection-result-insights', 'list', filters, sort, page],
    enabled: query !== null,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (query === null) throw new Error('기간과 검사유형 전에는 목록을 조회하지 않습니다.');
      return fetchInspectionResults(client, query);
    },
  });
};

export const useInspectionSummary = (
  filters: InspectionInsightFilters,
): UseQueryResult<InspectionSummary> => {
  const { client } = useApiClient();
  const query = toInspectionSummaryQuery(filters);
  return useQuery({
    queryKey: ['inspection-result-insights', 'summary', filters],
    enabled: query !== null,
    queryFn: () => {
      if (query === null) throw new Error('기간과 검사유형 전에는 요약을 조회하지 않습니다.');
      return runRequest(() =>
        client.GET('/quality/inspection-results/summary', { params: { query } }),
      );
    },
  });
};
