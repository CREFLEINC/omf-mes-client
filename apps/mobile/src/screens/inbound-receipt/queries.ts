import type {
  ApiClient,
  InboundLot,
  InboundLotClosed,
  InboundLotDetail,
  InboundLotReceiveResult,
} from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { useQueries, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { toReceiveBody } from './receipt';

/**
 * M-01-01 의 읽기 · 쓰기(계약 §2·§3). 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로
 * 요구한다.
 */

type Client = ApiClient['client'];

export const inboundLotKeys = {
  all: ['inbound-receipt', 'inbound-lot'] as const,
  detail: (inboundLotId: number) => ['inbound-receipt', 'inbound-lot', inboundLotId] as const,
};

/** 카드마다 입하 LOT 상세 — 자재 관리 LOT 목록 · 상태 · 판(versionNo). */
export const useInboundLotDetails = (
  ids: readonly number[],
): ReadonlyMap<number, UseQueryResult<InboundLotDetail>> => {
  const { client } = useApiClient();
  const results = useQueries({
    queries: ids.map((inboundLotId) => ({
      queryKey: inboundLotKeys.detail(inboundLotId),
      queryFn: () =>
        runRequest(() =>
          client.GET('/logistics/inbound-lots/{inboundLotId}', {
            params: { path: { inboundLotId } },
          }),
        ),
    })),
  });

  return new Map(
    ids.flatMap((id, index) => {
      const result = results[index];

      return result === undefined ? [] : [[id, result] as const];
    }),
  );
};

const headers = (idempotencyKey: string, workerNo: string) => ({
  'Idempotency-Key': idempotencyKey,
  'X-Worker-No': workerNo,
});

/** 스캔 한 건 받기 — 키는 부르는 쪽이 만든다(실패하면 같은 키로 아웃박스에 담는다). */
export const receiveLot = (
  client: Client,
  lotNo: string,
  now: Date,
  idempotencyKey: string,
  workerNo: string,
): Promise<InboundLotReceiveResult> =>
  runRequest(() =>
    client.POST('/logistics/inbound-lots:receive', {
      params: { header: headers(idempotencyKey, workerNo) },
      body: toReceiveBody(lotNo, now),
    }),
  );

export const unregisterLots = (
  client: Client,
  inboundLotId: number,
  lotIds: number[],
  versionNo: number,
  workerNo: string,
): Promise<InboundLot> =>
  runRequest(() =>
    client.POST('/logistics/inbound-lots/{inboundLotId}:unregister-lots', {
      params: { path: { inboundLotId }, header: headers(createIdempotencyKey(), workerNo) },
      body: { lotIds, versionNo },
    }),
  );

export const closeReceipt = (
  client: Client,
  inboundLotId: number,
  versionNo: number,
  workerNo: string,
): Promise<InboundLotClosed> =>
  runRequest(() =>
    client.POST('/logistics/inbound-lots/{inboundLotId}:close-receipt', {
      params: { path: { inboundLotId }, header: headers(createIdempotencyKey(), workerNo) },
      body: { versionNo, occurredAt: new Date().toISOString() },
    }),
  );

export const saveSupplierLotNo = (
  client: Client,
  inboundLotId: number,
  lotIds: number[],
  supplierLotNo: string | null,
  workerNo: string,
) =>
  runRequest(() =>
    client.PATCH('/logistics/inbound-lots/{inboundLotId}/lots/supplier-lot-no', {
      params: { path: { inboundLotId }, header: headers(createIdempotencyKey(), workerNo) },
      body: { lotIds, supplierLotNo },
    }),
  );
