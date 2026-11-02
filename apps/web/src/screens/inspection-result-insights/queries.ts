import type { ApiClient, components } from '@omf-mes/api-client';
import { keepPreviousData, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  DEFAULT_INSPECTION_RESULT_SORT,
  type InspectionInsightFilters,
  type InspectionResultSort,
} from './filters';
import {
  toDefectDistributionQuery,
  toDefectRateTrendQuery,
  toInspectionListQuery,
  toInspectionSummaryQuery,
  type DistributionGroup,
} from './request-queries';

type Client = ApiClient['client'];
/** 서버 선행 P-76 — 검사자 이름(`inspectorName`)을 함께 받는다(omf-all-around#85). */
export type InspectionResult = components['schemas']['InspectionResult'];
export type InspectionRequest = components['schemas']['InspectionRequest'];
export type InspectionSummary = components['schemas']['InspectionSummary'];
export type DefectRateTrend = components['schemas']['DefectRateTrend'];
export type DefectDistribution = components['schemas']['DefectDistribution'];
export type MeasurementItemSummary = components['schemas']['MeasurementItemSummary'];
export type InspectionMeasurement = components['schemas']['InspectionMeasurement'];
type PageMeta = components['schemas']['PageMeta'];

export interface InspectionResultList {
  items: readonly InspectionResult[];
  page: PageMeta;
}

export interface MeasurementSummary {
  asOf: string;
  items: readonly MeasurementItemSummary[];
}

export interface InspectionMeasurementList {
  items: readonly InspectionMeasurement[];
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
  isEnabled = true,
  lotId?: number,
  size?: number,
): UseQueryResult<InspectionResultList> => {
  const { client } = useApiClient();
  const query = toInspectionListQuery(filters, sort, page, lotId, size);
  return useQuery({
    queryKey: ['inspection-result-insights', 'list', filters, sort, page, lotId, size],
    enabled: isEnabled && query !== null,
    placeholderData: keepPreviousData,
    queryFn: () => {
      if (query === null) throw new Error('기간(또는 LOT) 전에는 목록을 조회하지 않습니다.');
      return fetchInspectionResults(client, query);
    },
  });
};

/**
 * 종합 판정 칩의 건수(사용자 2026-10-30 · #217) — 지금 조건(판정 칩만 빼고)으로 판정마다 한 줄만 받아 쪽 정보의 전체 건수를
 * 쓴다. `''` 는 「전체」다. 조회할 수 없는 조건(기간 없음 · LOT 미확인)이면 세지 않는다(undefined).
 */
export const useJudgmentCounts = (
  filters: InspectionInsightFilters,
  codes: readonly string[],
  isEnabled: boolean,
  lotId?: number,
): (number | undefined)[] => {
  const { client } = useApiClient();
  const results = useQueries({
    queries: codes.map((code) => {
      const scoped = { ...filters, overallJudgmentCode: code };
      const query = toInspectionListQuery(scoped, DEFAULT_INSPECTION_RESULT_SORT, 1, lotId);
      return {
        queryKey: ['inspection-result-insights', 'judgment-count', scoped, lotId],
        enabled: isEnabled && query !== null,
        queryFn: () => {
          if (query === null) throw new Error('조회할 수 없는 조건입니다.');
          return fetchInspectionResults(client, { ...query, size: 1 }).then(
            (list) => list.page.total,
          );
        },
      };
    }),
  });
  return results.map((result) => result.data);
};

export const useInspectionSummary = (
  filters: InspectionInsightFilters,
  isEnabled = true,
): UseQueryResult<InspectionSummary> => {
  const { client } = useApiClient();
  const query = toInspectionSummaryQuery(filters);
  return useQuery({
    queryKey: ['inspection-result-insights', 'summary', filters],
    enabled: isEnabled && query !== null,
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

/**
 * 고른 결과의 검사 의뢰를 부른다.
 *
 * ⚠ 「기준 버전」은 `InspectionResult` 계약에 없고 `InspectionRequest` 에만 있다 — 그리려면
 * 의뢰를 한 번 더 읽어야 한다. 결과를 고르기 전에는 부르지 않는다(client#589).
 */
export const useInspectionRequestDetail = (
  inspectionRequestId: number | null,
): UseQueryResult<InspectionRequest> => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['inspection-result-insights', 'request-detail', inspectionRequestId],
    enabled: inspectionRequestId !== null,
    queryFn: () => {
      if (inspectionRequestId === null) throw new Error('검사 결과를 고르기 전입니다.');
      return runRequest(() =>
        client.GET('/quality/inspection-requests/{inspectionRequestId}', {
          params: { path: { inspectionRequestId } },
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

export const useInspectionMeasurements = (
  inspectionResultId: number,
  page: number,
  calibrationExpired: '' | 'only' | 'exclude',
): UseQueryResult<InspectionMeasurementList> => {
  const { client } = useApiClient();
  const query: { page?: number; calibrationExpired?: 'only' | 'exclude' } = {};
  if (Number.isSafeInteger(page) && page > 1) query.page = page;
  if (calibrationExpired !== '') query.calibrationExpired = calibrationExpired;
  return useQuery({
    queryKey: [
      'inspection-result-insights',
      'measurements',
      inspectionResultId,
      page,
      calibrationExpired,
    ],
    enabled: Number.isSafeInteger(inspectionResultId) && inspectionResultId >= 1,
    placeholderData: keepPreviousData,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-results/{inspectionResultId}/measurements', {
          params: { path: { inspectionResultId }, query },
        }),
      ),
  });
};
