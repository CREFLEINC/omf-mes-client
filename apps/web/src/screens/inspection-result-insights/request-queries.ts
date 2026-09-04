import type { paths } from '@omf-mes/api-client';

import {
  isCalendarDate,
  type InspectionInsightFilters,
  type InspectionResultSort,
} from './filters';

export type InspectionListQuery = NonNullable<
  NonNullable<paths['/quality/inspection-results']['get']>['parameters']['query']
>;
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

export const toInspectionListQuery = (
  filters: InspectionInsightFilters,
  sort: InspectionResultSort,
  page: number,
): InspectionListQuery | null => {
  const common = toCommonQuery(filters, false);
  if (common === null) return null;
  const query: InspectionListQuery = { ...common, sort };
  if (Number.isSafeInteger(page) && page > 1) query.page = page;
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
