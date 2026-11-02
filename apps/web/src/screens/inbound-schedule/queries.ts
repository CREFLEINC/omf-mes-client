import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import type {
  InboundScheduleListResult,
  PurchaseOrderSummaryListResult,
  PurchaseOrderSummaryQuery,
} from './types';

/**
 * 이 화면의 읽기 — **두 표에 하나씩**(server #762).
 *
 * - 왼쪽: `GET /logistics/purchase-orders` — P/O 묶음. 묶음 값(라인 수·합계·진행)과 납기·지연·공급사 검색 조건
 * - 오른쪽: `GET /logistics/purchase-order-lines?purchaseOrderId=` — 고른 P/O 의 라인. 이름 칸이 함께 온다
 *
 * **쓰기 오퍼레이션이 없다.** 입하 등록은 `receive-queries.ts`(라인 표에서 바로 받는 입하)가 한다.
 */

/** 한 P/O 의 라인을 한 번에 받는다 — 서버 상한. 이보다 많은 라인의 발주는 아직 보지 못했다. */
export const LINES_PAGE_SIZE = 200;

export const scheduleKeys = {
  all: ['inbound-schedule'] as const,
  orders: (query: PurchaseOrderSummaryQuery | null) =>
    ['inbound-schedule', 'orders', query] as const,
  lines: (purchaseOrderId: number | null) =>
    ['inbound-schedule', 'lines', purchaseOrderId] as const,
};

/**
 * 왼쪽 P/O 묶음 목록.
 *
 * **조건이 하나도 없어도 조회한다** — 들어오자마자 「들어올 것」이 납기 순으로 보여야 한다.
 * `null`은 **보내면 반드시 400이 되는 기간**에서만 온다(없는 날짜·뒤집힌 기간).
 */
export const usePurchaseOrderSummaries = (
  query: PurchaseOrderSummaryQuery | null,
): UseQueryResult<PurchaseOrderSummaryListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: scheduleKeys.orders(query),
    enabled: query !== null,
    queryFn: () => {
      if (query === null) {
        throw new Error('보낼 수 없는 기간에서는 목록을 조회하지 않습니다.');
      }

      return runRequest<PurchaseOrderSummaryListResult>(() =>
        client.GET('/logistics/purchase-orders', { params: { query } }),
      );
    },
  });
};

/** 오른쪽 라인 목록. 고르기 전에는 부르지 않는다. */
export const usePurchaseOrderLines = (
  purchaseOrderId: number | null,
): UseQueryResult<InboundScheduleListResult> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: scheduleKeys.lines(purchaseOrderId),
    enabled: purchaseOrderId !== null,
    queryFn: () => {
      if (purchaseOrderId === null) {
        throw new Error('발주를 고르기 전에는 라인을 조회하지 않습니다.');
      }

      /* 서버 기본이 미완료만이라 `openOnly=false` 를 늘 싣는다 — 고른 발주의 라인은 다 들어온 것까지 다 보여야 한다. */
      return runRequest(() =>
        client.GET('/logistics/purchase-order-lines', {
          params: { query: { purchaseOrderId, openOnly: false, size: LINES_PAGE_SIZE } },
        }),
      );
    },
  });
};
