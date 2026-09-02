import { EmptyState, LineChart, Skeleton, type ReferenceLine } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatFigure, toChartMax, type DashboardTrendView } from './types';

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
  if (isLoading) return <Skeleton variant="rect" height="16rem" />;

  if (view === null) {
    return <EmptyState size="sm" live title={t.trend.emptyTitle} description={t.trend.absent} />;
  }

  if (view.points.length === 0) {
    return <EmptyState size="sm" live title={t.trend.emptyTitle} description={t.trend.empty} />;
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
       * 그림이라 세로로 키운다고 더 읽히지 않고, 아래 알람 구획이 접히지 않고 함께 보이는 것이 낫다.
       */
      height={220}
      showPoints
      /* 시리즈가 하나뿐이라 범례는 같은 이름을 한 번 더 적을 뿐이다. */
      showLegend={false}
    />
  );
};
