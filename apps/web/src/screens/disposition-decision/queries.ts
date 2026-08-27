import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PendingListQuery } from './filters';
import type {
  DispositionDecisionListResponse,
  Nonconformance,
  NonconformanceListResponse,
} from './types';

export const dispositionKeys = {
  all: ['disposition-decision'] as const,
  pending: (query: PendingListQuery) => ['disposition-decision', 'pending', { ...query }] as const,
  detail: (nonconformanceId: number | null) =>
    ['disposition-decision', 'detail', nonconformanceId] as const,
  decisions: (nonconformanceId: number | null) =>
    ['disposition-decision', 'decisions', nonconformanceId] as const,
};

/**
 * 낙관적 잠금 토큰을 꺼낼 자리. 보관소가 응답 URL의 경로로 키를 잡으므로 같은 모양을 만든다
 * (공유계약 B-1). ⚠ 토큰은 **부적합 상세**가 내리고, 판정 저장은 그것을 `If-Match`로 싣는다 —
 * 저장 경로(`…/disposition-decisions`)가 아니다.
 */
export const nonconformanceDetailPath = (nonconformanceId: number): string =>
  `/quality/nonconformances/${String(nonconformanceId)}`;

/**
 * ⭐ 판정 대기 목록은 **제품출하(04) 계약**이다. 판정 저장만 품질(03) 계약이다 —
 * 경로 앞머리가 같아도 정본 파일이 다르다(공유계약 B-13).
 */
export const usePendingNonconformances = (
  query: PendingListQuery,
): UseQueryResult<NonconformanceListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: dispositionKeys.pending(query),
    queryFn: () => runRequest(() => client.GET('/quality/nonconformances', { params: { query } })),
  });
};

export const useNonconformanceDetail = (
  nonconformanceId: number | null,
): UseQueryResult<Nonconformance> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: dispositionKeys.detail(nonconformanceId),
    enabled: nonconformanceId !== null,
    queryFn: () => {
      if (nonconformanceId === null) {
        throw new Error('부적합을 고르기 전에는 상세를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/quality/nonconformances/{nonconformanceId}', {
          params: { path: { nonconformanceId } },
        }),
      );
    },
  });
};

/** 이 부적합에 이미 내려진 판정. 부분 처분이 되므로 여러 건일 수 있다. */
export const useDispositionDecisions = (
  nonconformanceId: number | null,
): UseQueryResult<DispositionDecisionListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: dispositionKeys.decisions(nonconformanceId),
    enabled: nonconformanceId !== null,
    queryFn: () => {
      if (nonconformanceId === null) {
        throw new Error('부적합을 고르기 전에는 판정 이력을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/quality/nonconformances/{nonconformanceId}/disposition-decisions', {
          params: { path: { nonconformanceId } },
        }),
      );
    },
  });
};
