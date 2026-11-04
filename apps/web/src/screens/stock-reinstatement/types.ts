import type {
  StockReinstatementCreateForward,
  StockReinstatementResponseForward,
  components,
} from '@omf-mes/api-client';

export type DecisionResponse = components['schemas']['DispositionDecision'];
export type NonconformanceResponse = components['schemas']['Nonconformance'];
export type LotDetailResponse = components['schemas']['LotDetailResponse'];
export type LotStatusResponse = components['schemas']['LotQualityStatus'];
export type LotHoldResponse = components['schemas']['LotHold'];
export type WarehouseResponse = components['schemas']['Warehouse'];
export type LocationResponse = components['schemas']['Location'];
/** 처분 «특채»는 보류를 고르지 않는다 — 보류·해제 사유가 선택이다(omf-all-around#207). */
export type StockReinstatementCreate = StockReinstatementCreateForward;
export type StockReinstatementResponse = StockReinstatementResponseForward;
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

/** 특채 적용이 남긴 처분 — 보류 없이 불량창고 재고만 정상 창고로 옮긴다(omf-all-around#207). */
export const isConcession = (decision: Pick<DecisionView, 'dispositionTypeCode'>): boolean =>
  decision.dispositionTypeCode === 'CONCESSION';

/** LOT 칸의 이름 — 처분 유형이 아니라 LOT 자체의 종류로 정한다(#207). 모르면 그냥 「LOT」. */
export const lotLabelOf = (
  lotTypeCode: string | null | undefined,
  text: { lot: string; materialLot: string; productionLot: string; anyLot: string },
): string =>
  lotTypeCode === 'PRODUCT'
    ? text.lot
    : lotTypeCode === 'MATERIAL'
      ? text.materialLot
      : lotTypeCode === 'PRODUCTION'
        ? text.productionLot
        : text.anyLot;

export const remainingDecisionQty = (decision: DecisionView): number =>
  Math.max(0, decision.decisionQty - decision.followUpQty);

export const remainingDays = (expiryDate: string | null, now: Date): number | null => {
  if (expiryDate === null) return null;
  const expiry = new Date(`${expiryDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
};
