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
    inspectedFrom: filters.from,
    inspectedTo: filters.to,
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
  sourceCode: string,
): DefectDistributionQuery | null => {
  if (!hasValidPeriod(filters)) return null;
  const query: DefectDistributionQuery = {
    detectedFrom: filters.from,
    detectedTo: filters.to,
    groupBy,
  };
  const itemId = toIdentifier(filters.itemId);
  if (itemId !== undefined) query.itemId = itemId;
  if (sourceCode !== '') query.sourceCode = sourceCode;
  return query;
};
