import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { ApiRequestError, runRequest, type ApiCallResult } from '../../patterns/request';
import {
  NO_ORDER_EXCEPTION_TYPES,
  type ExcessCandidateListResult,
  type InboundAllocation,
  type UnallocatedListResult,
  type UnallocatedQuery,
} from './excess-types';
import { progressKeys } from './progress-queries';
import { scheduleKeys } from './queries';

/**
 * 초과분 발주 연결의 읽기 둘 · 쓰기 하나(서버 장부 P-115 입하 ↔ P/O 배정). 화면 낱말과 서버 낱말의 짝은 문구 파일
 * (`inboundSchedule.excess`) 주석에 있다 — 초과분 = 미배정, 연결 = 배정.
 *
 * ⚠ **세 경로 모두 계약 사본 밖이다** — 생성 타입에 없어 이 세 경로만 받는 모양으로 클라이언트를 **좁혀 본다**
 * (`queries.ts` 의 `InboundScheduleClient` 와 같은 길). 실행은 같은 클라이언트가 한다 — 인증 쿠키·질의
 * 직렬화·오류 정규화가 그대로 선다. 계약에 실리면 이 타입과 넓힘을 지운다.
 *
 * **멱등 키를 보내지 않는다** — 계약 밖 경로라 요구하지 않고, 두 번 보내면 두 번째는 남은 초과분을 넘어 서버가
 * 400 `RANGE` 로 막는다.
 *
 * 권한은 「입하 등록」(W-01-03)과 같다 — 없으면 403 이고, 그때 화면은 연결 자리를 감춘다.
 */
interface InboundAllocationClient {
  GET(
    path: '/logistics/inbound-unallocated',
    init: { params: { query: UnallocatedQuery } },
  ): Promise<ApiCallResult<UnallocatedListResult>>;
  GET(
    path: '/logistics/inbound-receipt-lines/{inboundReceiptLineId}/allocation-candidates',
    init: { params: { path: { inboundReceiptLineId: number } } },
  ): Promise<ApiCallResult<ExcessCandidateListResult>>;
  POST(
    path: '/logistics/inbound-receipt-lines/{inboundReceiptLineId}/allocations',
    init: {
      params: { path: { inboundReceiptLineId: number } };
      body: { purchaseOrderLineId: number; qty: number };
    },
  ): Promise<ApiCallResult<InboundAllocation>>;
}

/** 한 번에 받는 초과분 수 — 서버 상한. 이보다 많으면 「앞쪽만 보인다」고 밝힌다. */
export const EXCESS_PAGE_SIZE = 200;

export const excessKeys = {
  all: ['inbound-unallocated'] as const,
  list: (query: UnallocatedQuery) => ['inbound-unallocated', 'list', query] as const,
  candidates: (inboundReceiptLineId: number | null) =>
    ['inbound-unallocated', 'candidates', inboundReceiptLineId] as const,
};

/**
 * 권한이 없거나(403) 서버가 아직 이 경로를 모르면(404) **연결 자리를 감춘다** — 할 수 없는 일의 단추를 세우지 않는다.
 * 그 밖의 실패(연결·5xx)는 감추지 않고 알린다.
 */
export const isExcessUnavailable = (error: unknown): boolean =>
  error instanceof ApiRequestError && (error.httpStatus === 403 || error.httpStatus === 404);

/** 초과분이 남은 입하 줄. 고객사급 · 무상샘플 입하는 서버가 빼고 준다(`NO_ORDER_EXCEPTION_TYPES`) — 전체 수도 뺀 뒤의 수다. */
export const useUnallocatedLines = (
  query: UnallocatedQuery,
  enabled = true,
): UseQueryResult<UnallocatedListResult> => {
  const { client } = useApiClient();
  const allocationClient = client as unknown as InboundAllocationClient;
  const fullQuery: UnallocatedQuery = {
    ...query,
    excludeExceptionTypeCode: NO_ORDER_EXCEPTION_TYPES.join(','),
  };

  return useQuery({
    queryKey: excessKeys.list(fullQuery),
    enabled,
    /* 권한 없음·경로 없음은 다시 불러도 같다 — 되풀이하지 않는다. */
    retry: (count, error) => !isExcessUnavailable(error) && count < 2,
    queryFn: () =>
      runRequest(() =>
        allocationClient.GET('/logistics/inbound-unallocated', { params: { query: fullQuery } }),
      ),
  });
};

/** 고른 입하 줄의 초과분을 연결할 수 있는 P/O 라인. 고르기 전에는 부르지 않는다. */
export const useExcessCandidates = (
  inboundReceiptLineId: number | null,
): UseQueryResult<ExcessCandidateListResult> => {
  const { client } = useApiClient();
  const allocationClient = client as unknown as InboundAllocationClient;

  return useQuery({
    queryKey: excessKeys.candidates(inboundReceiptLineId),
    enabled: inboundReceiptLineId !== null,
    queryFn: () => {
      if (inboundReceiptLineId === null) {
        throw new Error('초과분을 고르기 전에는 후보를 조회하지 않습니다.');
      }

      return runRequest(() =>
        allocationClient.GET(
          '/logistics/inbound-receipt-lines/{inboundReceiptLineId}/allocation-candidates',
          { params: { path: { inboundReceiptLineId } } },
        ),
      );
    },
  });
};

export interface LinkVariables {
  inboundReceiptLineId: number;
  purchaseOrderLineId: number;
  /** 연결할 수량 — 지금은 그 줄의 초과분 전부다(서버는 일부도 받는다). */
  qty: number;
}

/**
 * 연결 뒤에 다시 읽을 것 — 초과분 목록·후보, 그리고 **P/O 라인의 받은 수량**이 바뀌므로 입고 관리의 두 표와
 * 다른 화면이 든 발주 라인(`purchase-orders`)까지. 연결한 발주의 LOT 줄에 그 입하 줄이 새로 서므로 진행도 다시 읽는다.
 */
const useInvalidateAfterLink = (): (() => Promise<void>) => {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: excessKeys.all }),
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
      queryClient.invalidateQueries({ queryKey: progressKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
    ]);
  };
};

export const useLinkExcess = (): UseMutationResult<InboundAllocation, Error, LinkVariables> => {
  const { client } = useApiClient();
  const allocationClient = client as unknown as InboundAllocationClient;
  const invalidate = useInvalidateAfterLink();

  return useMutation({
    mutationFn: ({ inboundReceiptLineId, purchaseOrderLineId, qty }: LinkVariables) =>
      runRequest(() =>
        allocationClient.POST(
          '/logistics/inbound-receipt-lines/{inboundReceiptLineId}/allocations',
          {
            params: { path: { inboundReceiptLineId } },
            body: { purchaseOrderLineId, qty },
          },
        ),
      ),
    onSuccess: invalidate,
  });
};
