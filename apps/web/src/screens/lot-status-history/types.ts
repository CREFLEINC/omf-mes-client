import type { components } from '@omf-mes/api-client';

type LotQualityStatusResponse = components['schemas']['LotQualityStatus'];
type LotStatusSummaryResponse = components['schemas']['LotStatusSummary'];
type LotHoldResponse = components['schemas']['LotHold'];
type LotHoldEventResponse = components['schemas']['LotHoldEvent'];

export interface LotStatusRow {
  lotId: number;
  lotNo: string;
  itemId: number;
  lotTypeCode: string | null;
  lotStatusCode: string;
  warehouseId: number | null;
  locationId: number | null;
  onHandQty: number | null;
  heldQty: number | null;
  availableQty: number | null;
  uomId: number | null;
  openHoldCount: number | null;
  fullyHeld: boolean;
  latestTransitionAt: string | null;
  latestReasonCode: string | null;
}

export const toLotStatusRow = (value: LotQualityStatusResponse): LotStatusRow => ({
  lotId: value.lotId,
  lotNo: value.lotNo,
  itemId: value.itemId,
  lotTypeCode: value.lotTypeCode ?? null,
  lotStatusCode: value.lotStatusCode,
  warehouseId: value.warehouseId ?? null,
  locationId: value.locationId ?? null,
  onHandQty: value.onHandQty ?? null,
  heldQty: value.heldQty ?? null,
  availableQty: value.availableQty ?? null,
  uomId: value.uomId ?? null,
  openHoldCount: value.openHoldCount ?? null,
  fullyHeld: value.fullyHeld,
  latestTransitionAt: value.latestTransitionAt ?? null,
  latestReasonCode: value.latestReasonCode ?? null,
});

const toIdentityKey = (value: number | null): string => (value === null ? '-' : String(value));

export const lotStatusRowKey = (row: LotStatusRow): string =>
  [row.lotId, row.warehouseId, row.locationId].map(toIdentityKey).join(':');

export interface LotStatusCountView {
  statusCode: string;
  lotCount: number;
  lotTypeCode: string | null;
}

export interface LotStatusSummaryView {
  counts: readonly LotStatusCountView[];
  asOf: string;
  outOfScopeCount: number | null;
}

export const toLotStatusSummaryView = (value: LotStatusSummaryResponse): LotStatusSummaryView => ({
  counts: value.counts.map((count) => ({
    statusCode: count.statusCode,
    lotCount: count.lotCount,
    lotTypeCode: count.lotTypeCode ?? null,
  })),
  asOf: value.asOf,
  outOfScopeCount: value.outOfScopeCount ?? null,
});

export interface LotHoldView {
  lotHoldId: number;
  lotId: number;
  lotNo: string | null;
  itemId: number | null;
  holdQty: number | null;
  uomId: number | null;
  reasonCode: string;
  releaseCondition: string | null;
  holdStatusCode: string;
  heldBy: number | null;
  heldAt: string;
  releasedBy: number | null;
  releasedAt: string | null;
  remarks: string | null;
  lotStatusCode: string | null;
}

export const toLotHoldView = (value: LotHoldResponse): LotHoldView => ({
  lotHoldId: value.lotHoldId,
  lotId: value.lotId,
  lotNo: value.lotNo ?? null,
  itemId: value.itemId ?? null,
  holdQty: value.holdQty ?? null,
  uomId: value.uomId ?? null,
  reasonCode: value.reasonCode,
  releaseCondition: value.releaseCondition ?? null,
  holdStatusCode: value.statusCode,
  heldBy: value.heldBy ?? null,
  heldAt: value.heldAt,
  releasedBy: value.releasedBy ?? null,
  releasedAt: value.releasedAt ?? null,
  remarks: value.remarks ?? null,
  lotStatusCode: value.lotStatusCode ?? null,
});

export interface LotHoldEventView {
  lotHoldId: number;
  eventTypeCode: 'HELD' | 'RELEASED';
  occurredAt: string;
  lotId: number;
  lotNo: string;
  itemId: number | null;
  actorId: number;
  actorName: string | null;
  reasonCode: string | null;
  holdQty: number | null;
  uomId: number | null;
  releaseCondition: string | null;
  targetLotStatusCode: string | null;
}

export const toLotHoldEventView = (value: LotHoldEventResponse): LotHoldEventView => ({
  lotHoldId: value.lotHoldId,
  eventTypeCode: value.eventTypeCode,
  occurredAt: value.occurredAt,
  lotId: value.lotId,
  lotNo: value.lotNo,
  itemId: value.itemId ?? null,
  actorId: value.actorId,
  actorName: value.actorName ?? null,
  reasonCode: value.reasonCode ?? null,
  holdQty: value.holdQty ?? null,
  uomId: value.uomId ?? null,
  releaseCondition: value.releaseCondition ?? null,
  targetLotStatusCode: value.targetLotStatusCode ?? null,
});
