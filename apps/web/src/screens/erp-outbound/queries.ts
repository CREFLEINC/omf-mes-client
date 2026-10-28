import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { ApiRequestError, runRequest } from '../../patterns/request';
import type { PeriodQuery } from '../integration-sync/period';
import type { MessageListResult } from '../integration-sync/types';
import {
  ALL_TIME,
  MESSAGE_STATUS,
  OUTBOUND_DIRECTION,
  OUTBOUND_INTERFACE,
  toOutboundItem,
  type CountedStatus,
  type OutboundItem,
} from './outbound-items';

/**
 * ERP 송신 탭의 읽기 — 송신 항목 설정 하나와 연계 메시지 목록(송신 · 상태별)이다.
 *
 * 메시지에서 나온 키는 연동 현황·이력의 키(`integration-messages`) 아래에 둔다 — 거기서 다시 보내면(재처리) 그
 * 무효화가 여기 건수 · 목록도 함께 다시 읽는다.
 *
 * 송신기는 10초마다 돈다 — 보낸 건이 목록에서 빠지는 것이 보이게 15초마다 다시 읽는다.
 */
export const REFRESH_MS = 15_000;

/** 송신 예정 목록 한 쪽의 줄 수. */
export const PENDING_PAGE_SIZE = 20;

export const erpOutboundKeys = {
  items: ['erp-outbound', 'items'] as const,
  count: (interfaceCode: string, status: CountedStatus) =>
    ['integration-messages', 'outbound-count', interfaceCode, status] as const,
  pending: (interfaceCode: string | null, page: number, period: PeriodQuery | null) =>
    ['integration-messages', 'outbound-pending', interfaceCode, page, period] as const,
};

/** 권한이 없으면(403) 다시 불러도 같다 — 되풀이하지 않는다. */
const isForbidden = (error: unknown): boolean =>
  error instanceof ApiRequestError && error.httpStatus === 403;

const retryUnlessForbidden = (count: number, error: Error): boolean =>
  !isForbidden(error) && count < 2;

/** 송신 항목 다섯 — 서버가 차례와 이름을 정한다. */
export const useOutboundItems = (): UseQueryResult<OutboundItem[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpOutboundKeys.items,
    queryFn: async () => {
      const data = await runRequest(() => client.GET('/integration/outbound-item-settings'));

      return data.items.map(toOutboundItem);
    },
  });
};

/** 짝이 있는 송신 인터페이스 — 건수를 셀 대상이다. */
const COUNTED_INTERFACES: readonly string[] = Object.values(OUTBOUND_INTERFACE).filter(
  (code): code is string => code !== null,
);

export interface OutboundCounts {
  /** 인터페이스 코드 → 상태별 건수. 아직 받지 못했으면 그 칸이 없다. */
  of: (interfaceCode: string, status: CountedStatus) => number | undefined;
  /** 송신 항목 전체의 합 — 하나라도 받지 못했으면 `undefined`. */
  total: (status: CountedStatus) => number | undefined;
  /** 하나라도 실패했으면 그 오류(403 이면 권한이 없다). */
  error: unknown;
}

/**
 * 인터페이스 × 상태(대기 · 실패)마다 건수를 센다 — 목록을 한 줄만 받아 `page.total` 을 읽는다. 서버의
 * `pendingMessageCount` 가 늘 0 이라 쓸 수 없다(`outbound-items.ts`). `enabled` 가 거짓이면 부르지 않는다 — 칩을 꽂을
 * 탭 막대가 없을 때(화면만 그린 시험 · 탭 묶음 밖).
 */
export const useOutboundCounts = (enabled = true): OutboundCounts => {
  const { client } = useApiClient();
  const pairs = COUNTED_INTERFACES.flatMap((interfaceCode) =>
    [MESSAGE_STATUS.pending, MESSAGE_STATUS.failed].map((status) => ({ interfaceCode, status })),
  );

  const results = useQueries({
    queries: pairs.map(({ interfaceCode, status }) => ({
      queryKey: erpOutboundKeys.count(interfaceCode, status),
      enabled,
      refetchInterval: REFRESH_MS,
      retry: retryUnlessForbidden,
      queryFn: () =>
        runRequest(() =>
          client.GET('/integration/messages', {
            params: {
              query: {
                ...ALL_TIME,
                directionCode: OUTBOUND_DIRECTION,
                statusCode: status,
                interfaceCode,
                size: 1,
              },
            },
          }),
        ).then((data) => data.page.total),
    })),
  });

  const of = (interfaceCode: string, status: CountedStatus): number | undefined => {
    const index = pairs.findIndex(
      (pair) => pair.interfaceCode === interfaceCode && pair.status === status,
    );

    return index < 0 ? undefined : results[index]?.data;
  };

  const total = (status: CountedStatus): number | undefined => {
    let sum = 0;
    for (const interfaceCode of COUNTED_INTERFACES) {
      const count = of(interfaceCode, status);
      if (count === undefined) return undefined;
      sum += count;
    }

    return sum;
  };

  return { of, total, error: results.find((result) => result.isError)?.error ?? null };
};

/** 고른 송신 항목의 송신 예정 목록. 짝이 없는 항목(반품 · 실사 조정)은 부르지 않는다. */
export const usePendingMessages = (
  interfaceCode: string | null,
  page: number,
  /** 생성일 조건. 없으면 기간 없이(전체) — 「아직 보내지 않은 것」은 기간과 상관없다. */
  period: PeriodQuery | null = null,
): UseQueryResult<MessageListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: erpOutboundKeys.pending(interfaceCode, page, period),
    enabled: interfaceCode !== null,
    refetchInterval: REFRESH_MS,
    retry: retryUnlessForbidden,
    queryFn: () => {
      if (interfaceCode === null) {
        throw new Error('송신 인터페이스가 없는 항목은 목록을 조회하지 않습니다.');
      }

      return runRequest(() =>
        client.GET('/integration/messages', {
          params: {
            query: {
              ...(period ?? ALL_TIME),
              directionCode: OUTBOUND_DIRECTION,
              statusCode: MESSAGE_STATUS.pending,
              interfaceCode,
              ...(page > 1 ? { page } : {}),
              size: PENDING_PAGE_SIZE,
            },
          },
        }),
      );
    },
  });
};
