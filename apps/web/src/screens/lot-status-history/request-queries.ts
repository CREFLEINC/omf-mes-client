import type { paths } from '@omf-mes/api-client';

import { ALL_LOT_TYPES, type HistoryFilters, type LotFilters } from './filters';
import { toHistoryPeriodBounds, validateHistoryPeriod } from './period';

export type LotStatusListQuery = NonNullable<
  NonNullable<paths['/quality/lot-statuses']['get']>['parameters']['query']
>;
export type LotStatusSummaryQuery = NonNullable<
  NonNullable<paths['/quality/lot-status-summary']['get']>['parameters']['query']
>;
export type LotHoldEventQuery = NonNullable<
  paths['/quality/lot-hold-events']['get']
>['parameters']['query'];
export type LotStatusEventQuery = NonNullable<
  paths['/trace/lot-status-events']['get']
>['parameters']['query'];
export type LotHoldListQuery = NonNullable<
  NonNullable<paths['/quality/lot-holds']['get']>['parameters']['query']
>;

const POSITIVE_INTEGER = /^\d+$/;

const toPositiveIdentifier = (raw: string): number | undefined => {
  if (!POSITIVE_INTEGER.test(raw)) return undefined;

  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : undefined;
};

const toPage = (page: number): number | undefined =>
  Number.isSafeInteger(page) && page > 1 ? page : undefined;

/** 목록과 요약이 같은 모집단을 보도록 공통 필터를 한 자리에서 만든다. 유형이 비면 아직 조회 전이다. */
export const toLotStatusSummaryQuery = (filters: LotFilters): LotStatusSummaryQuery | null => {
  if (filters.lotType === '') return null;

  const query: LotStatusSummaryQuery = {};
  const itemId = toPositiveIdentifier(filters.item);
  const warehouseId = toPositiveIdentifier(filters.warehouse);
  const locationId = toPositiveIdentifier(filters.location);

  if (filters.lotType !== ALL_LOT_TYPES) query.lotTypeCode = filters.lotType;
  if (filters.q !== '') query.q = filters.q;
  if (itemId !== undefined) query.itemId = itemId;
  if (filters.status !== '') query.lotStatusCode = filters.status;
  if (warehouseId !== undefined) query.warehouseId = warehouseId;
  if (locationId !== undefined) query.locationId = locationId;

  return query;
};

export const toLotStatusListQuery = (
  filters: LotFilters,
  page: number,
): LotStatusListQuery | null => {
  const commonQuery = toLotStatusSummaryQuery(filters);
  if (commonQuery === null) return null;

  const query: LotStatusListQuery = {
    ...commonQuery,
    sort: filters.sort,
  };
  const validPage = toPage(page);

  if (validPage !== undefined) query.page = validPage;

  return query;
};

export const toLotHoldEventQuery = (
  filters: HistoryFilters,
  page: number,
  offsetMinutes: number,
): LotHoldEventQuery | null => {
  const period = { from: filters.from, to: filters.to };
  if (validateHistoryPeriod(period) !== null) return null;

  const bounds = toHistoryPeriodBounds(period, offsetMinutes);
  const query: LotHoldEventQuery = {
    occurredFrom: bounds.from,
    occurredTo: bounds.to,
    sort: 'occurredDesc',
  };
  const actorId = toPositiveIdentifier(filters.actor);
  const validPage = toPage(page);

  if (actorId !== undefined) query.actorId = actorId;
  if (filters.lot !== '') query.lotNo = filters.lot;
  if (validPage !== undefined) query.page = validPage;

  return query;
};

/** 상태 변경이력은 행위자·LOT 번호를 받지 않는다 — 기간만 보내고 화면이 거른다(timeline.ts). */
export const toLotStatusEventQuery = (
  filters: HistoryFilters,
  offsetMinutes: number,
): LotStatusEventQuery | null => {
  const period = { from: filters.from, to: filters.to };
  if (validateHistoryPeriod(period) !== null) return null;

  const bounds = toHistoryPeriodBounds(period, offsetMinutes);
  return { occurredFrom: bounds.from, occurredTo: bounds.to };
};

/** 행위자 필터 값. 보류 사건 쪽 질의와 같은 규칙으로 읽는다. */
export const toHistoryActorId = (filters: HistoryFilters): number | undefined =>
  toPositiveIdentifier(filters.actor);

/**
 * LOT 한 건의 이력은 LOT 이 생긴 뒤 전부다. 두 이력 API 가 기간을 필수로 받아(L-3) 시작은
 * 운영 이전으로, 끝은 부르는 순간의 다음 날로 둔다.
 */
export const LOT_HISTORY_FROM = '2000-01-01T00:00:00Z';

export const toLotHistoryBounds = (now: Date): { occurredFrom: string; occurredTo: string } => ({
  occurredFrom: LOT_HISTORY_FROM,
  occurredTo: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
});

export const toLotHoldListQuery = (lotId: number | null, page = 1): LotHoldListQuery | null => {
  if (lotId === null || !Number.isSafeInteger(lotId) || lotId < 1) return null;
  const query: LotHoldListQuery = { lotId, open: false };
  const validPage = toPage(page);
  if (validPage !== undefined) query.page = validPage;
  return query;
};
