import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { paths } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type { PendingListQuery } from './filters';
import type { HistoryListQuery } from './history-filters';
import type {
  DispositionDecisionHistoryResponse,
  DispositionDecisionListResponse,
  Nonconformance,
  NonconformanceListResponse,
} from './types';

type PendingQuery = NonNullable<paths['/quality/nonconformances']['get']['parameters']['query']>;
type HistoryQuery = NonNullable<
  paths['/quality/disposition-decisions']['get']['parameters']['query']
>;

export const dispositionKeys = {
  all: ['disposition-decision'] as const,
  pending: (query: PendingListQuery | null) =>
    ['disposition-decision', 'pending', query === null ? null : { ...query }] as const,
  detail: (nonconformanceId: number | null) =>
    ['disposition-decision', 'detail', nonconformanceId] as const,
  decisions: (nonconformanceId: number | null) =>
    ['disposition-decision', 'decisions', nonconformanceId] as const,
  history: (query: HistoryListQuery | null) =>
    ['disposition-decision', 'history', query === null ? null : { ...query }] as const,
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
  query: PendingListQuery | null,
): UseQueryResult<NonconformanceListResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: dispositionKeys.pending(query),
    /* 기간이 막히면 조회를 열지 않는다 — 막았는데 요청은 나가는 상태를 만들지 않는다. */
    enabled: query !== null,
    queryFn: () => {
      if (query === null) throw new Error('기간이 막힌 채로는 목록을 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/quality/nonconformances', {
          params: { query: query as PendingQuery },
        }),
      );
    },
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

/**
 * 처리 이력 탭.
 *
 * ⭐ **같은 경로를 `W-04-10`(폐기)·`W-04-11`(재등록)·`P-04-03`(재작업)이 처분 유형으로 걸러
 * 쓴다** — 이 화면이 채우는 진입 목록이 바로 이것이다.
 *
 * 판정 대기 탭에 있는 동안에는 열지 않는다 — 보지 않는 목록을 부르면 원장 조회가 두 배가 된다.
 */
export const useDecisionHistory = (
  query: HistoryListQuery | null,
): UseQueryResult<DispositionDecisionHistoryResponse> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: dispositionKeys.history(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) throw new Error('이력 탭이 아닐 때는 조회하지 않습니다.');

      return runRequest(() =>
        client.GET('/quality/disposition-decisions', {
          params: { query: query as HistoryQuery },
        }),
      );
    },
  });
};
