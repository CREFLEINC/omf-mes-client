import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { ListQuery } from './filters';
import type {
  CandidateListResponse,
  DecisionListResponse,
  Nonconformance,
  NonconformanceListResponse,
} from './types';

/**
 * 이 화면의 읽기 — 넷이다.
 *
 * | 무엇 | 경로 | 언제 |
 * | --- | --- | --- |
 * | 판정 대상 목록 | `GET /quality/disposition-candidates` | 상태가 비었거나 「부적합 없음」일 때 |
 * | 부적합 목록 | `GET /quality/nonconformances?statusCode=` | 상태가 부적합 상태 셋 중 하나일 때 |
 * | 부적합 상세 | `GET /quality/nonconformances/{id}` | 부적합이 있는 대상을 골랐을 때 — 의뢰의 잠금 토큰이 여기서 온다 |
 * | 처분 목록 | `GET /quality/disposition-decisions?nonconformanceId=` | 같은 때 — 03 계약이다 |
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구한다.
 */

const ROOT = 'disposition-request';

export const requestKeys = {
  all: [ROOT] as const,
  list: (query: ListQuery) => [ROOT, 'list', query.source, { ...query.query }] as const,
  detail: (nonconformanceId: number | null) => [ROOT, 'detail', nonconformanceId] as const,
  decisions: (nonconformanceId: number | null) => [ROOT, 'decisions', nonconformanceId] as const,
};

/**
 * 낙관적 잠금 토큰을 꺼낼 자리. 보관소가 응답 URL의 경로로 키를 잡으므로 같은 모양을 만든다
 * (공유계약 B-1). ⚠ 토큰은 **부적합 상세**가 내리고, 판정 의뢰는 그것을 `If-Match`로 싣는다.
 */
export const nonconformanceDetailPath = (nonconformanceId: number): string =>
  `/quality/nonconformances/${String(nonconformanceId)}`;

export type TargetListResponse =
  | { source: 'candidates'; data: CandidateListResponse }
  | { source: 'nonconformances'; data: NonconformanceListResponse };

/** 진입 목록. 상태 조건이 어느 경로를 부를지 정하고(`toListQuery`), 여기서는 그대로 따른다. */
export const useTargetList = (query: ListQuery): UseQueryResult<TargetListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: requestKeys.list(query),
    queryFn: async (): Promise<TargetListResponse> => {
      if (query.source === 'candidates') {
        const data = await runRequest(() =>
          client.GET('/quality/disposition-candidates', { params: { query: query.query } }),
        );
        return { source: 'candidates', data };
      }

      const data = await runRequest(() =>
        client.GET('/quality/nonconformances', { params: { query: query.query } }),
      );
      return { source: 'nonconformances', data };
    },
  });
};

export const useNonconformanceDetail = (
  nonconformanceId: number | null,
): UseQueryResult<Nonconformance> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: requestKeys.detail(nonconformanceId),
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

/**
 * 이 부적합에 내려진 처분 — 부분 처분이 정상이라 여러 건일 수 있다(스펙 §5-5).
 * 요구서 §3-7이 「판정 결과 보기」를 전역 처분 목록에 `nonconformanceId`로 매핑했다.
 */
export const useDecisions = (
  nonconformanceId: number | null,
): UseQueryResult<DecisionListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: requestKeys.decisions(nonconformanceId),
    enabled: nonconformanceId !== null,
    queryFn: () => {
      if (nonconformanceId === null) {
        throw new Error('부적합을 고르기 전에는 처분 목록을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/quality/disposition-decisions', { params: { query: { nonconformanceId } } }),
      );
    },
  });
};
