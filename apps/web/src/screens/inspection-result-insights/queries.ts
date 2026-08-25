import type { ApiClient, components } from '@omf-mes/api-client';
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { InspectionInsightFilters, InspectionResultSort } from './filters';
import {
  toDefectDistributionQuery,
  toDefectRateTrendQuery,
  toInspectionListQuery,
  toInspectionSummaryQuery,
  type DistributionGroup,
} from './request-queries';

type Client = ApiClient['client'];
export type InspectionResult = components['schemas']['InspectionResult'];
export type InspectionSummary = components['schemas']['InspectionSummary'];
export type DefectRateTrend = components['schemas']['DefectRateTrend'];
export type DefectDistribution = components['schemas']['DefectDistribution'];
export type MeasurementItemSummary = components['schemas']['MeasurementItemSummary'];
type PageMeta = components['schemas']['PageMeta'];

export interface InspectionResultList {
  items: readonly InspectionResult[];
  page: PageMeta;
}

export interface MeasurementSummary {
  asOf: string;
  items: readonly MeasurementItemSummary[];
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

export const useDefectRateTrend = (
  filters: InspectionInsightFilters,
  enabled: boolean,
): UseQueryResult<DefectRateTrend> => {
  const { client } = useApiClient();
  const query = toDefectRateTrendQuery(filters);
  return useQuery({
    queryKey: ['inspection-result-insights', 'trend', filters],
    enabled: enabled && query !== null,
    queryFn: () => {
      if (query === null) throw new Error('기간과 검사유형 전에는 추이를 조회하지 않습니다.');
      return runRequest(() =>
        client.GET('/quality/inspection-results/defect-rate-trend', { params: { query } }),
      );
    },
  });
};

export const useDefectDistribution = (
  filters: InspectionInsightFilters,
  groupBy: DistributionGroup,
  sourceAxisCode: string,
  enabled: boolean,
): UseQueryResult<DefectDistribution> => {
  const { client } = useApiClient();
  const query = toDefectDistributionQuery(filters, groupBy, sourceAxisCode);
  return useQuery({
    queryKey: ['inspection-result-insights', 'distribution', filters, groupBy, sourceAxisCode],
    enabled: enabled && query !== null,
    queryFn: () => {
      if (query === null) throw new Error('유효한 기간 전에는 분포를 조회하지 않습니다.');
      return runRequest(() =>
        client.GET('/quality/defect-records/distribution', { params: { query } }),
      );
    },
  });
};

export const useInspectionResultDetail = (
  inspectionResultId: number | null,
): UseQueryResult<InspectionResult> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['inspection-result-insights', 'detail', inspectionResultId],
    enabled: inspectionResultId !== null,
    queryFn: () => {
      if (inspectionResultId === null) throw new Error('검사 결과를 고르기 전입니다.');
      return runRequest(() =>
        client.GET('/quality/inspection-results/{inspectionResultId}', {
          params: { path: { inspectionResultId } },
        }),
      );
    },
  });
};

export const useMeasurementSummary = (
  inspectionResultId: number | null,
): UseQueryResult<MeasurementSummary> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['inspection-result-insights', 'measurement-summary', inspectionResultId],
    enabled: inspectionResultId !== null,
    queryFn: () => {
      if (inspectionResultId === null) throw new Error('검사 결과를 고르기 전입니다.');
      return runRequest(() =>
        client.GET('/quality/inspection-results/{inspectionResultId}/measurement-summary', {
          params: { path: { inspectionResultId } },
        }),
      );
    },
  });
};
