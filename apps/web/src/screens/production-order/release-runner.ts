import {
  createIdempotencyKey,
  type ApiClient,
  type ApiError,
  type components,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { QueryClient } from '@tanstack/react-query';

import { fetchAllPages } from '../../patterns/fetch-all-pages';
import { runRequest, runRequestWithResponse, toApiError } from '../../patterns/request';
import { toWorkOrderReleaseFact, type WorkOrderReleaseFact } from '../work-order-release/queries';
import { productionOrderItemKeys } from './item-lookups';

const t = messages.erpWorkOrderFlow.bulk.outcomeReasons;

type Client = ApiClient['client'];

/** 배포 응답(계약 §2) — 생산 창고 공장은 출고 요청 요약과 미배정 자재를 싣는다. */
type WorkOrderReleaseResult = components['schemas']['WorkOrderReleaseResult'];
export type ReleaseUnsourcedShortage = NonNullable<
  WorkOrderReleaseResult['unsourcedShortages']
>[number];

/** 배포 400 의 출고 요청 기준정보 사유(계약 §2) — 화면이 문구와 바로가기를 고르는 차례. */
export const RELEASE_BLOCK_CODES = [
  'LINE_DEPARTMENT_MISSING',
  'PRODUCTION_WAREHOUSE_MISSING',
  'PRODUCTION_FLOOR_LOCATION_MISSING',
] as const;

export type ReleaseAttemptStatus = 'released' | 'skipped' | 'failed';

export interface ReleaseTarget {
  workOrderId: number;
  workOrderNo: string;
}

export interface ReleaseAttempt extends ReleaseTarget {
  status: ReleaseAttemptStatus;
  reason: string | null;
  /**
   * 피처 003 — 배포 400 의 출고 요청 기준정보 사유 코드(계약 §2). 화면이 코드마다 문구와 바로가기를 낸다.
   * 그 밖의 실패는 비어 있고 `reason` 만 쓴다.
   */
  blocks?: string[];
  /** 배포는 됐지만 재고 있는 생산 창고가 없어 요청에 넣지 못한 자재(FR-007a). */
  unsourced?: ReleaseUnsourcedShortage[];
}

/** 400 오류에서 출고 요청 기준정보 사유만 고른다(중복 없이, 계약 차례로). */
export const releaseBlocksOf = (error: ApiError): string[] => {
  if (error.kind !== 'validation') return [];
  const codes = new Set(error.errors.map((item) => item.code));
  return RELEASE_BLOCK_CODES.filter((code) => codes.has(code));
};

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
    const released = await runRequest(() =>
      client.POST('/production/work-orders/{workOrderId}:release', {
        params: {
          path: { workOrderId: target.workOrderId },
          header: { 'Idempotency-Key': idempotencyKey, 'If-Match': etag },
        },
        body: { lotSize: verdict.lotSize },
      }),
    );
    const unsourced = released.unsourcedShortages ?? [];
    return unsourced.length === 0
      ? outcome('released', null)
      : { ...outcome('released', null), unsourced };
  } catch (cause) {
    const error = toApiError(cause);
    const blocks = releaseBlocksOf(error);
    return blocks.length === 0
      ? outcome('failed', apiErrorText(error))
      : { ...outcome('failed', apiErrorText(error)), blocks };
  }
};

/** 배포 전 W/O의 상태. 서버 「배포 전 W/O」 수(`releasePendingWorkOrderCount`)와 같은 조건이다. */
const RELEASE_PENDING_STATUSES: readonly string[] = ['PLANNED', 'CONFIRMED'];

/**
 * ERP W/O 하나의 배포 전 W/O 목록(끝까지). 배포 시각이 없어도 취소된 W/O는 빼서 목록 열의 「배포 전」 수와 맞춘다.
 * 목록 API의 `statusCode`는 값 하나만 받아, 모든 쪽을 받은 뒤 상태로 거른다.
 */
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
  return list.items
    .filter((item) => RELEASE_PENDING_STATUSES.includes(item.statusCode))
    .map((item) => ({
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
