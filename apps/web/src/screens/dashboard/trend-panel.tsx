import { LineChart, Skeleton, type ReferenceLine } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatFigure, toChartMax, type DashboardTrendView } from './types';
import { useChartWidth } from './use-chart-width';
import { EmptyLine } from './viz';

const t = messages.dashboard;

export interface TrendPanelProps {
  view: DashboardTrendView | null;
  isLoading: boolean;
}

/**
 * 일일 생산실적 추이.
 *
 * ⭐ **목표선을 디자인 시스템 차트가 그린다**(`referenceLines`) — 목표 대비를 조합으로 만들지
 * 않는다. 목표가 오지 않으면 **선을 긋지 않는다**: 0을 목표로 삼아 바닥에 선을 그으면 모든
 * 날이 목표를 넘긴 것으로 보인다.
 *
 * ⚠ **「추이가 오지 않았다」와 「점이 없다」를 가른다.** 계약이 추이를 선택 항목으로 두어 응답에
 * 아예 없을 수 있는데, 그것을 빈 그래프로 그리면 사용자가 「생산이 0이었다」로 읽는다.
 *
 * 대체 표(`showTable`)는 기본값 그대로 둔다 — 시각으로 읽지 못하는 사람에게 이 그래프의 값이
 * 닿는 유일한 길이다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const TrendPanel = ({ view, isLoading }: TrendPanelProps) => {
  /* 실제 폭으로 그린다 — 그림을 줄이면 좁은 폭에서 축 글자가 8px 까지 작아졌다(원칙 d). */
  const [chartRef, chartWidth] = useChartWidth<HTMLDivElement>(640);
  if (isLoading) return <Skeleton variant="rect" height="16rem" />;

  if (view === null) {
    return <EmptyLine live text={t.trend.absent} />;
  }

  if (view.points.length === 0) {
    return <EmptyLine live text={t.trend.empty} />;
  }

  const referenceLines: ReferenceLine[] =
    view.targetValue === null
      ? []
      : [
          {
            value: view.targetValue,
            axis: 'y',
            label: t.trend.target,
            style: 'dashed',
            tone: 'info',
          },
        ];

  return (
    /*
     * 축 글자 자리 — DS 차트는 y축 글자를 고정 위치(x=32)에서 끝맞춤으로 그리고 그림 밖을 자른다. 96,000 같은
     * 큰 값은 앞자리가 잘려 「6,000」으로 읽혔다(사용자 보고 2026-10-16). 값은 그대로 두고 그림 왼쪽에
     * 여백을 주어 넘친 글자가 보이게 한다(`.dash-trend`).
     */
    <div className="dash-trend" ref={chartRef}>
      <LineChart
        series={[
          {
            name: view.seriesName ?? t.panes.trend,
            data: view.points.map((point) => ({ label: point.label, value: point.value })),
          },
        ]}
        caption={view.unit === null ? undefined : t.trend.unitSuffix(view.unit)}
        /* 목표가 실적보다 높으면 눈금을 목표까지 넓힌다 — 넓히지 않으면 목표선이 그림 밖에 그어진다. */
        max={toChartMax(view.points, view.targetValue)}
        referenceLines={referenceLines}
        formatValue={formatFigure}
        /*
         * 기본 비율(640×320)은 폭이 넓은 페인에서 **그래프 하나가 화면 한 판을 먹는다** — 브라우저
         * 확인에서 550px가 넘었다. 세로를 낮춰 납작하게 둔다: 추이는 「올랐나 내렸나」를 보는
         * 그림이라 세로로 키운다고 더 읽히지 않는다.
         */
        width={chartWidth}
        height={220}
        showPoints
        /* 시리즈가 하나뿐이라 범례는 같은 이름을 한 번 더 적을 뿐이다. */
        showLegend={false}
      />
    </div>
  );
};
