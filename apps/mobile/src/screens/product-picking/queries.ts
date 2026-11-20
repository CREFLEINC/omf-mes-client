import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { findLot } from '../../patterns/lots';
import { runRequest } from '../../patterns/request';
import {
  chooseLine,
  onlyOutOfScope,
  type ShipmentLotPickResult,
  type ShipmentLotReplaceResult,
  type ShipmentRequest,
  type ShipmentRequestLine,
  type ShipmentRequestLot,
} from './picking';

export const pickingKeys = {
  requests: (day: string) => ['picking-requests', day] as const,
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
 * 오늘 출하 지시서.
 *
 * 출하 완료된 지시서(`completedShipment`)는 세우지 않는다 — 더 집을 일이 없고, 코드를 고칠 길도
 * 없다(출하 완료 뒤 수정은 범위 밖). 상태 코드로는 거르지 않는다 — 값 목록이 확정 전이다.
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

      return data.items.filter((request) => request.completedShipment === null);
    },
  });
};

/** 서버가 돌려준 라인을 캐시에 곧바로 써 넣는다 — 다시 조회가 실패해도 화면이 옛 값에 머물지 않는다. */
const writeLine = (
  queries: QueryClient,
  shipmentRequestId: number,
  next: ShipmentRequestLine,
): void => {
  queries.setQueriesData<ShipmentRequest[]>({ queryKey: ['picking-requests'] }, (current) =>
    current?.map((request) =>
      request.shipmentRequestId === shipmentRequestId
        ? {
            ...request,
            lines: request.lines?.map((line) =>
              line.shipmentRequestLineId === next.shipmentRequestLineId ? next : line,
            ),
          }
        : request,
    ),
  );
  void queries.invalidateQueries({ queryKey: ['picking-requests'] });
};

/** 화면이 보내기 전에 가른 거절 — 서버에 묻지 않는다. */
export class LocalPickRejection extends Error {
  /** `outOfScope` — 그 품목 줄이 다른 공장 · 창고 줄뿐이다(피처 012 FR-010). */
  readonly reason: 'notFound' | 'noLine' | 'outOfScope';

  constructor(reason: 'notFound' | 'noLine' | 'outOfScope') {
    super(reason);
    this.name = 'LocalPickRejection';
    this.reason = reason;
  }
}

/** 서버가 물린 피킹 — 화면이 「라인 n 은 목표 … 」를 말하려면 보낸 라인이 필요하다. */
export class PickLineError extends Error {
  readonly line: ShipmentRequestLine;

  constructor(cause: unknown, line: ShipmentRequestLine) {
    super('pick-lot refused', { cause });
    this.name = 'PickLineError';
    this.line = line;
  }
}

export interface PickVariables {
  idempotencyKey: string;
  request: ShipmentRequest;
  lotNo: string;
  workerNo: string;
}

/**
 * LOT 통째 피킹(`:pick-lot`).
 *
 * 경로가 라인을 받으므로 스캔한 LOT 의 품목으로 라인을 먼저 고른다(`chooseLine`). 그 LOT 을
 * 이 공장에서 찾지 못하거나 그 품목 라인이 없으면 보내지 않는다. 수량은 싣지 않는다 — 서버가
 * 그 LOT 의 공장 안 가용 전부를 집는다.
 *
 * 큐에 담지 않는다 - LOT 상태와 검사 판정을 캐시할 수 없어 이 화면은 연결이 있는 동안에만 돈다.
 */
export const usePickLot = (): UseMutationResult<ShipmentLotPickResult, Error, PickVariables> => {
  const { client } = useApiClient();
  const queries = useQueryClient();

  return useMutation({
    mutationFn: async ({ request, lotNo, workerNo, idempotencyKey }: PickVariables) => {
      const lot = await findLot(client, lotNo);

      if (lot === null) {
        throw new LocalPickRejection('notFound');
      }

      const line = chooseLine(request.lines ?? [], lot.itemId);

      if (line === null) {
        throw new LocalPickRejection(
          onlyOutOfScope(request.lines ?? [], lot.itemId) ? 'outOfScope' : 'noLine',
        );
      }

      return runRequest(() =>
        client.POST(
          '/logistics/shipment-requests/{shipmentRequestId}/lines/{shipmentRequestLineId}:pick-lot',
          {
            params: {
              path: {
                shipmentRequestId: request.shipmentRequestId,
                shipmentRequestLineId: line.shipmentRequestLineId,
              },
              header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
            },
            body: { lotNo },
          },
        ),
      ).catch((error: unknown) => {
        throw new PickLineError(error, line);
      });
    },
    onSuccess: (result, { request }) => {
      writeLine(queries, request.shipmentRequestId, result.line);
    },
  });
};

export interface ReplaceVariables {
  idempotencyKey: string;
  shipmentRequestId: number;
  lot: ShipmentRequestLot;
  workerNo: string;
}

/** 불합격 LOT 교체(`:replace`) — 예약 해제 · LOT 불량 · 부적합 1건이 한 번에 일어난다. */
export const useReplaceLot = (): UseMutationResult<
  ShipmentLotReplaceResult,
  Error,
  ReplaceVariables
> => {
  const { client } = useApiClient();
  const queries = useQueryClient();

  return useMutation({
    mutationFn: ({ lot, workerNo, idempotencyKey }: ReplaceVariables) =>
      runRequest(() =>
        client.POST('/logistics/shipment-request-lots/{shipmentRequestLotId}:replace', {
          params: {
            path: { shipmentRequestLotId: lot.shipmentRequestLotId },
            header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
          },
        }),
      ),
    onSuccess: (result, { shipmentRequestId }) => {
      writeLine(queries, shipmentRequestId, result.line);
    },
    /* 물렸으면(재검 합격이 먼저 들어옴) 화면이 옛 판정을 들고 있다. 다시 받는다. */
    onError: () => {
      void queries.invalidateQueries({ queryKey: ['picking-requests'] });
    },
  });
};

export interface CodeVariables {
  idempotencyKey: string;
  lot: ShipmentRequestLot;
  /** 빈 글자는 지운다(null). */
  managementCode: string;
  workerNo: string;
}

/** 출하 관리 코드 저장(`PUT …/management-code`) — 피킹 상태일 때만 된다. */
export const useSaveManagementCode = (): UseMutationResult<
  ShipmentRequestLot,
  Error,
  CodeVariables
> => {
  const { client } = useApiClient();
  const queries = useQueryClient();

  return useMutation({
    mutationFn: ({ lot, managementCode, workerNo, idempotencyKey }: CodeVariables) => {
      const trimmed = managementCode.trim();

      return runRequest(() =>
        client.PUT('/logistics/shipment-request-lots/{shipmentRequestLotId}/management-code', {
          params: {
            path: { shipmentRequestLotId: lot.shipmentRequestLotId },
            header: { 'Idempotency-Key': idempotencyKey, 'X-Worker-No': workerNo },
          },
          body: { managementCode: trimmed === '' ? null : trimmed },
        }),
      );
    },
    onSuccess: (saved) => {
      queries.setQueriesData<ShipmentRequest[]>({ queryKey: ['picking-requests'] }, (current) =>
        current?.map((request) => ({
          ...request,
          lines: request.lines?.map((line) => ({
            ...line,
            lots: line.lots.map((each) =>
              each.shipmentRequestLotId === saved.shipmentRequestLotId ? saved : each,
            ),
          })),
        })),
      );
    },
  });
};
