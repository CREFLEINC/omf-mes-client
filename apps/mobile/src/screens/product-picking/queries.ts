import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import type { Lot } from '../../patterns/lots';
import { createIdempotencyKey } from '../../patterns/outbox';
import { runRequest } from '../../patterns/request';
import { toPickBody, type Candidate, type ShipmentRequest, type ShipmentRequestLine } from './picking';

export const pickingKeys = {
  requests: (day: string) => ['picking-requests', day] as const,
  lots: (itemId: number | null) => ['picking-lots', itemId] as const,
  held: (itemId: number | null) => ['picking-held', itemId] as const,
  balances: (itemId: number | null) => ['picking-balances', itemId] as const,
};

/**
 * 오늘 하루.
 *
 * 계약이 이 축을 날짜로 받는다 - 시각까지 실으면 서버가 요청 자체를 물리고 목록이 영영
 * 뜨지 않는다. 날짜 축이라 두 끝을 같은 날로 두면 그날 하루가 된다.
 */
export const shipDay = (today: Date): { from: string; to: string } => {
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${String(today.getFullYear())}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return { from: day, to: day };
};

/**
 * 오늘 출하분 작업지시.
 *
 * 계약이 기간을 비울 수 없게 해 두었고 이 화면의 대상은 오늘 하루다. 상태 코드로 거르지
 * 않는다 - 값 목록이 확정 전이라 지어내 실으면 값이 달라지는 날 목록이 조용히 빈다.
 */
export const useTodayRequests = (today: Date): UseQueryResult<ShipmentRequest[]> => {
  const { client } = useApiClient();
  const day = shipDay(today);

  return useQuery({
    queryKey: pickingKeys.requests(day.from),
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/logistics/shipment-requests', {
          params: { query: { shipDateFrom: day.from, shipDateTo: day.to } },
        }),
      );

      return data.items;
    },
  });
};

/**
 * 이 품목의 LOT 과 그중 보류가 걸린 것.
 *
 * 보류 여부가 LOT 응답에 없어 보류만 따로 한 번 더 묻는다. 줄마다 되짚으면 목록 길이만큼
 * 부르게 되므로 두 번으로 끝낸다.
 */
export interface LotPool {
  lots: Lot[];
  heldLotIds: Set<number>;
}

export interface LotPoolResult {
  data: LotPool | undefined;
  isPending: boolean;
  isError: boolean;
}

export const useLotPool = (itemId: number | null): LotPoolResult => {
  const { client } = useApiClient();

  const askLots = async (heldOnly: boolean): Promise<Lot[]> => {
    if (itemId === null) {
      throw new Error('대상을 고르기 전에는 LOT을 조회하지 않습니다.');
    }

    const data = await runRequest(() =>
      client.GET('/trace/lots', {
        params: { query: heldOnly ? { itemId, heldOnly: true, size: 200 } : { itemId, size: 200 } },
      }),
    );

    return data.items;
  };

  return useQueries({
    queries: [
      {
        queryKey: pickingKeys.lots(itemId),
        enabled: itemId !== null,
        queryFn: () => askLots(false),
      },
      {
        queryKey: pickingKeys.held(itemId),
        enabled: itemId !== null,
        queryFn: () => askLots(true),
      },
    ],
    combine: ([all, held]) => ({
      isPending: all.isPending || held.isPending,
      isError: all.isError || held.isError,
      data:
        all.data === undefined || held.data === undefined
          ? undefined
          : { lots: all.data, heldLotIds: new Set(held.data.map((lot) => lot.lotId)) },
    }),
  });
};

/** LOT 별 가용 수량. 서버가 계산해 내려주며 화면이 다시 빼지 않는다. */
export const useAvailableByLot = (itemId: number | null): UseQueryResult<Map<number, number>> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pickingKeys.balances(itemId),
    enabled: itemId !== null,
    queryFn: async () => {
      if (itemId === null) {
        throw new Error('대상을 고르기 전에는 잔액을 조회하지 않습니다.');
      }

      const data = await runRequest(() =>
        client.GET('/inventory/balances', {
          params: { query: { itemId, groupBy: 'LOT', includeZero: true } },
        }),
      );

      const byLot = new Map<number, number>();

      for (const balance of data.items) {
        if (balance.lotId === null || balance.lotId === undefined) {
          continue;
        }

        byLot.set(balance.lotId, (byLot.get(balance.lotId) ?? 0) + balance.availableQty);
      }

      return byLot;
    },
  });
};

/** 화면이 고르는 데 필요한 것을 LOT 하나로 모은다. */
export const toCandidates = (pool: LotPool, available: Map<number, number>): Candidate[] =>
  pool.lots.map((lot) => ({
    lot,
    availableQty: available.get(lot.lotId) ?? 0,
    held: pool.heldLotIds.has(lot.lotId),
  }));

export interface PickVariables {
  shipmentRequestId: number;
  line: ShipmentRequestLine;
  candidate: Candidate;
  qty: string;
  workerNo: string;
}

/**
 * 피킹을 확정한다.
 *
 * 큐에 담지 않는다 - 보류 판정을 캐시할 수 없어 이 화면은 연결이 있는 동안에만 돈다.
 * 예약은 화면이 걸지 않는다. 서버가 이 피킹의 결과로 건다.
 */
export const usePickLine = (): UseMutationResult<ShipmentRequestLine, Error, PickVariables> => {
  const { client } = useApiClient();
  const queries = useQueryClient();

  return useMutation({
    mutationFn: ({ shipmentRequestId, line, candidate, qty, workerNo }: PickVariables) =>
      runRequest(() =>
        client.POST(
          '/logistics/shipment-requests/{shipmentRequestId}/lines/{shipmentRequestLineId}:pick',
          {
            params: {
              path: { shipmentRequestId, shipmentRequestLineId: line.shipmentRequestLineId },
              header: { 'Idempotency-Key': createIdempotencyKey(), 'X-Worker-No': workerNo },
            },
            body: toPickBody(candidate, line, qty),
          },
        ),
      ),
    onSuccess: () => {
      void queries.invalidateQueries({ queryKey: ['picking-requests'] });
      void queries.invalidateQueries({ queryKey: ['picking-balances'] });
    },
  });
};
