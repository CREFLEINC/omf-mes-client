import type { paths } from '@omf-mes/api-client';

import type { InspectionInsightFilters, InspectionResultSort } from './filters';

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

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const toIdentifier = (raw: string): number | undefined => {
  if (!/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? value : undefined;
};

const hasValidPopulation = (filters: InspectionInsightFilters): boolean =>
  filters.inspectionTypeCode !== '' &&
  DATE.test(filters.from) &&
  DATE.test(filters.to) &&
  filters.from <= filters.to;

const toCommonQuery = (filters: InspectionInsightFilters): InspectionSummaryQuery | null => {
  if (!hasValidPopulation(filters)) return null;
  const query: InspectionSummaryQuery = {
    inspectionTypeCode: filters.inspectionTypeCode,
    inspectedFrom: filters.from,
    inspectedTo: filters.to,
    finalRoundOnly: true,
  };
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
): InspectionSummaryQuery | null => toCommonQuery(filters);

export const toDefectRateTrendQuery = (
  filters: InspectionInsightFilters,
): DefectRateTrendQuery | null => toCommonQuery(filters);

export const toInspectionListQuery = (
  filters: InspectionInsightFilters,
  sort: InspectionResultSort,
  page: number,
): InspectionListQuery | null => {
  const common = toCommonQuery(filters);
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
  if (!hasValidPopulation(filters)) return null;
  const query: DefectDistributionQuery = {
    detectedFrom: filters.from,
    detectedTo: filters.to,
    groupBy,
  };
  const itemId = toIdentifier(filters.itemId);
  if (itemId !== undefined) query.itemId = itemId;
  if (sourceAxisCode !== '') query.sourceAxisCode = sourceAxisCode;
  return query;
};
