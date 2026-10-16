import { LineChart, Skeleton, type ReferenceLine } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import {
  formatFigure,
  toChartMax,
  toNiceAxis,
  type DashboardTrendPointView,
  type DashboardTrendView,
} from './types';
import { useChartWidth } from './use-chart-width';
import { EmptyLine } from './viz';

const t = messages.dashboard;

/** 차트 높이. 겹쳐 그리는 점 자리(`PointTips`)가 같은 값을 쓴다. */
const CHART_HEIGHT = 220;

/**
 * DS LineChart 의 그림 여백(라이브러리 내부 값 — top 16 · right 16 · bottom 32 · left 40). 점 위치를 같은 식으로
 * 다시 계산하려고 옮겨 둔다. DS 가 이 값을 바꾸면 툴팁 자리가 어긋난다 — 그때 여기를 맞춘다.
 */
const DS_CHART_PAD = { top: 16, right: 16, bottom: 32, left: 40 } as const;

/** 툴팁이 그래프 좌우 끝에서 잘리지 않게 붙일 기준 — 점이 끝에서 이만큼 안쪽이면 그쪽 끝에 붙인다. */
const TIP_EDGE_PX = 80;

/** 점 위치(그림 안 px). DS 차트와 같은 식 — x 는 칸을 고르게, y 는 0~상한을 위아래로. */
export const toPointPositions = (
  points: readonly DashboardTrendPointView[],
  width: number,
  max: number,
): { x: number; y: number }[] => {
  const plotW = width - DS_CHART_PAD.left - DS_CHART_PAD.right;
  const top = DS_CHART_PAD.top;
  const bottom = CHART_HEIGHT - DS_CHART_PAD.bottom;
  const min = Math.min(0, ...points.map((point) => point.value));
  const span = max - min || 1;

  return points.map((point, index) => ({
    x:
      points.length <= 1
        ? DS_CHART_PAD.left
        : DS_CHART_PAD.left + (index / (points.length - 1)) * plotW,
    y: bottom - ((point.value - min) / span) * (bottom - top),
  }));
};

/**
 * 점 툴팁(⭐ 사용자 결정 2026-10-16) — DS 차트는 그대로 두고 그 위에 날짜 칸마다 투명한 단추를 겹친다.
 * 마우스 올림 · 키보드 포커스로 보이고, 누르면(터치 탭) 고정되며 다른 곳을 누르면 닫힌다. 내용은 날짜 ·
 * 정확한 생산량(천 단위 · 단위). 그래프 좌우 끝에서는 말풍선을 안쪽으로 붙이고, 위쪽 점은 아래로 연다.
 */
const PointTips = ({
  points,
  width,
  max,
  unit,
}: {
  points: readonly DashboardTrendPointView[];
  width: number;
  max: number;
  unit: string | null;
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const shown = hovered ?? pinned;

  useEffect(() => {
    if (pinned === null) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node) || layerRef.current?.contains(event.target) !== true) {
        setPinned(null);
        setHovered(null);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [pinned]);

  const positions = toPointPositions(points, width, max);
  const slot =
    points.length <= 1
      ? width
      : (width - DS_CHART_PAD.left - DS_CHART_PAD.right) / (points.length - 1);
  const textOf = (point: DashboardTrendPointView): string =>
    [point.label, `${formatFigure(point.value)}${unit === null ? '' : ` ${unit}`}`].join(' · ');

  const active = shown === null ? undefined : points[shown];
  const at = shown === null ? undefined : positions[shown];

  return (
    <div ref={layerRef} className="dash-trend-tips" style={{ width, height: CHART_HEIGHT }}>
      {points.map((point, index) => {
        const position = positions[index];
        if (position === undefined) return null;

        return (
          <button
            key={point.label}
            type="button"
            className="dash-trend-hit"
            style={{
              left: position.x - slot / 2,
              width: slot,
              top: DS_CHART_PAD.top,
              height: CHART_HEIGHT - DS_CHART_PAD.top - DS_CHART_PAD.bottom,
            }}
            aria-label={textOf(point)}
            onMouseEnter={() => {
              setHovered(index);
            }}
            onMouseLeave={() => {
              setHovered(null);
            }}
            onFocus={() => {
              setHovered(index);
            }}
            onBlur={() => {
              setHovered(null);
            }}
            onClick={() => {
              setPinned((current) => (current === index ? null : index));
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setHovered(null);
                setPinned(null);
              }
            }}
          />
        );
      })}
      {active !== undefined && at !== undefined && (
        <>
          <span className="dash-trend-ring" style={{ left: at.x, top: at.y }} aria-hidden="true" />
          <span
            role="tooltip"
            className={[
              'dash-trend-tip',
              at.x < TIP_EDGE_PX ? 'dash-trend-tip-start' : '',
              at.x > width - TIP_EDGE_PX ? 'dash-trend-tip-end' : '',
              at.y < 56 ? 'dash-trend-tip-below' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: at.x, top: at.y }}
          >
            {textOf(active)}
          </span>
        </>
      )}
    </div>
  );
};

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

  const dataMax = Math.max(...view.points.map((point) => point.value));
  const axis = toNiceAxis(toChartMax(view.points, view.targetValue) ?? dataMax);
  /* DS 차트가 실제로 쓰는 상한 — 상한을 넘기지 않으면 데이터 최대값(0이면 1). */
  const chartMax = axis?.max ?? (dataMax > 0 ? dataMax : 1);

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
        /* 목표가 실적보다 높으면 눈금을 목표까지 넓힌다 — 넓히지 않으면 목표선이 그림 밖에 그어진다. */
        max={axis?.max}
        yTicks={axis?.ticks}
        referenceLines={referenceLines}
        formatValue={formatFigure}
        /*
         * 기본 비율(640×320)은 폭이 넓은 페인에서 **그래프 하나가 화면 한 판을 먹는다** — 브라우저
         * 확인에서 550px가 넘었다. 세로를 낮춰 납작하게 둔다: 추이는 「올랐나 내렸나」를 보는
         * 그림이라 세로로 키운다고 더 읽히지 않는다.
         */
        width={chartWidth}
        height={CHART_HEIGHT}
        showPoints
        /* 시리즈가 하나뿐이라 범례는 같은 이름을 한 번 더 적을 뿐이다. */
        showLegend={false}
      />
      <PointTips points={view.points} width={chartWidth} max={chartMax} unit={view.unit} />
    </div>
  );
};
