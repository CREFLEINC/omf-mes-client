import type { InspectionResultListQueryForward, paths } from '@omf-mes/api-client';

import {
  isCalendarDate,
  periodProblem,
  type InspectionInsightFilters,
  type InspectionResultSort,
} from './filters';

/** 서버 선행 P-76 — `lotId` 질의를 더한 목록 질의(omf-all-around#85). */
export type InspectionListQuery = InspectionResultListQueryForward;
export type InspectionSummaryQuery = NonNullable<
  NonNullable<paths['/quality/inspection-results/summary']['get']>['parameters']['query']
>;
export type DefectRateTrendQuery = NonNullable<
  NonNullable<paths['/quality/inspection-results/defect-rate-trend']['get']>['parameters']['query']
>;
export type DefectDistributionQuery = NonNullable<
  NonNullable<paths['/quality/defect-records/distribution']['get']>['parameters']['query']
>;
export type DistributionGroup = NonNullable<DefectDistributionQuery['groupBy']>;

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * 화면이 고른 **날짜**를 계약이 받는 **시각**으로 바꾼다.
 *
 * ⛔ 날짜 그대로 보내면 조회가 서지 않는다 — 계약이 기간의 두 끝을 `date-time` 으로 정했고,
 * `2026-08-01` 을 그대로 실으면 형식에서 막힌다(목 서버 실측 400). 화면은 날짜만 고르므로
 * 하루의 시작과 끝을 여기서 만든다.
 *
 * ⚠ **끝을 다음 날 0시가 아니라 그날 23:59:59 로 잡는다.** 계약이 이 경계를 포함으로 보는지
 * 밝히지 않았다 — 포함이면 그대로 맞고, 미포함이어도 다음 날을 끌어오지 않는다.
 *
 * ⚠ DST 가 없는 대상 지역(한국 UTC+9 · 베트남 UTC+7)을 전제로 두 끝에 같은 오프셋을 찍는다.
 */
const zone = (): string => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const absolute = Math.abs(offsetMinutes);

  return `${offsetMinutes < 0 ? '-' : '+'}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};

const startOfDay = (date: string): string => `${date}T00:00:00${zone()}`;
const endOfDay = (date: string): string => `${date}T23:59:59${zone()}`;

const toIdentifier = (raw: string): number | undefined => {
  if (!/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : undefined;
};

const hasValidPeriod = (filters: InspectionInsightFilters): boolean =>
  isCalendarDate(filters.from) && isCalendarDate(filters.to) && filters.from <= filters.to;

const toCommonQuery = (
  filters: InspectionInsightFilters,
  requireInspectionType: boolean,
): InspectionSummaryQuery | null => {
  if (!hasValidPeriod(filters) || (requireInspectionType && filters.inspectionTypeCode === ''))
    return null;
  const query: InspectionSummaryQuery = {
    inspectedFrom: startOfDay(filters.from),
    inspectedTo: endOfDay(filters.to),
    finalRoundOnly: filters.finalRoundOnly,
  };
  if (filters.inspectionTypeCode !== '') query.inspectionTypeCode = filters.inspectionTypeCode;
  const itemId = toIdentifier(filters.itemId);
  const processId = toIdentifier(filters.processId);
  if (itemId !== undefined) query.itemId = itemId;
  if (processId !== undefined) query.processId = processId;
  if (filters.overallJudgmentCode !== '') query.overallJudgmentCode = filters.overallJudgmentCode;
  if (filters.calibrationExpired !== '') query.calibrationExpired = filters.calibrationExpired;
  return query;
};

export const toInspectionSummaryQuery = (
  filters: InspectionInsightFilters,
): InspectionSummaryQuery | null => toCommonQuery(filters, true);

export const toDefectRateTrendQuery = (
  filters: InspectionInsightFilters,
): DefectRateTrendQuery | null => toCommonQuery(filters, true);

/**
 * 목록 질의. ⭐ LOT 번호가 있으면(omf-all-around#85) 그 LOT 의 id(`lotId`)가 풀린 뒤에야 서고, 기간이 비면
 * 기간 없이 그 LOT 의 전 이력을 묻는다(서버 P-76). LOT 번호가 없으면 종전대로 기간이 필수다.
 * `lotId` — LOT 번호를 풀어 얻은 id. 아직 못 풀었으면 `undefined`(조회를 세우지 않는다).
 */
export const toInspectionListQuery = (
  filters: InspectionInsightFilters,
  sort: InspectionResultSort,
  page: number,
  lotId?: number,
): InspectionListQuery | null => {
  const hasLot = filters.lotNo.trim() !== '';
  if (hasLot && lotId === undefined) return null;
  if (periodProblem(filters) !== null) return null;
  // 기간이 있으면 종전 공통 질의(형식까지 본다), 비었으면(LOT 조회) 기간만 뺀 질의다.
  const common: InspectionListQuery | null =
    filters.from === '' ? withoutPeriod(filters) : toCommonQuery(filters, false);
  if (common === null) return null;
  const query: InspectionListQuery = { ...common, sort };
  if (hasLot) query.lotId = lotId;
  if (Number.isSafeInteger(page) && page > 1) query.page = page;
  return query;
};

/** 기간 없는 LOT 조회 — 기간 둘만 빼고 나머지 조건은 그대로 싣는다. */
const withoutPeriod = (filters: InspectionInsightFilters): InspectionListQuery => {
  const query: InspectionListQuery = { finalRoundOnly: filters.finalRoundOnly };
  if (filters.inspectionTypeCode !== '') query.inspectionTypeCode = filters.inspectionTypeCode;
  const itemId = toIdentifier(filters.itemId);
  const processId = toIdentifier(filters.processId);
  if (itemId !== undefined) query.itemId = itemId;
  if (processId !== undefined) query.processId = processId;
  if (filters.overallJudgmentCode !== '') query.overallJudgmentCode = filters.overallJudgmentCode;
  if (filters.calibrationExpired !== '') query.calibrationExpired = filters.calibrationExpired;
  return query;
};

export const toDefectDistributionQuery = (
  filters: InspectionInsightFilters,
  groupBy: DistributionGroup,
  sourceAxisCode: string,
): DefectDistributionQuery | null => {
  if (!hasValidPeriod(filters)) return null;
  const query: DefectDistributionQuery = {
    detectedFrom: startOfDay(filters.from),
    detectedTo: endOfDay(filters.to),
    groupBy,
  };
  const itemId = toIdentifier(filters.itemId);
  if (itemId !== undefined) query.itemId = itemId;
  /* 계약이 질의값 이름을 `sourceAxisCode`에서 `sourceCode`로 맞췄다(응답 축과 같은 이름 · 2026-09-03). */
  if (sourceAxisCode !== '') query.sourceCode = sourceAxisCode;
  return query;
};
