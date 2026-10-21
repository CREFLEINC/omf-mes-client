import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { ApiRequestError, runRequest, type ApiCallResult } from '../../patterns/request';
import type {
  ExcessCandidateListResult,
  InboundExcess,
  InboundExcessListResult,
  InboundExcessQuery,
} from './excess-types';
import { scheduleKeys } from './queries';

/**
 * 초과분 발주 연결의 읽기 둘 · 쓰기 둘(서버 장부 P-100).
 *
 * ⚠ **네 경로 모두 계약 사본 밖이다** — 생성 타입에 없어 이 네 경로만 받는 모양으로 클라이언트를 **좁혀 본다**
 * (`queries.ts` 의 `InboundScheduleClient` 와 같은 길). 실행은 같은 클라이언트가 한다 — 인증 쿠키·질의
 * 직렬화·오류 정규화가 그대로 선다. 계약에 실리면 이 타입과 넓힘을 지운다.
 *
 * **멱등 키를 보내지 않는다** — 계약 밖 경로라 요구하지 않고, 두 번 연결하면 서버가 400 `STATE_LOCKED` 로 막는다.
 *
 * 권한은 「입하 등록」(W-01-03)과 같다 — 없으면 403 이고, 그때 화면은 연결 자리를 감춘다.
 */
interface InboundExcessClient {
  GET(
    path: '/logistics/inbound-excesses',
    init: { params: { query: InboundExcessQuery } },
  ): Promise<ApiCallResult<InboundExcessListResult>>;
  GET(
    path: '/logistics/inbound-excesses/{inboundReceiptExcessId}/candidates',
    init: { params: { path: { inboundReceiptExcessId: number } } },
  ): Promise<ApiCallResult<ExcessCandidateListResult>>;
  POST(
    path: '/logistics/inbound-excesses/{inboundReceiptExcessId}:link',
    init: {
      params: { path: { inboundReceiptExcessId: number } };
      body: { purchaseOrderLineId: number };
    },
  ): Promise<ApiCallResult<InboundExcess>>;
  POST(
    path: '/logistics/inbound-excesses/{inboundReceiptExcessId}:unlink',
    init: { params: { path: { inboundReceiptExcessId: number } } },
  ): Promise<ApiCallResult<InboundExcess>>;
}

/** 한 번에 받는 초과분 수 — 서버 상한. 이보다 많으면 「앞쪽만 보인다」고 밝힌다. */
export const EXCESS_PAGE_SIZE = 200;

export const excessKeys = {
  all: ['inbound-excesses'] as const,
  list: (query: InboundExcessQuery) => ['inbound-excesses', 'list', query] as const,
  candidates: (inboundReceiptExcessId: number | null) =>
    ['inbound-excesses', 'candidates', inboundReceiptExcessId] as const,
};

/**
 * 권한이 없거나(403) 서버가 아직 이 경로를 모르면(404) **연결 자리를 감춘다** — 할 수 없는 일의 단추를 세우지 않는다.
 * 그 밖의 실패(연결·5xx)는 감추지 않고 알린다.
 */
export const isExcessUnavailable = (error: unknown): boolean =>
  error instanceof ApiRequestError && (error.httpStatus === 403 || error.httpStatus === 404);

export const useInboundExcesses = (
  query: InboundExcessQuery,
  enabled = true,
): UseQueryResult<InboundExcessListResult> => {
  const { client } = useApiClient();
  const excessClient = client as unknown as InboundExcessClient;

  return useQuery({
    queryKey: excessKeys.list(query),
    enabled,
    /* 권한 없음·경로 없음은 다시 불러도 같다 — 되풀이하지 않는다. */
    retry: (count, error) => !isExcessUnavailable(error) && count < 2,
    queryFn: () =>
      runRequest(() => excessClient.GET('/logistics/inbound-excesses', { params: { query } })),
  });
};

/** 고른 초과분을 연결할 수 있는 P/O 라인. 고르기 전에는 부르지 않는다. */
export const useExcessCandidates = (
  inboundReceiptExcessId: number | null,
): UseQueryResult<ExcessCandidateListResult> => {
  const { client } = useApiClient();
  const excessClient = client as unknown as InboundExcessClient;

  return useQuery({
    queryKey: excessKeys.candidates(inboundReceiptExcessId),
    enabled: inboundReceiptExcessId !== null,
    queryFn: () => {
      if (inboundReceiptExcessId === null) {
        throw new Error('초과분을 고르기 전에는 후보를 조회하지 않습니다.');
      }

      return runRequest(() =>
        excessClient.GET('/logistics/inbound-excesses/{inboundReceiptExcessId}/candidates', {
          params: { path: { inboundReceiptExcessId } },
        }),
      );
    },
  });
};

export interface LinkVariables {
  inboundReceiptExcessId: number;
  purchaseOrderLineId: number;
}

/**
 * 연결·해제 뒤에 다시 읽을 것 — 초과분 목록·후보, 그리고 **P/O 라인의 받은 수량**이 바뀌므로 입하 예정의
 * 두 표와 다른 화면이 든 발주 라인(`purchase-orders`)까지.
 */
const useInvalidateAfterLink = (): (() => Promise<void>) => {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: excessKeys.all }),
      queryClient.invalidateQueries({ queryKey: scheduleKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] }),
    ]);
  };
};

export const useLinkExcess = (): UseMutationResult<InboundExcess, Error, LinkVariables> => {
  const { client } = useApiClient();
  const excessClient = client as unknown as InboundExcessClient;
  const invalidate = useInvalidateAfterLink();

  return useMutation({
    mutationFn: ({ inboundReceiptExcessId, purchaseOrderLineId }: LinkVariables) =>
      runRequest(() =>
        excessClient.POST('/logistics/inbound-excesses/{inboundReceiptExcessId}:link', {
          params: { path: { inboundReceiptExcessId } },
          body: { purchaseOrderLineId },
        }),
      ),
    onSuccess: invalidate,
  });
};

export const useUnlinkExcess = (): UseMutationResult<InboundExcess, Error, number> => {
  const { client } = useApiClient();
  const excessClient = client as unknown as InboundExcessClient;
  const invalidate = useInvalidateAfterLink();

  return useMutation({
    mutationFn: (inboundReceiptExcessId: number) =>
      runRequest(() =>
        excessClient.POST('/logistics/inbound-excesses/{inboundReceiptExcessId}:unlink', {
          params: { path: { inboundReceiptExcessId } },
        }),
      ),
    onSuccess: invalidate,
  });
};
