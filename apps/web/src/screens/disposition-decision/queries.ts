import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

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
  pending: (query: PendingListQuery | null) =>
    ['disposition-decision', 'pending', query === null ? null : { ...query }] as const,
  detail: (nonconformanceId: number | null) =>
    ['disposition-decision', 'detail', nonconformanceId] as const,
  decisions: (nonconformanceId: number | null) =>
    ['disposition-decision', 'decisions', nonconformanceId] as const,
  concessions: (nonconformanceId: number | null) =>
    ['disposition-decision', 'concessions', nonconformanceId] as const,
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

      return runRequest(() => client.GET('/quality/nonconformances', { params: { query } }));
    },
  });
};

/**
 * 상태 칩의 건수(사용자 지시 · #223) — 상태마다 판정 대기 목록 첫 쪽의 총수. 목록과 같은 열쇠 · 같은 조회라
 * 지금 보는 상태의 조회는 다시 나가지 않는다. 돌려주는 차례는 넘긴 조회의 차례다.
 */
export const usePendingTotals = (queries: readonly PendingListQuery[]): (number | undefined)[] => {
  const { client } = useApiClient();

  return useQueries({
    queries: queries.map((query) => ({
      queryKey: dispositionKeys.pending(query),
      queryFn: () =>
        runRequest(() => client.GET('/quality/nonconformances', { params: { query } })),
    })),
  }).map((result) => result.data?.page.total);
};

/**
 * 대상 LOT 들의 «지금» 상태(#223) — 부적합에 남은 품질 상태는 등록 때 값이라, 판정 · 특채로 바뀐 LOT 상태를
 * 보이려면 LOT 을 따로 읽는다. 뿌리 키 아래라 판정 · 특채 적용 뒤 함께 다시 부른다. 못 읽은 LOT 은 빠진다.
 */
export const useLotStatuses = (lotIds: readonly number[]): Record<number, string> => {
  const { client } = useApiClient();
  const results = useQueries({
    queries: lotIds.map((lotId) => ({
      queryKey: [...dispositionKeys.all, 'lot', lotId] as const,
      queryFn: () =>
        runRequest(() => client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } })),
    })),
  });

  return Object.fromEntries(
    lotIds.flatMap((lotId, index) => {
      const statusCode = results[index]?.data?.lot.statusCode;
      return statusCode === undefined ? [] : [[lotId, statusCode]];
    }),
  );
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
/**
 * 이 부적합에 걸린 반려 아닌 특채 수(omf-all-around#354) — 서버가 선별을 막는 조건(`lockSortable`)과 같다. 결재 시절에 남은
 * 요청 중 특채 때문에 선별 저장이 409 로 떨어지기 전에 유형 칸에서 먼저 막는다. 부적합 하나의 특채는 LOT 수만큼이라 한 쪽이면 된다.
 */
export const useOpenConcessionCount = (nonconformanceId: number | null): UseQueryResult<number> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: dispositionKeys.concessions(nonconformanceId),
    enabled: nonconformanceId !== null,
    queryFn: async () => {
      if (nonconformanceId === null) {
        throw new Error('부적합을 고르기 전에는 특채를 조회하지 않습니다.');
      }
      const page = await runRequest(() =>
        client.GET('/quality/concessions', {
          params: { query: { nonconformanceId, page: 1, size: 100 } },
        }),
      );
      const rejected = page.items.filter((item) => item.statusCode === 'REJECTED').length;
      return Math.max(page.page.total, page.items.length) - rejected;
    },
  });
};

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
