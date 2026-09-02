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
/** W-03-10 ② 「남은 수량」 구획 — 판정 이력 조회 봉투가 목록과 함께 싣는다. */
export type DispositionRemainingSummary = components['schemas']['DispositionRemainingSummary'];

/**
 * 목록 봉투는 계약에서 파생한다 — 손으로 옮겨 적으면 계약이 바뀌어도 컴파일이 잡지 못한다.
 */
export type NonconformanceListResponse =
  paths['/quality/nonconformances']['get']['responses']['200']['content']['application/json'];

/** 한 부적합에 딸린 판정 목록. 이 봉투에는 그 부적합에 대한 집계 구획이 함께 온다. */
export type DispositionDecisionListResponse =
  paths['/quality/nonconformances/{nonconformanceId}/disposition-decisions']['get']['responses']['200']['content']['application/json'];

/**
 * 처리 이력 탭이 부르는 **전역** 판정 목록.
 *
 * ⛔ **위 봉투와 같은 타입으로 두지 않는다.** 경로가 다르고 **봉투도 다르다** — 부적합 하나에
 * 딸린 목록에는 집계가 함께 오지만 전역 목록에는 없다. 하나로 묶으면 있지도 않은 집계를
 * 화면이 읽게 되고, 그 값은 오류가 아니라 **빈 값**으로 나타나 알아채기 어렵다.
 */
export type DispositionDecisionHistoryResponse =
  paths['/quality/disposition-decisions']['get']['responses']['200']['content']['application/json'];

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

export interface NonconformanceRow {
  nonconformanceId: number;
  nonconformanceNo: string;
  itemId: number;
  severityCode: string;
  statusCode: string;
  openedAtText: string;
  affectedQtyText: string;
  dispositionProgressCode: Nonconformance['dispositionProgressCode'];
}

export const toNonconformanceRow = (nonconformance: Nonconformance): NonconformanceRow => ({
  nonconformanceId: nonconformance.nonconformanceId,
  nonconformanceNo: nonconformance.nonconformanceNo,
  itemId: nonconformance.itemId,
  severityCode: nonconformance.severityCode,
  statusCode: nonconformance.statusCode,
  openedAtText: formatDate(nonconformance.openedAt),
  /* ⭐ lots를 세지 않는다 — 서버가 롤업해 낸 합을 그대로 옮긴다(공유계약 L-2). 근거: omf-mes#253 */
  affectedQtyText: formatQty(nonconformance.affectedQtyTotal),
  dispositionProgressCode: nonconformance.dispositionProgressCode,
});

/**
 * ⭐ W-03-10 ① 「판정 진행」 열의 표시 문구. 서버가 대상 수량 합과 결정 수량 합을 롤업해 세 값
 * 중 하나로 낸다(공유계약 L-2) — 화면이 `statusCode`나 판정 이력을 세어 다시 판정하지 않는다.
 * 무기본절 switch로 셋을 전수 처리한다 — 계약이 값을 늘리면 컴파일이 먼저 잡는다.
 */
export const dispositionProgressLabel = (
  code: Nonconformance['dispositionProgressCode'],
): string => {
  const t = messages.dispositionDecision.values.dispositionProgress;

  switch (code) {
    case 'NOT_STARTED':
      return t.NOT_STARTED;
    case 'PARTIAL':
      return t.PARTIAL;
    case 'COMPLETED':
      return t.COMPLETED;
  }
};

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
