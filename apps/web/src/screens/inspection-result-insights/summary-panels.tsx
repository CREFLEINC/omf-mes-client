import { AlertBanner, Button, SkeletonText, StatCard } from '@crefle/web-ui';

import type { InspectionInsightFilters } from './filters';
import { toInspectionTypePopulations } from './inspection-type-populations';
import { useInspectionSummary, type InspectionSummary } from './queries';

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
          ['검사건수', summary.data.inspectionCount, '건'],
          ['검사수량', summary.data.inspectedQty, ''],
          ['합격수량', summary.data.acceptedQty, ''],
          ['불합격수량', summary.data.rejectedQty, ''],
          ['불량률', summary.data.defectRate, '%'],
        ] as const satisfies ReadonlyArray<readonly [string, number, string]>);

  return (
    <section aria-label={`${label} 검사실적 요약`}>
      {showPopulationLabel && <h3>{label}</h3>}
      {summary.isPending && <SkeletonText lines={1} />}
      {summary.isError && (
        <AlertBanner
          variant="error"
          title={`${label} 요약을 불러오지 못했습니다.`}
          action={
            <Button size="sm" variant="outlined" onClick={() => void summary.refetch()}>
              다시 시도
            </Button>
          }
        />
      )}
      {!summary.isError && summary.data !== undefined && (
        <>
          <div
            className="filter-bar"
            role="group"
            aria-label={showPopulationLabel ? `${label} 검사실적 요약 카드` : '검사실적 요약 카드'}
          >
            {cards.map(([cardLabel, value, unit]) => (
              <StatCard key={cardLabel} label={cardLabel} value={number(value)} unit={unit} />
            ))}
          </div>
          <p className="field-note">기준 {dateTime(summary.data.asOf)}</p>
          <p className="field-note">불량률의 분모는 검사수량이며 생산 수율과 다를 수 있습니다.</p>
          {filters.calibrationExpired === '' && (summary.data.calibrationExpiredCount ?? 0) > 0 && (
            <AlertBanner
              variant="warning"
              title={`${label} 검교정 만료 장비 측정 건수 ${summary.data.calibrationExpiredCount}건이 기본 집계에 포함되어 있습니다.`}
              action={
                <Button size="sm" variant="outlined" onClick={onViewExpiredCalibration}>
                  검교정 만료만 분리해 보기
                </Button>
              }
            >
              기본 조회는 검교정 만료 장비로 측정된 건을 자동 제외하지 않습니다.
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
      {showPopulationLabel && (
        <p className="field-note">검사유형별 요약을 분리하며 서로 합산하지 않습니다.</p>
      )}
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
