import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { ApiRequestError, runRequest, type ApiCallResult } from '../../patterns/request';
import { scheduleKeys } from './queries';
import type {
  InboundProgressResult,
  InboundStageCountsResult,
  InspectionRequestCreate,
  InspectionRequestCreated,
  PurchaseOrderSummaryQuery,
} from './types';

/**
 * 입고 진행의 읽기 둘 · 쓰기 하나 — **셋 모두 계약 대기다**(omf-mes-server#805 · 규범 C-15).
 *
 * - `GET /logistics/purchase-orders/{purchaseOrderId}/inbound-progress` — 고른 발주의 LOT 과 단계(오른쪽 LOT 줄)
 * - `GET /logistics/purchase-orders:inbound-stage-counts` — 목록 조건으로 센 묶음별 LOT 수(탭 줄의 단계 칩)
 * - `POST /quality/inspection-requests` — LOT 하나의 IQC 의뢰(LOT 줄의 「IQC 의뢰 요청」)
 *
 * 생성 타입에 없어 이 경로만 받는 모양으로 클라이언트를 **좁혀 본다**(`queries.ts` 와 같은 길). 실행은 같은
 * 클라이언트가 한다 — 인증 쿠키·질의 직렬화·오류 정규화가 그대로 선다. 계약에 실리면 이 타입과 넓힘을 지운다.
 *
 * **서버가 경로를 모르면(404) · 권한이 없으면(403) 그 자리를 감춘다** — 초과분 연결과 같은 길. 그래서 앞선 서버에
 * 붙여도 이 화면은 지금의 두 표 그대로다. 「준비 중」 같은 빈 자리를 두지 않는다(C-15 §4).
 */
interface InboundProgressClient {
  GET(
    path: '/logistics/purchase-orders/{purchaseOrderId}/inbound-progress',
    init: { params: { path: { purchaseOrderId: number } } },
  ): Promise<ApiCallResult<InboundProgressResult>>;
  GET(
    path: '/logistics/purchase-orders:inbound-stage-counts',
    init: { params: { query: StageCountsQuery } },
  ): Promise<ApiCallResult<InboundStageCountsResult>>;
  POST(
    path: '/quality/inspection-requests',
    init: { params: { header: { 'Idempotency-Key': string } }; body: InspectionRequestCreate },
  ): Promise<ApiCallResult<InspectionRequestCreated>>;
}

/** 건수는 목록과 같은 조건이되 **쪽·크기·단계 조건은 빼고** 센다 — 칩은 조건 전체의 수를 말해야 한다. */
export type StageCountsQuery = Omit<PurchaseOrderSummaryQuery, 'page' | 'size' | 'inboundStage'>;

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

      const progressClient = client as unknown as InboundProgressClient;

      return runRequest(() =>
        progressClient.GET('/logistics/purchase-orders/{purchaseOrderId}/inbound-progress', {
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

      const progressClient = client as unknown as InboundProgressClient;

      return runRequest(() =>
        progressClient.GET('/logistics/purchase-orders:inbound-stage-counts', {
          params: { query },
        }),
      );
    },
  });
};

export interface RequestIqcOptions {
  /** 의뢰한 LOT 이 든 발주 — 그 발주의 LOT 줄이 「검사 대기」로 바뀌어야 한다. */
  purchaseOrderId: number;
  onSuccess: (data: InspectionRequestCreated) => void;
}

/**
 * IQC 의뢰 요청. 공통 쓰기 훅을 그대로 쓴다 — 멱등 키·오류 정규화·무효화가 그 훅의 것이다.
 * 되돌릴 수 있는 쓰기라(의뢰는 품질팀이 취소할 수 있다) 확인 창을 두지 않는다. 의뢰가 이미 있으면 서버가 400 으로 막는다.
 * 라인 오류를 낼 칸이 없어(`knownFields` 없음) 실패는 전부 배너로 간다.
 */
export const useRequestIqc = (
  options: RequestIqcOptions,
): MasterWriteResult<InspectionRequestCreate> => {
  const { client } = useApiClient();

  return useMasterWrite<InspectionRequestCreate, InspectionRequestCreated>({
    request: (body, headers) =>
      (client as unknown as InboundProgressClient).POST('/quality/inspection-requests', {
        params: { header: { 'Idempotency-Key': headers['Idempotency-Key'] } },
        body,
      }),
    etagPath: null,
    invalidateKeys: [
      progressKeys.lots(options.purchaseOrderId),
      progressKeys.all,
      /* 발주 목록의 「진행」 열과 칩 수도 바뀐다. */
      scheduleKeys.all,
    ],
    knownFields: [],
    onSuccess: options.onSuccess,
  });
};
