import type { paths } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { ApiRequestError, runRequest } from '../../patterns/request';
import type { InboundProgressResult, InboundStageCountsResult } from './types';

/**
 * 입고 진행의 읽기 둘(omf-mes-server#805 · 장부 P-110 · 규범 C-15).
 *
 * - `GET /logistics/purchase-orders/{purchaseOrderId}/inbound-progress` — 고른 발주의 LOT 과 단계(오른쪽 LOT 줄)
 * - `GET /logistics/purchase-orders:inbound-stage-counts` — 목록 조건으로 센 묶음별 LOT 수(탭 줄의 단계 칩)
 *
 * 두 경로 모두 생성 타입에 있어 `client.GET` 을 바로 부른다. LOT 진행은 `stageCode` 만 넓힌 모양으로 받는다
 * (`types.ts` 의 `InboundLotProgress`).
 *
 * IQC 의뢰는 입하 등록 때 서버가 만들어 이 화면이 보낼 쓰기는 없다(사용자 결정 2026-10-29 · #909).
 *
 * **서버가 경로를 모르면(404) · 권한이 없으면(403) 그 자리를 감춘다** — 초과분 연결과 같은 길. 그래서 앞선 서버에
 * 붙여도 이 화면은 지금의 두 표 그대로다. 「준비 중」 같은 빈 자리를 두지 않는다(C-15 §4).
 */

/** 건수는 목록과 같은 조건이되 **쪽·크기·단계·정렬은 빼고** 센다 — 칩은 조건 전체의 수를 말해야 한다. */
export type StageCountsQuery = NonNullable<
  paths['/logistics/purchase-orders:inbound-stage-counts']['get']['parameters']['query']
>;

export const progressKeys = {
  all: ['inbound-progress'] as const,
  lots: (purchaseOrderId: number | null) => ['inbound-progress', 'lots', purchaseOrderId] as const,
  counts: (query: StageCountsQuery | null) => ['inbound-progress', 'counts', query] as const,
};

/** 서버가 경로를 모르거나(404) 권한이 없다(403) — 그 자리를 감출 신호다. 다른 실패는 실패로 보인다. */
export const isProgressUnavailable = (error: unknown): boolean =>
  error instanceof ApiRequestError && (error.httpStatus === 404 || error.httpStatus === 403);

/** 고른 발주의 LOT 진행. 고르기 전에는 부르지 않는다. 404·403 은 다시 묻지 않는다(`retry: false`). */
export const useInboundProgress = (
  purchaseOrderId: number | null,
): UseQueryResult<InboundProgressResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: progressKeys.lots(purchaseOrderId),
    enabled: purchaseOrderId !== null,
    retry: false,
    queryFn: () => {
      if (purchaseOrderId === null) {
        throw new Error('발주를 고르기 전에는 입고 진행을 조회하지 않습니다.');
      }

      return runRequest<InboundProgressResult>(() =>
        client.GET('/logistics/purchase-orders/{purchaseOrderId}/inbound-progress', {
          params: { path: { purchaseOrderId } },
        }),
      );
    },
  });
};

/** 탭 줄 칩의 묶음별 수. 목록을 조회하지 않을 때(`null`)는 세지도 않는다. */
export const useInboundStageCounts = (
  query: StageCountsQuery | null,
): UseQueryResult<InboundStageCountsResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: progressKeys.counts(query),
    enabled: query !== null,
    retry: false,
    queryFn: () => {
      if (query === null) {
        throw new Error('보낼 수 없는 기간에서는 단계 건수를 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/logistics/purchase-orders:inbound-stage-counts', { params: { query } }),
      );
    },
  });
};
