import { AlertBanner, Button, Chart, type Column, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { ManagedTable } from '../../patterns/managed-table';
import type { InspectionInsightFilters } from './filters';
import { INSPECTION_TYPE_POPULATIONS } from './inspection-type-populations';
import { useDefectRateTrend, type DefectRateTrend } from './queries';
import { usePopulationUomCode } from './uoms';

const t = messages.inspectionResultInsights.trend;
const allLabel = messages.inspectionResultInsights.summary.allTab;
/** 추이 그래프 높이(px) — 칸 폭과 상관없이 같다. */
const rate = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(value);
const CHART_HEIGHT = 240;
/**
 * 날짜 한 점이 차지하는 최소 폭(px) — 날짜가 많아 칸에 다 안 들어가면 그래프를 이만큼씩 넓히고 칸 안에서 가로로 밀어
 * 넘겨 본다(사용자 2026-11-02 「슬라이드로 볼 수 있어야」). 마지막 날짜 글자가 끝에서 잘리지 않게 오른쪽 여유를 둔다.
 */
const POINT_MIN_GAP = 110;
const CHART_END_ROOM = 48;

/** 상자의 그려진 폭(px). 시험 환경(jsdom)처럼 잴 수 없으면 0. */
const useElementWidth = (element: HTMLElement | null): number => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (element === null) return undefined;
    const measure = () => setWidth(Math.round(element.getBoundingClientRect().width));
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
  return width;
};
type TrendPoint = DefectRateTrend['points'][number];
/* 검사 결과 목록과 같은 표 — px 폭 · 끌어 폭 바꾸기 · 순서 옮기기, 값은 가운데(사용자 2026-10-30). */
const withUnit = (value: number, unit: string | null): string =>
  unit === null ? String(value) : `${String(value)} ${unit}`;
const trendColumns = (unit: string | null): Column<TrendPoint>[] => [
  { key: 'bucket', header: t.columns.bucket, align: 'center', width: '160px' },
  {
    key: 'inspectedQty',
    header: t.columns.inspectedQty,
    align: 'center',
    width: '140px',
    render: (point) => withUnit(point.inspectedQty, unit),
  },
  {
    key: 'rejectedQty',
    header: t.columns.rejectedQty,
    align: 'center',
    width: '140px',
    render: (point) => withUnit(point.rejectedQty, unit),
  },
  {
    key: 'defectRate',
    header: t.columns.defectRate,
    align: 'center',
    width: '120px',
    /* 소수 둘째 자리까지(서버 원값은 긴 소수 · 사용자 2026-11-02). */
    render: (point) => `${rate(point.defectRate)}%`,
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
  /* 수량 단위 — 한 품목이거나 결과가 모두 한 단위일 때만(uoms.ts · 사용자 2026-11-02). */
  const unit = usePopulationUomCode(filters, enabled);
  /*
   * 그래프는 칸 폭에 맞춰 그린다 — 기본 논리 폭(640)을 넓은 칸에 늘리면 글자 · 선이 함께 커져 화면을 차지했다
   * (사용자 2026-11-02). 잰 폭을 논리 폭으로 주고 높이는 고정한다.
   */
  const [chartBox, setChartBox] = useState<HTMLDivElement | null>(null);
  const chartWidth = useElementWidth(chartBox);
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
          <EmptyState size="sm" title={t.empty} />
        ) : (
          <>
            <div ref={setChartBox} className="inspection-results-trend-chart">
              <Chart
                type="line"
                title={title}
                {...(chartWidth > 0
                  ? (() => {
                      const width = Math.max(
                        chartWidth - CHART_END_ROOM,
                        trend.data.points.length * POINT_MIN_GAP,
                      );
                      return {
                        width,
                        height: CHART_HEIGHT,
                        style: { width: `${String(width)}px` },
                      };
                    })()
                  : {})}
                series={[
                  {
                    name: t.series,
                    data: trend.data.points.map((point) => ({
                      label: point.bucket,
                      value: point.defectRate,
                    })),
                  },
                ]}
                formatValue={(value) => `${rate(value)}%`}
                showPoints
              />
            </div>
            <ManagedTable
              storageKey="omf-mes:inspection-results:columns:trend"
              className="inspection-results-table"
              caption={t.caption(title)}
              columns={trendColumns(unit)}
              rows={[...trend.data.points]}
              getRowId={(point) => point.bucket}
              empty={null}
            />
          </>
        ))}
    </section>
  );
};

interface TrendPanelsProps {
  filters: InspectionInsightFilters;
  enabled: boolean;
}

export const TrendPanels = ({ filters, enabled }: TrendPanelsProps) => {
  /*
   * 요약 유형 탭을 따라 한 유형(또는 「전체」 합계)의 추이 하나만 그린다 — 유형별로 셋을 쌓지 않는다(사용자 2026-11-02).
   * 「검사유형별 추이를 분리하며…」 안내는 뺐다(사용자 2026-10-30).
   */
  return (
    <section className="inspection-results-analysis" aria-label={t.pane}>
      <TrendPanel
        filters={filters}
        label={
          INSPECTION_TYPE_POPULATIONS.find(({ code }) => code === filters.inspectionTypeCode)
            ?.label ?? allLabel
        }
        showPopulationLabel={false}
        enabled={enabled}
      />
    </section>
  );
};
