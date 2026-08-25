import type { InspectionInsightFilters } from './filters';

export const INSPECTION_TYPE_POPULATIONS = [
  { code: 'IQC', label: '수입검사' },
  { code: 'PQC', label: '공정검사' },
  { code: 'OQC', label: '출하검사' },
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
