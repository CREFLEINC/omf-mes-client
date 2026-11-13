import {
  createIdempotencyKey,
  type InboundLotSplitPreview,
  type InboundLotSplitResult,
  type InspectionRequestEventForward,
  type InspectionRequestForward,
} from '@omf-mes/api-client';
import { useQueries, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { INSPECTION_HUB_COUNTS_KEY } from '../../patterns/inspection-hub-counts';
import { runRequest } from '../../patterns/request';

/**
 * W-01-01 새 흐름(대상 = 입하 LOT) IQC 의 읽기 · 쓰기(005 · 계약 §8 · §3 분리 · screens/W-01-01.md).
 * OA(`iqc-inspection/`) · 부품(`parts-iqc-inspection/`) 두 변형이 함께 쓴다. 경로 리터럴은 이 파일에만 둔다.
 *
 * ⭐ 이전된 옛 IQC(대상 LOT)는 이 파일을 쓰지 않는다 — 지금 상세 · 회차 · 결과 단위 확정 그대로(FR-051 · R18-1).
 */

type Client = ReturnType<typeof useApiClient>['client'];

/** 입하 LOT 단위 상세 — 상세 응답 그대로(계약 §8). */
export type InboundInspection = InspectionRequestForward;

const ROOT = ['iqc-inbound-lot'] as const;

export const iqcInboundKeys = {
  all: ROOT,
  detail: (inspectionRequestId: number) => [...ROOT, 'detail', inspectionRequestId] as const,
  events: (inspectionRequestId: number) => [...ROOT, 'events', inspectionRequestId] as const,
  splitPreview: (inboundLotId: number, lotIds: readonly number[]) =>
    [...ROOT, 'split-preview', inboundLotId, [...lotIds].sort((a, b) => a - b)] as const,
};

/**
 * 저장 · 확정 · 분리 뒤 다시 읽을 것 — 이 상세, 두 변형의 대기열, 옛 상세 캐시, 검사 허브 숫자.
 * 대기열 열쇠는 각 화면의 앞머리(`iqc-inspection` · `parts-iqc-inspection`)다.
 */
export const INBOUND_INVALIDATE: readonly (readonly unknown[])[] = [
  ROOT,
  ['iqc-inspection'],
  ['parts-iqc-inspection'],
  INSPECTION_HUB_COUNTS_KEY,
];

export const fetchInboundInspection = (
  client: Client,
  inspectionRequestId: number,
): Promise<InboundInspection> =>
  runRequest(() =>
    client.GET('/quality/inspection-requests/{inspectionRequestId}', {
      params: { path: { inspectionRequestId } },
    }),
  );

/** 입하 LOT 단위 상세 — 처분 · 확정이 다른 화면에서 바뀌므로 늘 다시 읽는다. */
export const useInboundInspection = (
  inspectionRequestId: number | null,
): UseQueryResult<InboundInspection> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcInboundKeys.detail(inspectionRequestId ?? 0),
    queryFn: () => fetchInboundInspection(client, inspectionRequestId as number),
    enabled: inspectionRequestId !== null,
    staleTime: 0,
  });
};

/** 변경 이력 — 의뢰 이벤트(계약 §8 「이벤트를 함께」). */
/** 변경 이력의 분리 줄이 가리키는 입하 LOT — 번호와 자재 관리 LOT 번호(T139). */
export interface InboundLotRef {
  inboundLotNo: string;
  lotNoOf: ReadonlyMap<number, string>;
}

/**
 * 분리 이벤트 요약(`summaryAfter`)은 상대 입하 LOT 을 id 로만 싣는다 — 번호 · 옮긴 자재 관리 LOT 번호를 보이려고 상세를 읽는다.
 * 못 읽은 id 는 맵에 없다(줄은 개수로 보인다).
 */
export const useInboundLotRefs = (
  inboundLotIds: readonly number[],
): ReadonlyMap<number, InboundLotRef> => {
  const { client } = useApiClient();
  const ids = [...new Set(inboundLotIds)];
  const results = useQueries({
    queries: ids.map((inboundLotId) => ({
      queryKey: [...ROOT, 'inbound-lot-ref', inboundLotId] as const,
      staleTime: 60_000,
      queryFn: () =>
        runRequest(() =>
          client.GET('/logistics/inbound-lots/{inboundLotId}', {
            params: { path: { inboundLotId } },
          }),
        ),
    })),
  });
  const refs = new Map<number, InboundLotRef>();
  results.forEach((result, index) => {
    const id = ids[index];
    if (result.data === undefined || id === undefined) return;
    refs.set(id, {
      inboundLotNo: result.data.inboundLotNo,
      lotNoOf: new Map(result.data.lots.map((lot) => [lot.lotId, lot.lotNo])),
    });
  });
  return refs;
};

export const useInspectionEvents = (
  inspectionRequestId: number | null,
): UseQueryResult<InspectionRequestEventForward[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcInboundKeys.events(inspectionRequestId ?? 0),
    enabled: inspectionRequestId !== null,
    staleTime: 0,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/quality/inspection-requests/{inspectionRequestId}/history', {
          params: { path: { inspectionRequestId: inspectionRequestId as number } },
        }),
      );

      return [...(data.requestEvents ?? [])].sort((a, b) =>
        b.occurredAt.localeCompare(a.occurredAt),
      );
    },
  });
};

/** 결과 지우기(계약 §8) — 확정 전 · DRAFT 만. */
export const deleteInspectionResult = (
  client: Client,
  inspectionResultId: number,
  versionNo: number,
): Promise<void> =>
  runRequest(() =>
    client.DELETE('/quality/inspection-results/{inspectionResultId}', {
      params: {
        path: { inspectionResultId },
        header: { 'If-Match': String(versionNo), 'Idempotency-Key': createIdempotencyKey() },
      },
    }),
  ).then(() => undefined);

/** 판정 확정(계약 §8) — 권한 W-01-15. */
export const confirmInspection = (
  client: Client,
  inspectionRequestId: number,
  versionNo: number,
): Promise<InboundInspection & { nonconformanceId?: number | null }> =>
  runRequest(() =>
    client.POST('/quality/inspection-requests/{inspectionRequestId}:confirm', {
      params: {
        path: { inspectionRequestId },
        header: { 'Idempotency-Key': createIdempotencyKey() },
      },
      body: { versionNo },
    }),
  );

/** 판정 확정 취소(계약 §8) — 권한 W-01-15. 409 막힘은 `errors[].code`. */
export const cancelConfirmInspection = (
  client: Client,
  inspectionRequestId: number,
  versionNo: number,
  reason: string | null,
): Promise<InboundInspection> =>
  runRequest(() =>
    client.POST('/quality/inspection-requests/{inspectionRequestId}:cancel-confirm', {
      params: {
        path: { inspectionRequestId },
        header: { 'Idempotency-Key': createIdempotencyKey() },
      },
      body: {
        versionNo,
        ...(reason === null || reason.trim() === '' ? {} : { reason: reason.trim() }),
      },
    }),
  );

/** 분리 미리 보기(계약 §3) — 고른 LOT 이 없으면 부르지 않는다. */
export const useSplitPreview = (
  inboundLotId: number | null,
  lotIds: readonly number[],
): UseQueryResult<InboundLotSplitPreview> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: iqcInboundKeys.splitPreview(inboundLotId ?? 0, lotIds),
    enabled: inboundLotId !== null && lotIds.length > 0,
    queryFn: () =>
      runRequest(() =>
        client.GET('/logistics/inbound-lots/{inboundLotId}/split-preview', {
          params: {
            path: { inboundLotId: inboundLotId as number },
            query: { lotIds: [...lotIds] },
          },
        }),
      ),
  });
};

/** 분리 실행(계약 §3) — 권한 W-01-01. */
export const splitLots = (
  client: Client,
  inboundLotId: number,
  body: { lotIds: number[]; versionNo: number; reason: string | null },
): Promise<InboundLotSplitResult> =>
  runRequest(() =>
    client.POST('/logistics/inbound-lots/{inboundLotId}:split-lots', {
      params: { path: { inboundLotId }, header: { 'Idempotency-Key': createIdempotencyKey() } },
      body: {
        lotIds: body.lotIds,
        versionNo: body.versionNo,
        ...(body.reason === null || body.reason.trim() === ''
          ? {}
          : { reason: body.reason.trim() }),
      },
    }),
  );

/** 쓰기 뒤 다시 읽기. */
export const useInboundRefresh = () => {
  const queryClient = useQueryClient();

  return async (): Promise<void> => {
    await Promise.all(
      INBOUND_INVALIDATE.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  };
};
