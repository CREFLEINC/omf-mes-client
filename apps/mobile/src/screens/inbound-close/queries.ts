import type { InboundLot, InboundLotClosed, InboundLotDetail } from '@omf-mes/api-client';
import { createIdempotencyKey } from '@omf-mes/api-client';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

/**
 * M-01-03 의 읽기 · 쓰기(계약 §2·§3). 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch` 가 경로를 리터럴 타입으로
 * 요구한다.
 */
export const inboundCloseKeys = {
  all: ['inbound-close'] as const,
  closable: (plantId: number | null) => ['inbound-close', 'closable', plantId] as const,
  reopenable: (plantId: number | null) => ['inbound-close', 'reopenable', plantId] as const,
  detail: (id: number | null) => ['inbound-close', 'detail', id] as const,
};

/** 한 쪽에 받는 건수 — 공장 하나의 입하 중 · 마감 취소 가능 건은 이보다 적다. */
const PAGE_SIZE = 100;

const listOf = async (
  client: Client,
  plantId: number,
  condition: { closable: true } | { reopenable: true },
): Promise<InboundLot[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-lots', {
      params: { query: { plantId, ...condition, size: PAGE_SIZE } },
    }),
  );

  return data.items;
};

/** 입하 중(마감 대상) — `closable=true`. */
export const useClosableLots = (plantId: number | null): UseQueryResult<InboundLot[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inboundCloseKeys.closable(plantId),
    enabled: plantId !== null,
    queryFn: () => listOf(client, plantId ?? 0, { closable: true }),
  });
};

/** 입하 완료 · 마감 취소 가능 — `reopenable=true`. */
export const useReopenableLots = (plantId: number | null): UseQueryResult<InboundLot[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inboundCloseKeys.reopenable(plantId),
    enabled: plantId !== null,
    queryFn: () => listOf(client, plantId ?? 0, { reopenable: true }),
  });
};

/** 입하 LOT 상세 — 자재 관리 LOT 목록. */
export const useInboundLotDetail = (
  inboundLotId: number | null,
): UseQueryResult<InboundLotDetail> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: inboundCloseKeys.detail(inboundLotId),
    enabled: inboundLotId !== null,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/inbound-lots/{inboundLotId}', {
          params: { path: { inboundLotId: inboundLotId ?? 0 } },
        }),
      ),
  });
};

const headers = (workerNo: string) => ({
  'Idempotency-Key': createIdempotencyKey(),
  'X-Worker-No': workerNo,
});

/** 등록 해제(계약 §3) — 마지막 LOT 면 입하 LOT 가 `VOIDED` 로 온다. */
export const unregisterLots = (
  client: Client,
  inboundLotId: number,
  body: { lotIds: number[]; versionNo: number },
  workerNo: string,
): Promise<InboundLot> =>
  runRequest(() =>
    client.POST('/logistics/inbound-lots/{inboundLotId}:unregister-lots', {
      params: { path: { inboundLotId }, header: headers(workerNo) },
      body,
    }),
  );

/** 입하 마감(계약 §3) — 부분 입하 사유는 없다. */
export const closeReceipt = (
  client: Client,
  inboundLotId: number,
  versionNo: number,
  workerNo: string,
  now: Date = new Date(),
): Promise<InboundLotClosed> =>
  runRequest(() =>
    client.POST('/logistics/inbound-lots/{inboundLotId}:close-receipt', {
      params: { path: { inboundLotId }, header: headers(workerNo) },
      body: { versionNo, occurredAt: now.toISOString() },
    }),
  );

/** 마감 취소(계약 §3) — 사유 칸은 시안에 없어 싣지 않는다(선택). */
export const reopenReceipt = (
  client: Client,
  inboundLotId: number,
  versionNo: number,
  workerNo: string,
): Promise<InboundLot> =>
  runRequest(() =>
    client.POST('/logistics/inbound-lots/{inboundLotId}:reopen-receipt', {
      params: { path: { inboundLotId }, header: headers(workerNo) },
      body: { versionNo },
    }),
  );
