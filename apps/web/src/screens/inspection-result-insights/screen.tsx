import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { InspectionInsightFilterBar, type InspectionFilterOptions } from './filter-bar';
import {
  EMPTY_INSPECTION_INSIGHT_FILTERS,
  readInspectionInsightFilters,
  readInspectionResultPage,
  readInspectionResultSort,
  type InspectionInsightFilters,
  type InspectionResultSort,
} from './filters';
import { InsightTabs } from './insight-tabs';
import { ResultDetailDialog } from './result-detail-dialog';
import { ResultOverview, type ResultLabels } from './result-overview';

interface InspectionResultInsightsScreenProps {
  options: InspectionFilterOptions;
  labels: ResultLabels;
  sourceAxisCode: string;
  onViewMeasurements: (inspectionResultId: number) => void;
}

const FILTER_KEYS = [
  ['from', 'from'],
  ['to', 'to'],
  ['inspectionTypeCode', 'type'],
  ['itemId', 'item'],
  ['processId', 'process'],
  ['overallJudgmentCode', 'judgment'],
  ['calibrationExpired', 'calibration'],
] as const;

const withFilters = (
  current: URLSearchParams,
  filters: InspectionInsightFilters,
): URLSearchParams => {
  const next = new URLSearchParams(current);
  for (const [field, key] of FILTER_KEYS) {
    const value = filters[field];
    if (value === '') next.delete(key);
    else next.set(key, value);
  }
  next.delete('page');
  next.delete('selected');
  return next;
};

const selectedResult = (params: URLSearchParams): number | null => {
  const raw = params.get('selected');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id >= 1 ? id : null;
};

export const InspectionResultInsightsScreen = ({
  options,
  labels,
  sourceAxisCode,
  onViewMeasurements,
}: InspectionResultInsightsScreenProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed = useMemo(
    () => ({
      inspectionTypeCodes: new Set(options.inspectionType.map(({ value }) => value)),
      judgmentCodes: new Set(options.judgment.map(({ value }) => value)),
    }),
    [options.inspectionType, options.judgment],
  );
  const filterState = useMemo(
    () => readInspectionInsightFilters(searchParams, allowed),
    [allowed, searchParams],
  );
  const filters = filterState.filters;
  const queriesEnabled = filterState.kind === 'VALID';
  const sort = readInspectionResultSort(searchParams);
  const page = readInspectionResultPage(searchParams);
  const selected = selectedResult(searchParams);
  const update = (key: string, value: string | null, clearSelection = true): void => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (value === null) next.delete(key);
      else next.set(key, value);
      if (clearSelection) next.delete('selected');
      return next;
    });
  };

  return (
    <section aria-label="검사실적·검사결과 조회">
      <InspectionInsightFilterBar
        appliedFilters={filters}
        options={options}
        onSearch={(next) => setSearchParams((current) => withFilters(current, next))}
        onReset={() =>
          setSearchParams((current) => withFilters(current, EMPTY_INSPECTION_INSIGHT_FILTERS))
        }
      />
      <ResultOverview
        filters={filters}
        queriesEnabled={queriesEnabled}
        sort={sort}
        page={page}
        labels={labels}
        onSortChange={(next: InspectionResultSort) => {
          setSearchParams((current) => {
            const params = new URLSearchParams(current);
            params.set('sort', next);
            params.delete('page');
            params.delete('selected');
            return params;
          });
        }}
        onPageChange={(next) => update('page', String(next))}
        onSelectResult={(id) => update('selected', String(id), false)}
        onViewExpiredCalibration={() =>
          setSearchParams((current) =>
            withFilters(current, { ...filters, calibrationExpired: 'only' }),
          )
        }
      />
      <InsightTabs
        filters={filters}
        sourceAxisCode={sourceAxisCode}
        queriesEnabled={queriesEnabled}
      />
      {queriesEnabled && selected !== null && (
        <ResultDetailDialog
          inspectionResultId={selected}
          labels={labels}
          onClose={() => update('selected', null, false)}
          onViewMeasurements={onViewMeasurements}
        />
      )}
    </section>
  );
};
