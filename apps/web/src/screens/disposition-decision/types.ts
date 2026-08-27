import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * ⭐ 이 화면은 계약 두 벌을 부른다 — 조회는 **제품출하(04)**, 판정 저장은 **품질(03)**이다.
 * 경로 앞머리가 `/quality/**`로 같아 한 계약처럼 보이지만 정본 파일이 다르다.
 * 소유가 갈린 근거는 공유계약 B-13(누가 정하고 누가 반영하는가)이다.
 */
export type Nonconformance = components['schemas']['Nonconformance'];
export type NonconformanceLot = components['schemas']['NonconformanceLot'];
export type DispositionDecision = components['schemas']['DispositionDecision'];
export type PageMeta = components['schemas']['PageMeta'];

export interface NonconformanceListResponse {
  items: Nonconformance[];
  page: PageMeta;
}

export interface DispositionDecisionListResponse {
  items: DispositionDecision[];
  page: PageMeta;
}

const quantityFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 });

export const formatQty = (value: number | undefined): string =>
  value === undefined || !Number.isFinite(value)
    ? messages.dispositionDecision.values.unknownQty
    : quantityFormat.format(value);

/**
 * 시각을 «분»까지만 보인다. 문자열을 자르는 이유는 `Date`로 파싱하면 실행 환경의 시간대가
 * 값을 옮기기 때문이다 — 서버가 준 벽시계 시각을 그대로 보여야 판정 이력이 자리마다 달라지지 않는다.
 */
export const formatDateTime = (value: string): string => {
  const matched = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return matched === null ? value : `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

export const formatDate = (value: string): string => {
  const matched = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return matched === null ? value : (matched[1] ?? value);
};

/**
 * 대상 LOT 수량의 합.
 *
 * ⚠ 목록 응답의 `lots`는 계약에서 `required`가 아니다 — 실려 오지 않으면 합을 낼 수 없으므로
 * 0을 지어내지 않고 `undefined`로 남긴다. 화면은 그 자리를 「—」로 비운다.
 */
export const totalAffectedQty = (lots: NonconformanceLot[] | undefined): number | undefined =>
  lots === undefined ? undefined : lots.reduce((sum, lot) => sum + lot.affectedQty, 0);

export interface NonconformanceRow {
  nonconformanceId: number;
  nonconformanceNo: string;
  itemId: number;
  severityCode: string;
  statusCode: string;
  openedAtText: string;
  affectedQtyText: string;
}

export const toNonconformanceRow = (nonconformance: Nonconformance): NonconformanceRow => ({
  nonconformanceId: nonconformance.nonconformanceId,
  nonconformanceNo: nonconformance.nonconformanceNo,
  itemId: nonconformance.itemId,
  severityCode: nonconformance.severityCode,
  statusCode: nonconformance.statusCode,
  openedAtText: formatDate(nonconformance.openedAt),
  affectedQtyText: formatQty(totalAffectedQty(nonconformance.lots)),
});

export interface NonconformanceLotRow {
  nonconformanceLotId: number;
  lotId: number;
  lotNoText: string;
  affectedQtyText: string;
  uomId: number;
  qualityStatusText: string;
}

export const toLotRow = (lot: NonconformanceLot): NonconformanceLotRow => ({
  nonconformanceLotId: lot.nonconformanceLotId,
  lotId: lot.lotId,
  lotNoText: lot.lotNo ?? messages.common.reference.empty,
  affectedQtyText: formatQty(lot.affectedQty),
  uomId: lot.uomId,
  qualityStatusText: `${lot.qualityStatusBeforeCode} → ${lot.qualityStatusAfterCode}`,
});

export interface DecisionRow {
  dispositionDecisionId: number;
  dispositionTypeCode: string;
  decisionQtyText: string;
  uomId: number;
  reason: string;
  decidedAtText: string;
  decidedBy: number;
}

export const toDecisionRow = (decision: DispositionDecision): DecisionRow => ({
  dispositionDecisionId: decision.dispositionDecisionId,
  dispositionTypeCode: decision.dispositionTypeCode,
  decisionQtyText: formatQty(decision.decisionQty),
  uomId: decision.uomId,
  reason: decision.reason,
  decidedAtText: formatDateTime(decision.decidedAt),
  decidedBy: decision.decidedBy,
});

export interface NonconformanceDetailView {
  nonconformanceNo: string;
  itemId: number;
  severityCode: string;
  statusCode: string;
  openedAtText: string;
  description: string;
  lots: NonconformanceLotRow[];
}

export const toDetailView = (nonconformance: Nonconformance): NonconformanceDetailView => ({
  nonconformanceNo: nonconformance.nonconformanceNo,
  itemId: nonconformance.itemId,
  severityCode: nonconformance.severityCode,
  statusCode: nonconformance.statusCode,
  openedAtText: formatDateTime(nonconformance.openedAt),
  description:
    nonconformance.description.trim() === ''
      ? messages.dispositionDecision.detail.emptyDescription
      : nonconformance.description,
  lots: (nonconformance.lots ?? []).map(toLotRow),
});

/** 대상 LOT의 단위로 고정한다(스펙 §4-B) — 판정 수량의 단위를 사용자가 고르지 않는다. */
export const decisionUomIdOf = (lots: NonconformanceLot[] | undefined): number | undefined =>
  lots?.[0]?.uomId;
