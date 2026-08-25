export type InspectionResultSort =
  | 'inspectionRequestNo,asc'
  | 'inspectionRequestNo,desc'
  | 'inspectedAt,asc'
  | 'inspectedAt,desc'
  | 'rejectedQty,asc'
  | 'rejectedQty,desc';

export type CalibrationFilter = '' | 'only' | 'exclude';

export interface InspectionInsightFilters {
  from: string;
  to: string;
  inspectionTypeCode: string;
  itemId: string;
  processId: string;
  overallJudgmentCode: string;
  finalRoundOnly: true;
  calibrationExpired: CalibrationFilter;
}

export const DEFAULT_INSPECTION_RESULT_SORT: InspectionResultSort = 'inspectedAt,desc';

export const EMPTY_INSPECTION_INSIGHT_FILTERS: InspectionInsightFilters = {
  from: '',
  to: '',
  inspectionTypeCode: '',
  itemId: '',
  processId: '',
  overallJudgmentCode: '',
  finalRoundOnly: true,
  calibrationExpired: '',
};

const SORTS: readonly InspectionResultSort[] = [
  'inspectionRequestNo,asc',
  'inspectionRequestNo,desc',
  'inspectedAt,asc',
  'inspectedAt,desc',
  'rejectedQty,asc',
  'rejectedQty,desc',
];
const POSITIVE_INTEGER = /^\d+$/;

const readIdentifier = (raw: string | null): string => {
  if (raw === null || !POSITIVE_INTEGER.test(raw)) return '';
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? raw : '';
};

export const readInspectionInsightFilters = (params: URLSearchParams): InspectionInsightFilters => {
  const calibration = params.get('calibration');
  return {
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    inspectionTypeCode: params.get('type') ?? '',
    itemId: readIdentifier(params.get('item')),
    processId: readIdentifier(params.get('process')),
    overallJudgmentCode: params.get('judgment') ?? '',
    finalRoundOnly: true,
    calibrationExpired: calibration === 'only' || calibration === 'exclude' ? calibration : '',
  };
};

export const readInspectionResultSort = (params: URLSearchParams): InspectionResultSort =>
  SORTS.find((sort) => sort === params.get('sort')) ?? DEFAULT_INSPECTION_RESULT_SORT;

export const readInspectionResultPage = (params: URLSearchParams): number => {
  const raw = params.get('page');
  if (raw === null || !POSITIVE_INTEGER.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
};
