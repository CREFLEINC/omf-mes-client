import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import type { components } from '@omf-mes/api-client';

import { useApiClient } from '../../patterns/api-context';
import type { Lot } from '../../patterns/lots';
import { runRequest } from '../../patterns/request';
import {
  toPickBody,
  type Candidate,
  type ShipmentRequest,
  type ShipmentRequestLine,
} from './picking';

export type LotHold = components['schemas']['LotHold'];

/**
 * 한 쪽으로 받을 최대 줄 수.
 *
 * ⛔ **이 값을 안 실으면 서버 기본 쪽수로 잘린다.** 잔액은 이제 수량을 채우는 데만 쓰이지
 * 않고 «후보가 서느냐»를 정하므로, 잘린 줄의 LOT 은 목록에서 통째로 사라진다. 형제 화면들이
 * 같은 이유로 같은 값을 쓴다(자재 반품·폐기 출고).
 */
const PAGE_SIZE = 200;

export const pickingKeys = {
  requests: (day: string) => ['picking-requests', day] as const,
  lots: (itemId: number | null) => ['picking-lots', itemId] as const,
  held: (itemId: number | null) => ['picking-held', itemId] as const,
  holdReason: (lotId: number | null) => ['picking-hold-reason', lotId] as const,
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
  /** 한 쪽에 다 담기지 않았다. 화면이 「전부 보고 있지는 않다」고 말해야 한다. */
  truncated: boolean;
}

export interface LotPoolResult {
  data: LotPool | undefined;
  isPending: boolean;
  isError: boolean;
  /** 실패했으면 그 까닭. 연결이 끊긴 것과 서버가 거절한 것은 할 일이 다르다. */
  error: Error | null;
}

export const useLotPool = (itemId: number | null): LotPoolResult => {
  const { client } = useApiClient();

  const askLots = async (heldOnly: boolean): Promise<{ items: Lot[]; truncated: boolean }> => {
    if (itemId === null) {
      throw new Error('대상을 고르기 전에는 LOT을 조회하지 않습니다.');
    }

    /*
     * LOT 유형으로 거르지 않는다. 「제품 LOT」은 따로 발번하는 번호가 아니라 완제품 창고에
     * 선 생산 LOT 을 부르는 이름이다(경계 B6-01 갈래 ⓐ · omf-all-around#50). 유형을
     * `PRODUCT` 로 걸면 그 값으로 만들어지는 LOT 이 없어 후보가 영영 0건이다.
     *
     * 좁히는 축은 출하 요청 라인의 품목이고, 공정 중 LOT 을 거르는 몫은 재고 잔액이
     * 맡는다(`toCandidates`).
     */
    /*
     * ⭐ `completed: true` 로 **생산이 끝난 LOT 만** 받는다. 유형 축을 걷어낸 자리를 이 축이
     *    메운다 - 계약이 「completedAt 이 비어 있는 것만/값이 있는 것만」으로 갈라 준다고
     *    못박았다. 공정 중 LOT 을 서버에서 거르므로 화면이 잔액만으로 판정하지 않는다.
     */
    const query = { itemId, completed: true, size: PAGE_SIZE };
    const data = await runRequest(() =>
      client.GET('/trace/lots', {
        params: { query: heldOnly ? { ...query, heldOnly: true } : query },
      }),
    );

    return { items: data.items, truncated: data.page.total > data.items.length };
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
      error: all.error ?? held.error,
      data:
        all.data === undefined || held.data === undefined
          ? undefined
          : {
              lots: all.data.items,
              heldLotIds: new Set(held.data.items.map((lot) => lot.lotId)),
              truncated: all.data.truncated || held.data.truncated,
            },
    }),
  });
};

/** LOT 별 가용 수량. 서버가 계산해 내려주며 화면이 다시 빼지 않는다. */
export interface AvailableByLot {
  byLot: Map<number, number>;
  /** 한 쪽에 다 담기지 않았다 — 잘린 줄의 LOT 은 후보에서 조용히 빠진다. */
  truncated: boolean;
}

export const useAvailableByLot = (itemId: number | null): UseQueryResult<AvailableByLot> => {
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
          /*
           * ⛔ `size` 를 빼면 서버 기본 쪽수로 잘린다 — 잘린 LOT 은 후보에 서지 못한다.
           * ⛔ `includeZero` 는 싣지 않는다 — 가용 0 은 후보가 아니라(`toCandidates`) 0 인 줄을
           *    받아도 집합이 달라지지 않는데, 쪽 예산만 먹어 «집을 수 있는» 줄을 쪽 밖으로
           *    밀어낸다. 밀려난 LOT 은 조용히 사라진다.
           */
          params: { query: { itemId, groupBy: 'LOT', size: PAGE_SIZE } },
        }),
      );

      const byLot = new Map<number, number>();

      for (const balance of data.items) {
        if (balance.lotId === null || balance.lotId === undefined) {
          continue;
        }

        byLot.set(balance.lotId, (byLot.get(balance.lotId) ?? 0) + balance.availableQty);
      }

      return { byLot, truncated: data.page.total > data.items.length };
    },
  });
};

/**
 * 화면이 고르는 데 필요한 것을 LOT 하나로 모은다.
 *
 * 좁히는 축은 둘이다. **생산 완료**는 서버가 본다(`completed: true`) - 공정 중 LOT 은 아예
 * 오지 않는다. 그 위에 **가용 수량이 남은 LOT 만** 남긴다.
 *
 * ⭐ **가용 0 은 보이지 않는다**(사용자 결정 2026-09-21 · omf-all-around#50). 집을 수 없는 줄을
 *   보여 주면 작업자가 그것부터 집으려다 막힌다 - 「재고가 사라진 것처럼 보인다」보다 그쪽이
 *   현장에서 더 나쁘다. ⛔ 「잔액 줄이 있는가」가 아니라 「집을 것이 남았는가」로 가른다.
 *
 * ⚠ 잔액 줄이 선다는 것이 「창고에 있다」와 같은 뜻인지는 **실서버에서 확인하지 않았다** -
 *   현장 위치 재고도 잔액에 줄로 서는 화면이 있다(`shopfloor-receipt`). 그래서 이 축 «하나»에
 *   기대지 않고 완료 축을 서버에 함께 건다. 창고로 바로 좁히지는 못한다 - 계약의 LOT 목록에
 *   창고 축이 없고 출하 요청도 창고를 들고 있지 않다(omf-all-around#50).
 */
export const toCandidates = (pool: LotPool, available: Map<number, number>): Candidate[] =>
  pool.lots
    .filter((lot) => (available.get(lot.lotId) ?? 0) > 0)
    .map((lot) => ({
      lot,
      availableQty: available.get(lot.lotId) ?? 0,
      held: pool.heldLotIds.has(lot.lotId),
    }));

export interface PickVariables {
  /*
   * 화면이 들고 있는 키. 여기서 만들면 재시도마다 값이 달라져 멱등키가 아무것도 막지 못한다.
   */
  idempotencyKey: string;
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
    mutationFn: ({
      shipmentRequestId,
      line,
      candidate,
      qty,
      workerNo,
      idempotencyKey,
    }: PickVariables) =>
      runRequest(() =>
        client.POST(
          '/logistics/shipment-requests/{shipmentRequestId}/lines/{shipmentRequestLineId}:pick',
          {
            params: {
              path: { shipmentRequestId, shipmentRequestLineId: line.shipmentRequestLineId },
              header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
            },
            body: toPickBody(candidate, line, qty),
          },
        ),
      ),
    onSuccess: (picked, { shipmentRequestId }) => {
      /*
       * 서버가 돌려준 라인을 캐시에 곧바로 써 넣는다. 다시 조회해 오는 것에만 기대면, 그 조회가
       * 실패했을 때 화면이 확정 전 값을 그대로 들고 있게 된다 - 배정을 다 채웠는데도 남은 배정이
       * 남아 보여 한 번 더 집는다. 무효화는 나머지 값을 맞추기 위해 그대로 둔다.
       */
      queries.setQueriesData<ShipmentRequest[]>({ queryKey: ['picking-requests'] }, (current) =>
        current?.map((request) =>
          request.shipmentRequestId === shipmentRequestId
            ? {
                ...request,
                lines: request.lines?.map((line) =>
                  line.shipmentRequestLineId === picked.shipmentRequestLineId ? picked : line,
                ),
              }
            : request,
        ),
      );

      void queries.invalidateQueries({ queryKey: ['picking-requests'] });
      void queries.invalidateQueries({ queryKey: ['picking-balances'] });
    },
  });
};

/**
 * 고른 LOT 의 보류 사유.
 *
 * 화면이 집을 수 없다고만 말하고 왜인지 말하지 않아 스펙(M-04-01 §6)을 못 지키고 있었다.
 * 후보 목록에는 보류 여부만 오고 사유는 오지 않아 고른 것 하나만 따로 묻는다.
 *
 * 이 호출은 여기 한 자리에만 둔다 - 목록이 사유를 함께 내리는 쪽으로 계약이 정해지면
 * 통째로 걷어낸다.
 */
export const useHoldReason = (lotId: number | null): UseQueryResult<LotHold[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: pickingKeys.holdReason(lotId),
    enabled: lotId !== null,
    queryFn: async () => {
      if (lotId === null) {
        throw new Error('LOT 을 고르기 전에는 보류 사유를 묻지 않습니다.');
      }

      /* 해제된 보류까지 오면 이미 풀린 사유를 지금 것으로 보인다. */
      const data = await runRequest(() =>
        client.GET('/trace/lots/{lotId}/holds', {
          params: { path: { lotId }, query: { activeOnly: true } },
        }),
      );

      return data.items;
    },
  });
};
