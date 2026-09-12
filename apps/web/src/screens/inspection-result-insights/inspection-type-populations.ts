import { messages } from '@omf-mes/i18n';

import type { InspectionInsightFilters } from './filters';

const t = messages.inspectionResultInsights.inspectionTypes;

export const INSPECTION_TYPE_POPULATIONS = [
  { code: 'IQC', label: t.IQC },
  { code: 'PQC', label: t.PQC },
  { code: 'OQC', label: t.OQC },
] as const;

export interface InspectionTypePopulation {
  code: string;
  label: string;
  filters: InspectionInsightFilters;
}

export const toInspectionTypePopulations = (
  filters: InspectionInsightFilters,
): InspectionTypePopulation[] => {
  if (filters.inspectionTypeCode !== '') {
    return [
      {
        code: filters.inspectionTypeCode,
        label:
          INSPECTION_TYPE_POPULATIONS.find(({ code }) => code === filters.inspectionTypeCode)
            ?.label ?? filters.inspectionTypeCode,
        filters,
      },
    ];
  }

  return INSPECTION_TYPE_POPULATIONS.map(({ code, label }) => ({
    code,
    label,
    filters: { ...filters, inspectionTypeCode: code },
  }));
};
