import { createIdempotencyKey, type ApiClient, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { QueryClient } from '@tanstack/react-query';

import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest, runRequestWithResponse, toApiError } from '../../patterns/request';
import { toWorkOrderReleaseFact, type WorkOrderReleaseFact } from '../work-order-release/queries';
import { productionOrderItemKeys } from './item-lookups';

const t = messages.erpWorkOrderFlow.bulk.outcomeReasons;

type Client = ApiClient['client'];

export type ReleaseAttemptStatus = 'released' | 'skipped' | 'failed';

export interface ReleaseTarget {
  workOrderId: number;
  workOrderNo: string;
}

export interface ReleaseAttempt extends ReleaseTarget {
  status: ReleaseAttemptStatus;
  reason: string | null;
}

export const apiErrorText = (error: ApiError): string => {
  if (error.kind === 'validation' || error.kind === 'stateLocked') {
    return (
      error.errors
        .map((item) => item.message)
        .filter((m) => m.trim() !== '')
        .join(' ') || t.failed
    );
  }
  if (error.kind === 'conflict') return error.message;
  if (error.kind === 'http') return error.message ?? t.failed;
  return messages.httpError.description;
};

/** W/O 하나의 배포 판정. 예고(확인 창)와 실행이 같은 판정을 쓴다(C-18). */
export type ReleaseVerdict = { ready: true; lotSize: number } | { ready: false; reason: string };

export const judgeRelease = (
  fact: WorkOrderReleaseFact,
  item: { baseUomId: number; defaultProductionLotSize?: number | null },
  lotSize: number | null,
): ReleaseVerdict => {
  if (
    fact.productionLineId === null ||
    fact.defaultWipLocationId === null ||
    fact.defaultFgLocationId === null ||
    fact.defaultScrapLocationId === null
  ) {
    return { ready: false, reason: t.setupMissing };
  }
  if (lotSize !== null) return { ready: true, lotSize };
  const fallback = item.defaultProductionLotSize ?? null;
  if (fallback === null || fallback <= 0 || item.baseUomId !== fact.uomId) {
    return { ready: false, reason: t.noLotSize };
  }
  return { ready: true, lotSize: fallback };
};

interface Inspection {
  fact: WorkOrderReleaseFact;
  /** 판정에 쓴 상세의 ETag. 없으면 null이고, 빈 If-Match를 보내지 않는다. */
  etag: string | null;
  verdict: ReleaseVerdict;
}

const inspect = async (
  client: Client,
  queryClient: QueryClient,
  workOrderId: number,
  lotSize: number | null,
): Promise<Inspection> => {
  const detail = await runRequestWithResponse(() =>
    client.GET('/production/work-orders/{workOrderId}', { params: { path: { workOrderId } } }),
  );
  const fact = toWorkOrderReleaseFact(detail.data);
  const item = await queryClient.fetchQuery({
    queryKey: productionOrderItemKeys.detail(fact.itemId),
    queryFn: () =>
      runRequest(() =>
        client.GET('/mdm/items/{itemId}', { params: { path: { itemId: fact.itemId } } }),
      ),
  });
  return {
    fact,
    etag: detail.response.headers.get('ETag'),
    verdict: judgeRelease(fact, item.item, lotSize),
  };
};

/**
 * W/O 한 건을 배포한다. 판정에 쓴 상세의 ETag로 보내고, 판정이 막히거나 ETag가 없으면 보내지 않는다.
 * `lotSize`가 null이면 품목 기본 LOT 크기를 쓴다(작업함 일괄 배포). 처리 화면은 사용자가 정한 값을 넘긴다.
 * `idempotencyKey`를 주면 그 키로 보낸다. 처리 화면은 같은 W/O와 LOT 크기의 배포가 반영될 때까지 같은 키를
 * 다시 쓴다(되돌릴 수 없는 쓰기의 `until-applied` 수명).
 */
export const releaseWorkOrder = async (
  client: Client,
  queryClient: QueryClient,
  target: ReleaseTarget,
  lotSize: number | null,
  idempotencyKey: string = createIdempotencyKey(),
): Promise<ReleaseAttempt> => {
  const outcome = (status: ReleaseAttemptStatus, reason: string | null): ReleaseAttempt => ({
    ...target,
    status,
    reason,
  });
  try {
    const { etag, verdict } = await inspect(client, queryClient, target.workOrderId, lotSize);
    if (!verdict.ready) return outcome('skipped', verdict.reason);
    if (etag === null) return outcome('failed', messages.save.staleToken);
    await runRequest(() =>
      client.POST('/production/work-orders/{workOrderId}:release', {
        params: {
          path: { workOrderId: target.workOrderId },
          header: { 'Idempotency-Key': idempotencyKey, 'If-Match': etag },
        },
        body: { lotSize: verdict.lotSize },
      }),
    );
    return outcome('released', null);
  } catch (cause) {
    return outcome('failed', apiErrorText(toApiError(cause)));
  }
};

/** ERP W/O 하나의 배포 전 W/O 목록(끝까지). */
export const unreleasedWorkOrdersOf = async (
  client: Client,
  productionOrderId: number,
): Promise<ReleaseTarget[]> => {
  const list = await fetchAllPages((page, size) =>
    runRequest(() =>
      client.GET('/production/work-orders', {
        params: { query: { productionOrderId, released: false, page, size } },
      }),
    ),
  );
  return list.items.map((item) => ({
    workOrderId: item.workOrderId,
    workOrderNo: item.workOrderNo,
  }));
};

export interface ReleaseForecast {
  total: number;
  ready: number;
  /** 첫 막힌 W/O와 사유 */
  firstBlocked: { workOrderNo: string; reason: string } | null;
}

/** 일괄 배포 확인 창의 예고. 실행과 같은 판정(`judgeRelease`)으로 ERP W/O마다 배포될 W/O 수를 센다. */
export const forecastRelease = async (
  client: Client,
  queryClient: QueryClient,
  productionOrderId: number,
): Promise<ReleaseForecast> => {
  const targets = await unreleasedWorkOrdersOf(client, productionOrderId);
  const forecast: ReleaseForecast = { total: targets.length, ready: 0, firstBlocked: null };
  for (const target of targets) {
    const { verdict } = await inspect(client, queryClient, target.workOrderId, null);
    if (verdict.ready) forecast.ready += 1;
    else if (forecast.firstBlocked === null) {
      forecast.firstBlocked = { workOrderNo: target.workOrderNo, reason: verdict.reason };
    }
  }
  return forecast;
};

/** 같은 쿼리 접두로 작업함, 처리 화면의 캐시를 함께 갱신한다. */
export const invalidateFlow = (queryClient: QueryClient) =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: ['production-orders'] }),
    queryClient.invalidateQueries({ queryKey: ['production-plans'] }),
    queryClient.invalidateQueries({ queryKey: ['work-orders'] }),
    queryClient.invalidateQueries({ queryKey: ['work-order-release'] }),
  ]);
