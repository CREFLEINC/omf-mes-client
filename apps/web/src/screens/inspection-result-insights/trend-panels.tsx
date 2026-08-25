import {
  AlertBanner,
  Button,
  Chart,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';

import type { InspectionInsightFilters } from './filters';
import { toInspectionTypePopulations } from './inspection-type-populations';
import { useDefectRateTrend, type DefectRateTrend } from './queries';

type TrendPoint = DefectRateTrend['points'][number];
const dateTime = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};
const TREND_COLUMNS: Column<TrendPoint>[] = [
  { key: 'bucket', header: '일자' },
  { key: 'inspectedQty', header: '검사수량', align: 'end' },
  { key: 'rejectedQty', header: '불합격수량', align: 'end' },
  {
    key: 'defectRate',
    header: '불량률',
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
  const title = showPopulationLabel ? `${label} 불량률 추이` : '불량률 추이';
  const errorTitle = showPopulationLabel
    ? `${label} 불량률 추이를 불러오지 못했습니다.`
    : '불량률 추이를 불러오지 못했습니다.';

  return (
    <section aria-label={`${label} 불량률 추이 결과`}>
      {showPopulationLabel && <h3>{label}</h3>}
      {trend.isPending && <SkeletonText lines={3} />}
      {trend.isError && (
        <AlertBanner
          variant="error"
          title={errorTitle}
          action={
            <Button size="sm" variant="outlined" onClick={() => void trend.refetch()}>
              다시 시도
            </Button>
          }
        />
      )}
      {!trend.isError &&
        trend.data !== undefined &&
        (trend.data.points.length === 0 ? (
          <EmptyState
            size="sm"
            title={
              showPopulationLabel ? `${label} 추이 데이터가 없습니다` : '추이 데이터가 없습니다'
            }
          />
        ) : (
          <>
            <Chart
              type="line"
              title={title}
              series={[
                {
                  name: '불량률',
                  data: trend.data.points.map((point) => ({
                    label: point.bucket,
                    value: point.defectRate,
                  })),
                },
              ]}
              formatValue={(value) => `${value}%`}
              showPoints
            />
            <Table
              density="compact"
              caption={`${title} 데이터`}
              columns={TREND_COLUMNS}
              rows={[...trend.data.points]}
              getRowId={(point) => point.bucket}
            />
          </>
        ))}
      {!trend.isError && trend.data !== undefined && (
        <p className="field-note">기준 {dateTime(trend.data.asOf)}</p>
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
    <section aria-label="불량률 추이 결과">
      {showPopulationLabel && (
        <p className="field-note">검사유형별 추이를 분리하며 서로 합산하지 않습니다.</p>
      )}
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
