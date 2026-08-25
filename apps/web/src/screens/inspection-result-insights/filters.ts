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
  finalRoundOnly: boolean;
  calibrationExpired: CalibrationFilter;
}

export interface AllowedInspectionFilterCodes {
  inspectionTypeCodes: ReadonlySet<string>;
  judgmentCodes: ReadonlySet<string>;
  inspectionTypeReady?: boolean;
  judgmentReady?: boolean;
}

export type InspectionInsightFilterState =
  | { kind: 'VALID'; filters: InspectionInsightFilters }
  | { kind: 'PENDING'; filters: InspectionInsightFilters }
  | { kind: 'INVALID'; filters: InspectionInsightFilters };

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

export const isCalendarDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const readIdentifier = (raw: string | null): string => {
  if (raw === null || !POSITIVE_INTEGER.test(raw)) return '';
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 ? raw : '';
};

export const readInspectionInsightFilters = (
  params: URLSearchParams,
  allowed: AllowedInspectionFilterCodes,
): InspectionInsightFilterState => {
  const calibration = params.get('calibration');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const type = params.get('type') ?? '';
  const judgment = params.get('judgment') ?? '';
  const inspectionTypeReady = allowed.inspectionTypeReady ?? true;
  const judgmentReady = allowed.judgmentReady ?? true;
  const rounds = params.get('rounds');
  const hasInvalidDate = [from, to].some((value) => value !== '' && !isCalendarDate(value));
  const hasUnknownCode =
    (type !== '' && inspectionTypeReady && !allowed.inspectionTypeCodes.has(type)) ||
    (judgment !== '' && judgmentReady && !allowed.judgmentCodes.has(judgment));
  const hasPendingCode =
    (type !== '' && !inspectionTypeReady) || (judgment !== '' && !judgmentReady);
  const filters: InspectionInsightFilters = {
    from: isCalendarDate(from) ? from : '',
    to: isCalendarDate(to) ? to : '',
    inspectionTypeCode:
      type !== '' && (!inspectionTypeReady || allowed.inspectionTypeCodes.has(type)) ? type : '',
    itemId: readIdentifier(params.get('item')),
    processId: readIdentifier(params.get('process')),
    overallJudgmentCode:
      judgment !== '' && (!judgmentReady || allowed.judgmentCodes.has(judgment)) ? judgment : '',
    finalRoundOnly: true,
    calibrationExpired: calibration === 'only' || calibration === 'exclude' ? calibration : '',
  };
  filters.finalRoundOnly = rounds !== 'all';
  const hasInvalidRounds = rounds !== null && rounds !== 'all';
  return {
    kind:
      hasInvalidDate || hasUnknownCode || hasInvalidRounds
        ? 'INVALID'
        : hasPendingCode
          ? 'PENDING'
          : 'VALID',
    filters,
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
