import type { components, paths } from '@omf-mes/api-client';
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

/**
 * 목록 봉투는 계약에서 파생한다 — 손으로 옮겨 적으면 계약이 바뀌어도 컴파일이 잡지 못한다.
 */
export type NonconformanceListResponse =
  paths['/quality/nonconformances']['get']['responses']['200']['content']['application/json'];

export type DispositionDecisionListResponse =
  paths['/quality/nonconformances/{nonconformanceId}/disposition-decisions']['get']['responses']['200']['content']['application/json'];

const quantityFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 });

/**
 * RFC 3339의 날짜·시각 앞부분. **날짜와 시각을 잇는 글자는 대문자 `T`가 정본이지만 소문자도
 * 허용된다** — 대문자만 받으면 소문자를 쓰는 서버의 값이 원문 그대로 화면에 샌다.
 */
const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/i;
const DATE_PATTERN = /^(\d{4}-\d{2}-\d{2})/;

export const formatQty = (value: number | undefined): string =>
  value === undefined || !Number.isFinite(value)
    ? messages.dispositionDecision.values.unknownQty
    : quantityFormat.format(value);

/**
 * 시각을 «분»까지만 보인다. 문자열을 자르는 이유는 `Date`로 파싱하면 실행 환경의 시간대가
 * 값을 옮기기 때문이다 — 서버가 준 벽시계 시각을 그대로 보여야 판정 이력이 자리마다 달라지지 않는다.
 *
 * ⚠ **뒤집으면 이런 가정이 깔린다: 서버가 보내는 오프셋이 사용자가 읽을 오프셋과 같다.**
 * 오프셋을 옮기지 않고 버리므로, 서버가 `Z`로 보내면 화면은 UTC 벽시계를 보인다.
 * 계약의 예시가 전부 현장 오프셋(`+09:00`)이라 지금은 성립하지만, 서버가 `Z`로 바꾸면
 * 이 함수부터 고쳐야 한다.
 */
export const formatDateTime = (value: string): string => {
  const matched = DATE_TIME_PATTERN.exec(value);
  return matched === null ? value : `${matched[1] ?? ''} ${matched[2] ?? ''}`;
};

export const formatDate = (value: string): string => {
  const matched = DATE_PATTERN.exec(value);
  return matched === null ? value : (matched[1] ?? value);
};

/**
 * 대상 LOT 수량의 합.
 *
 * ⚠ **이것은 잠정 처리다.** 스펙 §4-A는 이 합을 「서버 집계」로 정했고(공유계약 L-2 — 파생값은
 * 서버가 낸다) 계약 응답에는 집계 필드가 없다. 회신 전까지 화면이 대신 더한다 — 근거는
 * omf-mes#253. 파생을 이 함수 하나에 가둬 서버 필드가 오면 여기만 바꾸게 한다.
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

/**
 * 대상 LOT의 단위로 고정한다(스펙 §4-B) — 판정 수량의 단위를 사용자가 고르지 않는다.
 *
 * ⛔ **단위가 섞이면 고르지 않는다.** 계약은 대상 LOT마다 제 `uomId`를 갖도록 허용하는데,
 * 첫 LOT의 단위를 말없이 집으면 **다른 단위의 수량이 그 단위로 저장된다** — 되돌릴 수 없는
 * 쓰기라 되돌리지 못한다. 갈리면 `undefined`를 돌려 저장을 막고 사람이 판단하게 한다.
 */
export const decisionUomIdOf = (lots: NonconformanceLot[] | undefined): number | undefined => {
  const first = lots?.[0];
  if (first === undefined) return undefined;

  return lots?.every((lot) => lot.uomId === first.uomId) === true ? first.uomId : undefined;
};
