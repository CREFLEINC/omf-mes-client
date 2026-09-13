import {
  AlertBanner,
  Button,
  Chart,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { InspectionInsightFilters } from './filters';
import { toInspectionTypePopulations } from './inspection-type-populations';
import { useDefectRateTrend, type DefectRateTrend } from './queries';

const t = messages.inspectionResultInsights.trend;
type TrendPoint = DefectRateTrend['points'][number];
const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const TREND_COLUMNS: Column<TrendPoint>[] = [
  { key: 'bucket', header: t.columns.bucket },
  { key: 'inspectedQty', header: t.columns.inspectedQty, align: 'end' },
  { key: 'rejectedQty', header: t.columns.rejectedQty, align: 'end' },
  {
    key: 'defectRate',
    header: t.columns.defectRate,
    align: 'end',
    render: (point) => `${point.defectRate}%`,
  },
];

interface TrendPanelProps {
  filters: InspectionInsightFilters;
  label: string;
  showPopulationLabel: boolean;
  enabled: boolean;
}

const TrendPanel = ({ filters, label, showPopulationLabel, enabled }: TrendPanelProps) => {
  const trend = useDefectRateTrend(filters, enabled);
  const title = showPopulationLabel ? t.titlePopulation(label) : t.titlePlain;
  const errorTitle = showPopulationLabel ? t.failedPopulation(label) : t.failedPlain;

  return (
    <section className="inspection-results-trend-panel" aria-label={t.panePopulation(label)}>
      {showPopulationLabel && <h3 className="inspection-results-subtitle">{label}</h3>}
      {trend.isPending && <SkeletonText lines={3} />}
      {trend.isError && (
        <AlertBanner
          variant="error"
          title={errorTitle}
          action={
            <Button size="sm" variant="outlined" onClick={() => void trend.refetch()}>
              {t.retry}
            </Button>
          }
        />
      )}
      {!trend.isError &&
        trend.data !== undefined &&
        (trend.data.points.length === 0 ? (
          <EmptyState
            size="sm"
            title={showPopulationLabel ? t.emptyPopulation(label) : t.emptyPlain}
          />
        ) : (
          <>
            <Chart
              type="line"
              title={title}
              series={[
                {
                  name: t.series,
                  data: trend.data.points.map((point) => ({
                    label: point.bucket,
                    value: point.defectRate,
                  })),
                },
              ]}
              formatValue={(value) => `${value}%`}
              showPoints
            />
            <div className="wide-table inspection-results-table">
              <Table
                density="compact"
                caption={t.caption(title)}
                columns={TREND_COLUMNS}
                rows={[...trend.data.points]}
                getRowId={(point) => point.bucket}
              />
            </div>
          </>
        ))}
      {!trend.isError && trend.data !== undefined && (
        <p className="field-note">{t.asOf(dateTime(trend.data.asOf))}</p>
      )}
    </section>
  );
};

interface TrendPanelsProps {
  filters: InspectionInsightFilters;
  enabled: boolean;
}

export const TrendPanels = ({ filters, enabled }: TrendPanelsProps) => {
  const showPopulationLabel = filters.inspectionTypeCode === '';

  return (
    <section className="inspection-results-analysis" aria-label={t.pane}>
      {showPopulationLabel && <p className="field-note">{t.populationNote}</p>}
      {toInspectionTypePopulations(filters).map((population) => (
        <TrendPanel
          key={population.code}
          filters={population.filters}
          label={population.label}
          showPopulationLabel={showPopulationLabel}
          enabled={enabled}
        />
      ))}
    </section>
  );
};
