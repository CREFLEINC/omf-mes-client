import { messages } from '@omf-mes/i18n';
import { useSearchParams } from 'react-router';

import { selectableLookupOptions } from '../../patterns/lookup-display';
import { InspectionInsightFilterBar } from './filter-bar';
import {
  EMPTY_INSPECTION_INSIGHT_FILTERS,
  readInspectionInsightFilters,
  readInspectionResultPage,
  readInspectionResultSort,
  type InspectionInsightFilters,
  type InspectionResultSort,
} from './filters';
import { InsightTabs } from './insight-tabs';
import type { InspectionLookup } from './lookups';
import { ResultDetailDialog } from './result-detail-dialog';
import { ResultOverview } from './result-overview';

const t = messages.inspectionResultInsights;

export interface InspectionResultLookupSources {
  inspectionType: InspectionLookup;
  item: InspectionLookup;
  process: InspectionLookup;
  judgment: InspectionLookup;
}

interface InspectionResultInsightsScreenProps {
  lookups: InspectionResultLookupSources;
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
  if (filters.finalRoundOnly) next.delete('rounds');
  else next.set('rounds', 'all');
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
  lookups,
  onViewMeasurements,
}: InspectionResultInsightsScreenProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterState = readInspectionInsightFilters(searchParams, {
    inspectionTypeCodes: new Set(lookups.inspectionType.entries.map(({ value }) => value)),
    judgmentCodes: new Set(lookups.judgment.entries.map(({ value }) => value)),
    inspectionTypeReady:
      !lookups.inspectionType.isLoading &&
      !lookups.inspectionType.isError &&
      !lookups.inspectionType.truncated,
    judgmentReady:
      !lookups.judgment.isLoading && !lookups.judgment.isError && !lookups.judgment.truncated,
  });
  const filters = filterState.filters;
  const queriesEnabled = filterState.kind === 'VALID';
  const insightsReady = queriesEnabled && filters.from !== '' && filters.to !== '';
  const options = {
    inspectionType: selectableLookupOptions(lookups.inspectionType, filters.inspectionTypeCode),
    item: selectableLookupOptions(lookups.item, filters.itemId),
    process: selectableLookupOptions(lookups.process, filters.processId),
    judgment: selectableLookupOptions(lookups.judgment, filters.overallJudgmentCode),
  };
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
    <section className="inspection-results-workspace" aria-label={t.title}>
      <section className="pane inspection-results-pane" aria-label={t.filter.pane}>
        <h2 className="pane-title">{t.filter.paneTitle}</h2>
        <InspectionInsightFilterBar
          appliedFilters={filters}
          options={options}
          onSearch={(next) => setSearchParams((current) => withFilters(current, next))}
          onReset={() =>
            setSearchParams((current) => withFilters(current, EMPTY_INSPECTION_INSIGHT_FILTERS))
          }
        />
      </section>
      <ResultOverview
        filters={filters}
        queriesEnabled={queriesEnabled}
        validationPending={filterState.kind === 'PENDING'}
        sort={sort}
        page={page}
        labels={{ item: lookups.item, judgment: lookups.judgment }}
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
      <section
        className={`pane inspection-results-pane inspection-results-insights-pane${insightsReady ? '' : ' inspection-results-insights-pane-empty'}`}
        aria-label={t.tabs.pane}
      >
        <h2 className="pane-title">{t.tabs.paneTitle}</h2>
        {!insightsReady && <p className="field-note">{t.tabs.notReady}</p>}
        <InsightTabs
          filters={filters}
          sourceAxisCode={filters.inspectionTypeCode}
          queriesEnabled={queriesEnabled}
        />
      </section>
      {queriesEnabled && selected !== null && (
        <ResultDetailDialog
          inspectionResultId={selected}
          labels={{ item: lookups.item, judgment: lookups.judgment }}
          onClose={() => update('selected', null, false)}
          onViewMeasurements={onViewMeasurements}
        />
      )}
    </section>
  );
};
