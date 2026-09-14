import { AlertBanner, Button, SkeletonText, StatCard } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { InspectionInsightFilters } from './filters';
import { toInspectionTypePopulations } from './inspection-type-populations';
import { useInspectionSummary, type InspectionSummary } from './queries';

const t = messages.inspectionResultInsights.summary;
const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const number = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);

interface SummaryPanelProps {
  filters: InspectionInsightFilters;
  label: string;
  showPopulationLabel: boolean;
  queriesEnabled: boolean;
  onViewExpiredCalibration: () => void;
}

const SummaryPanel = ({
  filters,
  label,
  showPopulationLabel,
  queriesEnabled,
  onViewExpiredCalibration,
}: SummaryPanelProps) => {
  const summary = useInspectionSummary(filters, queriesEnabled);
  const cards =
    summary.data === undefined
      ? []
      : ([
          [t.inspectionCount, summary.data.inspectionCount, t.inspectionCountUnit],
          [t.inspectedQty, summary.data.inspectedQty, ''],
          [t.acceptedQty, summary.data.acceptedQty, ''],
          [t.rejectedQty, summary.data.rejectedQty, ''],
          [t.defectRate, summary.data.defectRate, t.defectRateUnit],
        ] as const satisfies ReadonlyArray<readonly [string, number, string]>);

  return (
    <section className="inspection-results-summary-panel" aria-label={t.pane(label)}>
      {showPopulationLabel && <h3 className="inspection-results-subtitle">{label}</h3>}
      {summary.isPending && <SkeletonText lines={1} />}
      {summary.isError && (
        <AlertBanner
          variant="error"
          title={t.failed(label)}
          action={
            <Button size="sm" variant="outlined" onClick={() => void summary.refetch()}>
              {t.retry}
            </Button>
          }
        />
      )}
      {!summary.isError && summary.data !== undefined && (
        <>
          <div
            className="inspection-results-stat-grid"
            role="group"
            aria-label={showPopulationLabel ? t.cards(label) : t.cardsPlain}
          >
            {cards.map(([cardLabel, value, unit]) => (
              <StatCard key={cardLabel} label={cardLabel} value={number(value)} unit={unit} />
            ))}
          </div>
          <p className="field-note">{t.asOf(dateTime(summary.data.asOf))}</p>
          <p className="field-note">{t.defectRateNote}</p>
          {filters.calibrationExpired === '' && (summary.data.calibrationExpiredCount ?? 0) > 0 && (
            <AlertBanner
              variant="warning"
              title={t.calibrationExpiredIncluded(label, summary.data.calibrationExpiredCount ?? 0)}
              action={
                <Button size="sm" variant="outlined" onClick={onViewExpiredCalibration}>
                  {t.viewCalibrationExpired}
                </Button>
              }
            >
              {t.calibrationExpiredDetail}
            </AlertBanner>
          )}
        </>
      )}
    </section>
  );
};

interface SummaryPanelsProps {
  filters: InspectionInsightFilters;
  queriesEnabled: boolean;
  onViewExpiredCalibration: () => void;
}

export const SummaryPanels = ({
  filters,
  queriesEnabled,
  onViewExpiredCalibration,
}: SummaryPanelsProps) => {
  const showPopulationLabel = filters.inspectionTypeCode === '';

  return (
    <>
      {showPopulationLabel && <p className="field-note">{t.populationNote}</p>}
      {toInspectionTypePopulations(filters).map((population) => (
        <SummaryPanel
          key={population.code}
          filters={population.filters}
          label={population.label}
          showPopulationLabel={showPopulationLabel}
          queriesEnabled={queriesEnabled}
          onViewExpiredCalibration={onViewExpiredCalibration}
        />
      ))}
    </>
  );
};
