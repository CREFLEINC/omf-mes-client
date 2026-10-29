import type { components } from '@omf-mes/api-client';

import type { LocationLevelFields } from '../../patterns/location-level';
import type { SystemLocationFields } from '../../patterns/system-location';

export type DecisionResponse = components['schemas']['DispositionDecision'];
export type NonconformanceResponse = components['schemas']['Nonconformance'];
export type LotDetailResponse = components['schemas']['LotDetailResponse'];
export type LotStatusResponse = components['schemas']['LotQualityStatus'];
export type LotHoldResponse = components['schemas']['LotHold'];
export type WarehouseResponse = components['schemas']['Warehouse'];
/** 위치 — 단계·맨 아래 여부(P-154)와 서버가 만든 위치 표시(P-145)는 계약 사본에 아직 없어 넓혀 둔다. */
export type LocationResponse = components['schemas']['Location'] &
  LocationLevelFields &
  SystemLocationFields;
export type StockReinstatementCreate = components['schemas']['StockReinstatementCreate'];
export type StockReinstatementResponse = components['schemas']['StockReinstatementResponse'];
export type PageMeta = components['schemas']['PageMeta'];

export interface DecisionView {
  dispositionDecisionId: number;
  nonconformanceId: number;
  dispositionTypeCode: DecisionResponse['dispositionTypeCode'];
  decisionQty: number;
  followUpQty: number;
  uomId: number;
  reason: string;
  decidedAt: string;
  decidedByName: string | null;
  lotId: number | null;
  lotNo: string;
  itemId: number | null;
  itemCode: string | null;
  itemName: string | null;
}

export const toDecisionView = (data: DecisionResponse): DecisionView => ({
  dispositionDecisionId: data.dispositionDecisionId,
  nonconformanceId: data.nonconformanceId,
  dispositionTypeCode: data.dispositionTypeCode,
  decisionQty: data.decisionQty,
  followUpQty: data.followUpQty,
  uomId: data.uomId,
  reason: data.reason,
  decidedAt: data.decidedAt,
  decidedByName: data.decidedByName ?? null,
  lotId: data.lotId ?? null,
  lotNo: data.lotNo ?? '—',
  itemId: data.itemId ?? null,
  itemCode: data.itemCode ?? null,
  itemName: data.itemName ?? null,
});

export interface SelectOption {
  value: string;
  label: string;
}

export const displayItem = (decision: DecisionView): string =>
  [decision.itemCode, decision.itemName]
    .filter((value) => value !== null && value !== '')
    .join(' · ') || '—';

export const remainingDecisionQty = (decision: DecisionView): number =>
  Math.max(0, decision.decisionQty - decision.followUpQty);

export const remainingDays = (expiryDate: string | null, now: Date): number | null => {
  if (expiryDate === null) return null;
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
};
