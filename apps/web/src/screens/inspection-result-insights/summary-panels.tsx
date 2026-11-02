import { AlertBanner, Button, SkeletonText, StatCard, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { InspectionInsightFilters } from './filters';
import { toInspectionTypePopulations } from './inspection-type-populations';
import { useInspectionSummary, type InspectionSummary } from './queries';
import { usePopulationUomCode } from './uoms';

const t = messages.inspectionResultInsights.summary;
const number = (value: number): string => new Intl.NumberFormat('ko-KR').format(value);
/* 불량률은 소수 둘째 자리까지(사용자 2026-11-02). */
const rate = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);

interface SummaryPanelProps {
  filters: InspectionInsightFilters;
  label: string;
  showPopulationLabel: boolean;
  queriesEnabled: boolean;
  onViewExpiredCalibration: () => void;
  /** 유형 탭 안이면 탭이 이름을 말하므로 제목을 세우지 않는다. */
  showTitle?: boolean;
}

const SummaryPanel = ({
  filters,
  label,
  showPopulationLabel,
  showTitle = true,
  queriesEnabled,
  onViewExpiredCalibration,
}: SummaryPanelProps) => {
  const summary = useInspectionSummary(filters, queriesEnabled);
  /* 수량 단위 — 한 품목이거나 결과가 모두 한 단위일 때만(섞이면 수량만 · uoms.ts). */
  const qtyUnit = usePopulationUomCode(filters, queriesEnabled) ?? '';
  /* 합격 수량은 초록, 불합격 수량은 빨강(2026-10-30 시안). */
  const cards =
    summary.data === undefined
      ? []
      : ([
          [t.inspectionCount, summary.data.inspectionCount, t.inspectionCountUnit, undefined],
          [t.inspectedQty, summary.data.inspectedQty, qtyUnit, undefined],
          [t.acceptedQty, summary.data.acceptedQty, qtyUnit, 'success'],
          [t.rejectedQty, summary.data.rejectedQty, qtyUnit, 'error'],
          [t.defectRate, summary.data.defectRate, t.defectRateUnit, undefined],
        ] as const satisfies ReadonlyArray<
          readonly [string, number, string, 'success' | 'error' | undefined]
        >);

  return (
    <section className="inspection-results-summary-panel" aria-label={t.pane(label)}>
      {/* 「기준 …」 시각은 뺐다 — 화면 위 「마지막 갱신」이 대신한다(사용자 2026-10-30). */}
      {showPopulationLabel && showTitle && <h3 className="inspection-results-subtitle">{label}</h3>}
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
            {cards.map(([cardLabel, value, unit, tone]) => (
              <StatCard
                key={cardLabel}
                label={cardLabel}
                value={
                  tone === undefined ? (
                    cardLabel === t.defectRate ? (
                      rate(value)
                    ) : (
                      number(value)
                    )
                  ) : (
                    <span className="inspection-results-stat-value" data-tone={tone}>
                      {number(value)}
                    </span>
                  )
                }
                unit={unit}
              />
            ))}
          </div>
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

/** 요약 유형 탭의 「전체」(수입 · 공정 · 출하 합계) 값. */
export const SUMMARY_ALL = 'ALL';

interface SummaryPanelsProps {
  filters: InspectionInsightFilters;
  queriesEnabled: boolean;
  onViewExpiredCalibration: () => void;
  /** 고른 유형 탭(SUMMARY_ALL · IQC · PQC · OQC) — 불량 분석이 같은 탭을 따른다(사용자 2026-11-02). */
  activeType: string;
  onActiveTypeChange: (type: string) => void;
}

export const SummaryPanels = ({
  filters,
  queriesEnabled,
  onViewExpiredCalibration,
  activeType,
  onActiveTypeChange,
}: SummaryPanelsProps) => {
  const showPopulationLabel = filters.inspectionTypeCode === '';
  const populations = toInspectionTypePopulations(filters);
  /* 맨 앞 「전체」 — 유형을 비워 서버 합계를 받는다(합계 불량률 포함 · 사용자 2026-11-02 결정). */
  const tabPopulations = [{ code: SUMMARY_ALL, label: t.allTab, filters }, ...populations];
  const shown =
    tabPopulations.find((population) => population.code === activeType) ?? tabPopulations[0];

  /* 한 유형만 보면 탭 없이 그 요약 하나(유형 분리 안내는 빼고 불량률 분모 안내는 「집계 기준」 말풍선 · 사용자 2026-10-30). */
  if (!showPopulationLabel || shown === undefined) {
    return (
      <>
        {populations.map((population) => (
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
  }

  /* 「전체」면 [전체 · 수입 · 공정 · 출하]를 탭으로 — 상자 셋을 늘어놓지 않는다(사용자 2026-10-30). 고른 탭의 요약만 부른다. */
  return (
    <Tabs
      aria-label={t.typeTabs}
      value={shown.code}
      onChange={onActiveTypeChange}
      items={tabPopulations.map((population) => ({
        value: population.code,
        label: population.label,
        content:
          population.code === shown.code ? (
            <SummaryPanel
              filters={population.filters}
              label={population.label}
              showPopulationLabel
              showTitle={false}
              queriesEnabled={queriesEnabled}
              onViewExpiredCalibration={onViewExpiredCalibration}
            />
          ) : null,
      }))}
    />
  );
};
