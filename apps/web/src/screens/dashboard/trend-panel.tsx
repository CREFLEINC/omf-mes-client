import { LineChart, Skeleton, type ReferenceLine } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

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

/** 날짜 이름표 하나에 줄 폭(px) — 「10-14」 글자 폭 + 사이 여백. */
const AXIS_LABEL_SLOT_PX = 56;

/**
 * 날짜 이름표를 몇 개마다 하나씩 보일지(기간 조회 2026-10-16 — 점은 최대 92개). 그림 폭에 들어가는 만큼만 보이고
 * 나머지는 숨긴다. 점과 툴팁은 그대로다.
 */
export const labelStepOf = (count: number, width: number): number => {
  const room = Math.max(
    1,
    Math.floor((width - DS_CHART_PAD.left - DS_CHART_PAD.right) / AXIS_LABEL_SLOT_PX),
  );

  return Math.max(1, Math.ceil(count / room));
};

/**
 * ⚠ DS LineChart 내부 클래스 의존 — 가로축 날짜 글자는 CSS 모듈 클래스 `_axisText_…`(DS dist)로 그려진다. 공용
 * 부품에 솎기 옵션이 없어 대시보드가 그 글자를 찾아 숨긴다(사용자 확정 2026-10-16). DS 가 이 이름을 바꾸면 솎기가
 * 멈춘다 — `trend-panel.test.tsx` 가 글자를 찾지 못하면 실패해 알려 준다.
 */
export const DS_AXIS_LABEL_SELECTOR = 'svg [class*="_axisText_"]';

/** 말풍선과 점 사이 간격(px). */
const TIP_GAP_PX = 12;

/** 이웃 점과 겹침을 볼 때 점 둘레 여유(px) — 점 반지름 + 조금. */
const TIP_POINT_MARGIN_PX = 6;

/**
 * 말풍선 자리(그림 안 px, 왼쪽 위 모서리). 위 → 아래 순으로 보되 **그래프 영역 안**이고 **이웃 점을 가리지
 * 않는** 첫 자리를 고른다. 둘 다 가리면 가리는 점이 적은 쪽. 좌우는 점 가운데에 두고 영역 끝에서만 안쪽으로 민다
 * (사용자 지시 2026-10-16 — 맨 오른쪽 점의 말풍선이 옆 점을 가렸다).
 */
export const placeTip = (
  at: { x: number; y: number },
  size: { width: number; height: number },
  positions: readonly { x: number; y: number }[],
  areaWidth: number,
  areaHeight: number = CHART_HEIGHT,
): { left: number; top: number } => {
  /* 왼쪽 끝은 y축 글자(그림 여백 안)를 덮지 않게 그림 영역 시작 조금 앞에서 멈춘다. */
  const minLeft = DS_CHART_PAD.left - 6;
  const left = Math.min(
    Math.max(at.x - size.width / 2, minLeft),
    Math.max(areaWidth - size.width, minLeft),
  );
  const coveredBy = (top: number) =>
    positions.filter(
      (point) =>
        point !== at &&
        point.x >= left - TIP_POINT_MARGIN_PX &&
        point.x <= left + size.width + TIP_POINT_MARGIN_PX &&
        point.y >= top - TIP_POINT_MARGIN_PX &&
        point.y <= top + size.height + TIP_POINT_MARGIN_PX,
    );
  const above = at.y - TIP_GAP_PX - size.height;
  const below = at.y + TIP_GAP_PX;
  /* 위에서 이웃 점을 가리면 그 점들보다 더 위로 올린 자리도 본다(오른쪽 끝 점처럼 아래 자리가 없을 때). */
  const aboveCovered = coveredBy(above);
  const higher =
    aboveCovered.length === 0
      ? above
      : Math.min(...aboveCovered.map((point) => point.y)) - TIP_POINT_MARGIN_PX - 1 - size.height;
  const candidates = [above, below, higher].filter(
    (top) => top >= 0 && top + size.height <= areaHeight,
  );
  if (candidates.length === 0) return { left, top: Math.max(above, 0) };

  const best = candidates.reduce((chosen, top) =>
    coveredBy(top).length < coveredBy(chosen).length ? top : chosen,
  );

  return { left, top: best };
};

/** 말풍선 크기를 재기 전 첫 그림에 쓰는 어림값 — 잰 뒤 곧바로 바뀐다. */
const TIP_SIZE_GUESS = { width: 120, height: 46 };

/**
 * 점 이름표(「10-13」)를 「2026-10-13」로(⭐ 날짜 표기 통일 · 사용자 지시 2026-10-19 — 축은 짧게, 말풍선은 전체 날짜) — 서버는 월-일만 준다. 연도는 기준일에서 읽고, 기준일보다 뒤의 월-일이면
 * 지난해다(12월 말 ~ 1월 초에 걸친 기간). 이름표가 월-일 꼴이 아니거나 기준일이 없으면 이름표 그대로.
 */
export const toTipDate = (label: string, baseDate: string | null): string => {
  const matched = /^(\d{2})-(\d{2})$/.exec(label);
  const base = baseDate === null ? null : /^(\d{4})-(\d{2}-\d{2})$/.exec(baseDate);
  if (matched === null || base === null || base[1] === undefined || base[2] === undefined) {
    return label;
  }

  const year = Number(base[1]) - (label > base[2] ? 1 : 0);

  return `${String(year)}-${matched[1] ?? ''}-${matched[2] ?? ''}`;
};

/** 점 위치(그림 안 px). DS 차트와 같은 식 — x 는 칸을 고르게, y 는 0~상한을 위아래로. */
export const toPointPositions = (
  points: readonly DashboardTrendPointView[],
  width: number,
  max: number,
  height: number = CHART_HEIGHT,
): { x: number; y: number }[] => {
  const plotW = width - DS_CHART_PAD.left - DS_CHART_PAD.right;
  const top = DS_CHART_PAD.top;
  const bottom = height - DS_CHART_PAD.bottom;
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
 * 정확한 생산량(천 단위 · 단위). 말풍선 자리는 `placeTip` — 영역 안, 이웃 점을 가리지 않는 위 · 아래.
 */
const PointTips = ({
  points,
  width,
  height,
  max,
  unit,
  baseDate,
}: {
  points: readonly DashboardTrendPointView[];
  width: number;
  height: number;
  max: number;
  unit: string | null;
  baseDate: string | null;
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [tipSize, setTipSize] = useState(TIP_SIZE_GUESS);
  const shown = hovered ?? pinned;

  /* 말풍선의 실제 크기 — 칠하기 전에 재서 자리를 정한다(겹침 판정에 쓴다). */
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (tip === null) return;
    const measured = { width: tip.offsetWidth, height: tip.offsetHeight };
    if (measured.width === 0) return;
    setTipSize((current) =>
      current.width === measured.width && current.height === measured.height ? current : measured,
    );
  }, [shown, width]);

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

  const positions = toPointPositions(points, width, max, height);
  const slot =
    points.length <= 1
      ? width
      : (width - DS_CHART_PAD.left - DS_CHART_PAD.right) / (points.length - 1);
  const qtyOf = (point: DashboardTrendPointView): string => formatFigure(point.value);
  const textOf = (point: DashboardTrendPointView): string =>
    `${toTipDate(point.label, baseDate)} ${qtyOf(point)}${unit === null ? '' : ` ${unit}`}`;

  const active = shown === null ? undefined : points[shown];
  const at = shown === null ? undefined : positions[shown];
  const place = at === undefined ? undefined : placeTip(at, tipSize, positions, width, height);

  return (
    <div ref={layerRef} className="dash-trend-tips" style={{ width, height }}>
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
              height: height - DS_CHART_PAD.top - DS_CHART_PAD.bottom,
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
      {active !== undefined && at !== undefined && place !== undefined && (
        <>
          <span className="dash-trend-ring" style={{ left: at.x, top: at.y }} aria-hidden="true" />
          <span
            ref={tipRef}
            role="tooltip"
            className="dash-trend-tip"
            style={{ left: place.left, top: place.top }}
          >
            {/* 1줄 날짜(작은 회색) · 2줄 수량(크고 굵게, 단위는 작게) — 사용자 지시 2026-10-16. */}
            <span className="dash-trend-tip-date">{toTipDate(active.label, baseDate)}</span>
            <span className="dash-trend-tip-value">
              {qtyOf(active)}
              {unit !== null && <span className="dash-trend-tip-unit">{unit}</span>}
            </span>
          </span>
        </>
      )}
    </div>
  );
};

export interface TrendPanelProps {
  view: DashboardTrendView | null;
  /** 응답의 기준일(YYYY-MM-DD) — 툴팁 날짜의 연도를 읽는다. */
  baseDate?: string | null;
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
export const TrendPanel = ({ view, baseDate = null, isLoading }: TrendPanelProps) => {
  /* 실제 폭으로 그린다 — 그림을 줄이면 좁은 폭에서 축 글자가 8px 까지 작아졌다(원칙 d). */
  const [chartRef, chartWidth] = useChartWidth<HTMLDivElement>(640);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const pointCount = view?.points.length ?? 0;
  const [fitHeight, setFitHeight] = useState<number | null>(null);
  const setPlot = useCallback(
    (node: HTMLDivElement | null) => {
      plotRef.current = node;
      chartRef(node);
    },
    [chartRef],
  );

  /*
   * 그래프 높이를 행 높이에 맞춘다(⭐ 사용자 지정 2026-10-16 — 오른쪽 출하 + 알림 높이 합에 맞춤). 카드가 행을
   * 따라가는 자리(`.dash-fit` · 크기 봉쇄)일 때만 몸통 높이를 재서 쓰고, 1열처럼 제 높이대로 서는 자리에서는 기본
   * 높이 그대로다 — 재는 높이를 그대로 쓰면 그림이 몸통을 키우고 몸통이 다시 그림을 키운다.
   */
  useEffect(() => {
    const plot = plotRef.current;
    const body = plot?.closest<HTMLElement>('.dash-panel-body');
    const card = plot?.closest<HTMLElement>('.dash-fit');
    if (body === null || body === undefined || card === null || card === undefined)
      return undefined;
    if (typeof ResizeObserver === 'undefined') return undefined;

    const measure = () => {
      const fitted = getComputedStyle(card).contain.includes('size');
      setFitHeight(fitted ? Math.floor(body.clientHeight) : null);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    measure();

    return () => {
      observer.disconnect();
    };
  }, [view === null, isLoading, pointCount]);
  const chartHeight = Math.max(CHART_HEIGHT, fitHeight ?? 0);

  /* 날짜 이름표 솎기 — 칠하기 전에 숨긴다(겹친 글자가 한 번 보였다 사라지지 않게). */
  useLayoutEffect(() => {
    const labels = plotRef.current?.querySelectorAll<SVGTextElement>(DS_AXIS_LABEL_SELECTOR);
    if (labels === undefined) return;
    const step = labelStepOf(labels.length, chartWidth);
    labels.forEach((label, index) => {
      label.style.visibility = index % step === 0 ? '' : 'hidden';
    });
  }, [pointCount, chartWidth]);
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
    <div className="dash-trend" ref={setPlot}>
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
        height={chartHeight}
        showPoints
        /* 시리즈가 하나뿐이라 범례는 같은 이름을 한 번 더 적을 뿐이다. */
        showLegend={false}
      />
      <PointTips
        points={view.points}
        width={chartWidth}
        height={chartHeight}
        max={chartMax}
        unit={view.unit}
        baseDate={baseDate}
      />
    </div>
  );
};
