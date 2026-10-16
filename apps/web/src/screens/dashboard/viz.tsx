import { Card, Chip, EmptyState, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatFigure } from './types';
import {
  PARETO_THRESHOLD,
  toLineSegments,
  toParetoRows,
  toRateDomain,
  toShareRows,
  type NamedQty,
  type SeriesPoint,
} from './viz-math';

const t = messages.dashboard.viz;

/**
 * 대시보드 그림 부품(⭐ 사용자 지시 2026-10-16, 시안 v1.3 기준 재구성).
 *
 * 색 · 간격 · 글꼴은 **디자인 시스템 토큰만** 쓴다(`app.css` 의 `.dash-*`). 시안의 색 값을 옮기지 않는다.
 * 규칙: 순위의 1위만 진한 색(`--chart-2`), 나머지는 옅은 색(`--chart-5`). 불량 · NG 는 error, 경고는 warning.
 *
 * 그림만으로 말하지 않는다 — 막대 · 선 옆에 숫자를 함께 적고, SVG 그림에는 같은 값의 숨은 표를 단다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

/** 기간 표시(「당월」 · 「금일」 · 「현재」). 상태가 아니라 이름표라 회색이다. */
export const PeriodTag = ({ children }: { children: string }) => (
  <Chip size="sm" status="idle">
    {children}
  </Chip>
);

export interface PanelProps {
  title: string;
  sub?: string;
  tag?: string;
  className?: string;
  children: ReactNode;
}

/** 시안의 패널 한 칸 — 제목 · 부제 · 기간 표시 · 본문. */
export const Panel = ({ title, sub, tag, className, children }: PanelProps) => (
  <Card
    surface="default"
    bordered
    className={className === undefined ? 'dash-panel' : `dash-panel ${className}`}
    aria-label={title}
    role="region"
  >
    <div className="dash-panel-head">
      <div>
        <h3 className="dash-panel-title">{title}</h3>
        {sub !== undefined && <p className="dash-panel-sub">{sub}</p>}
      </div>
      {tag !== undefined && <PeriodTag>{tag}</PeriodTag>}
    </div>
    <div className="dash-panel-body">{children}</div>
  </Card>
);

export interface KpiTileProps {
  label: string;
  tag?: string;
  value: string;
  unit?: string;
  /** 값의 색. 불량은 error, 경고는 warning. 없으면 기본 글자색. */
  tone?: 'error' | 'warning';
  children?: ReactNode;
}

/** KPI 띠의 한 칸. */
export const KpiTile = ({ label, tag, value, unit, tone, children }: KpiTileProps) => (
  <div className="dash-kpi" role="group" aria-label={label}>
    <div className="dash-kpi-head">
      <span className="dash-kpi-label">{label}</span>
      {tag !== undefined && <PeriodTag>{tag}</PeriodTag>}
    </div>
    <div className="dash-kpi-value-row">
      <span className={tone === undefined ? 'dash-kpi-value' : `dash-kpi-value dash-tone-${tone}`}>
        {value}
      </span>
      {unit !== undefined && <span className="dash-kpi-unit">{unit}</span>}
    </div>
    {children !== undefined && <div className="dash-kpi-note">{children}</div>}
  </div>
);

export const NoRecords = ({ description }: { description?: string }) => (
  <EmptyState size="sm" title={t.noRecordsTitle} description={description ?? t.noRecords} />
);

const formatShare = (share: number): string => `${String(Math.round(share))}%`;

export interface RankBarsProps {
  entries: readonly NamedQty[];
  /** 값 뒤 표기(예: 「%」). 없으면 수량. */
  formatValue?: (value: number) => string;
  /** 비율 열을 보일지. 불량률처럼 값 자체가 비율이면 끈다. */
  showShare?: boolean;
  /** 값 오른쪽 보조 글(예: 「NG 12」). */
  aside?: (entry: NamedQty) => string | undefined;
}

/** 순위 막대 — 받은 순서대로, 1위만 진하게. 비어 있으면 「기록 없음」. */
export const RankBars = ({
  entries,
  formatValue = formatFigure,
  showShare = true,
  aside,
}: RankBarsProps) => {
  if (entries.length === 0) return <NoRecords />;

  return (
    <ol className="dash-rank">
      {toShareRows(entries).map((row, index) => (
        <li key={row.key} className="dash-rank-row">
          <span className="dash-rank-label">{row.label}</span>
          <span className="dash-rank-track" aria-hidden="true">
            <span
              className={index === 0 ? 'dash-rank-bar dash-rank-bar-top' : 'dash-rank-bar'}
              style={{ width: `${String(row.length)}%` }}
            />
          </span>
          <span className="dash-rank-value">{formatValue(row.value)}</span>
          {showShare && <span className="dash-rank-share">{formatShare(row.share)}</span>}
          {aside !== undefined && <span className="dash-rank-share">{aside(row) ?? ''}</span>}
        </li>
      ))}
    </ol>
  );
};

const STACK_CLASSES = ['dash-stack-1', 'dash-stack-2', 'dash-stack-3', 'dash-stack-4'];

/** 100% 누적 막대 + 범례. 다섯째부터는 가장 옅은 색을 되풀이한다. */
export const StackedBar100 = ({ entries }: { entries: readonly NamedQty[] }) => {
  if (entries.length === 0) return <NoRecords />;

  const rows = toShareRows(entries);
  const classOf = (index: number): string =>
    STACK_CLASSES[Math.min(index, STACK_CLASSES.length - 1)] ?? 'dash-stack-4';

  return (
    <div className="dash-stack">
      <div className="dash-stack-bar" aria-hidden="true">
        {rows.map((row, index) => (
          <span
            key={row.key}
            className={`dash-stack-seg ${classOf(index)}`}
            style={{ width: `${String(row.share)}%` }}
          />
        ))}
      </div>
      <ul className="dash-legend-list">
        {rows.map((row, index) => (
          <li key={row.key}>
            <span className={`dash-swatch ${classOf(index)}`} aria-hidden="true" />
            <span className="dash-legend-label">{row.label}</span>
            <span className="dash-legend-value">{formatFigure(row.value)}</span>
            <span className="dash-legend-share">{formatShare(row.share)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export interface LotCounts {
  accepted: number;
  rejected: number;
  held: number;
}

/** 검사 LOT 미니 막대 — 합격(회색) · 불합격(error) · 검사 보류(warning). 숫자는 옆 글이 말한다. */
export const MiniLotBar = ({ counts }: { counts: LotCounts }) => {
  const total = counts.accepted + counts.rejected + counts.held;
  if (total === 0) return null;
  const pct = (value: number): string => `${String((value / total) * 100)}%`;

  return (
    <span className="dash-minibar" aria-hidden="true">
      <span className="dash-minibar-ok" style={{ width: pct(counts.accepted) }} />
      <span className="dash-minibar-held" style={{ width: pct(counts.held) }} />
      <span className="dash-minibar-ng" style={{ width: pct(counts.rejected) }} />
    </span>
  );
};

export interface StatusItem {
  key: string;
  label: string;
  note?: string;
  value: string;
  unit?: string;
  /** 점 · 값의 색. 0이 아닌 경고만 색을 준다 — 0에 색을 주면 늘 문제가 있는 것처럼 보인다. */
  tone?: ChipStatus;
}

/** 「현재 현황」 목록 — 점 · 항목 · 보조 글 · 값. */
export const StatusList = ({ items }: { items: readonly StatusItem[] }) => (
  <ul className="dash-status-list">
    {items.map((item) => (
      <li key={item.key}>
        <span className={`dash-dot dash-dot-${item.tone ?? 'idle'}`} aria-hidden="true" />
        <span className="dash-status-text">
          <span className="dash-status-label">{item.label}</span>
          {item.note !== undefined && <span className="dash-status-note">{item.note}</span>}
        </span>
        <span
          className={
            item.tone === 'error' || item.tone === 'warning'
              ? `dash-status-value dash-tone-${item.tone}`
              : 'dash-status-value'
          }
        >
          {item.value}
          {item.unit !== undefined && <span className="dash-kpi-unit">{item.unit}</span>}
        </span>
      </li>
    ))}
  </ul>
);

/* ── SVG 그림 ─────────────────────────────────────────────── */

const W = 600;
const H = 240;
const PAD = { top: 16, right: 64, bottom: 28, left: 40 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

const xAt = (index: number, count: number): number =>
  PAD.left + (count <= 1 ? plotW / 2 : (plotW * index) / (count - 1));

export interface LineSeries {
  name: string;
  points: SeriesPoint[];
  /** 계열 색 — `dash-line-1`(진한 회색) · `dash-line-2`(옅은 회색) · `dash-line-3`(info). */
  tone: 1 | 2 | 3;
}

/**
 * 여러 계열 꺾은선 — **값이 없는 날에서 선을 끊는다.** 목표선은 없다(목표값은 MES DB에 없다).
 * 계열 이름과 마지막 값을 선 끝에 적는다 — 범례를 따로 오가지 않게.
 */
export const MultiLineChart = ({ series, caption }: { series: LineSeries[]; caption: string }) => {
  const labels = series[0]?.points.map((point) => point.label) ?? [];
  const values = series.flatMap((entry) => entry.points.map((point) => point.value));
  if (values.every((value) => value === null)) return <NoRecords description={t.noRates} />;

  const domain = toRateDomain(values);
  const yAt = (value: number): number =>
    PAD.top + plotH - ((value - domain.min) / (domain.max - domain.min || 1)) * plotH;
  const ticks = [0, 1, 2, 3, 4].map((step) => domain.min + ((domain.max - domain.min) * step) / 4);

  return (
    <figure className="dash-figure">
      {series.length > 1 && (
        <ul className="dash-legend-inline" aria-hidden="true">
          {series.map((entry) => (
            <li key={entry.name}>
              <span className={`dash-swatch dash-line-${String(entry.tone)}`} />
              {entry.name}
            </li>
          ))}
        </ul>
      )}
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="dash-svg"
        role="img"
        aria-label={caption}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="dash-grid"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yAt(tick)}
              y2={yAt(tick)}
            />
            <text className="dash-axis" x={PAD.left - 6} y={yAt(tick) + 4} textAnchor="end">
              {formatFigure(tick)}
            </text>
          </g>
        ))}
        {labels.map((label, index) => (
          <text
            key={label}
            className="dash-axis"
            x={xAt(index, labels.length)}
            y={H - 8}
            textAnchor="middle"
          >
            {label}
          </text>
        ))}
        {series.map((entry) => {
          const segments = toLineSegments(entry.points);
          const last = segments.at(-1)?.at(-1);

          return (
            <g key={entry.name} className={`dash-line-${String(entry.tone)}`}>
              {segments.map((segment) => (
                <polyline
                  key={segment[0]?.index}
                  className="dash-line"
                  points={segment
                    .map(
                      (point) =>
                        `${String(xAt(point.index, labels.length))},${String(yAt(point.value))}`,
                    )
                    .join(' ')}
                />
              ))}
              {segments.flat().map((point) => (
                <circle
                  key={point.index}
                  className="dash-point"
                  cx={xAt(point.index, labels.length)}
                  cy={yAt(point.value)}
                  r={3}
                />
              ))}
              {last !== undefined && (
                <text
                  className="dash-line-end"
                  x={xAt(last.index, labels.length) + 8}
                  y={yAt(last.value) + 4}
                >
                  {series.length > 1
                    ? `${entry.name} ${formatFigure(last.value)}`
                    : formatFigure(last.value)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="dash-sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.dateColumn}</th>
            {series.map((entry) => (
              <th key={entry.name} scope="col">
                {entry.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, index) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {series.map((entry) => {
                const value = entry.points[index]?.value ?? null;

                return <td key={entry.name}>{value === null ? t.none : formatFigure(value)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};

/**
 * 파레토 — 막대(많은 순) + 누적 비율 선 + 80% 기준선. 누적 80%에 닿는 막대까지 진하게.
 * 왼쪽 축은 수량, 오른쪽 축은 누적 비율.
 */
export const ParetoChart = ({
  entries,
  caption,
}: {
  entries: readonly NamedQty[];
  caption: string;
}) => {
  if (entries.length === 0) return <NoRecords />;

  const rows = toParetoRows(entries);
  const max = Math.max(...rows.map((row) => row.value), 1);
  const slot = plotW / rows.length;
  const barW = slot * 0.6;
  const yQty = (value: number): number => PAD.top + plotH - (value / max) * plotH;
  const yPct = (value: number): number => PAD.top + plotH - (value / 100) * plotH;
  const cx = (index: number): number => PAD.left + slot * index + slot / 2;

  return (
    <figure className="dash-figure">
      <ul className="dash-legend-inline" aria-hidden="true">
        <li>
          <span className="dash-swatch dash-stack-1" />
          {t.paretoVital}
        </li>
        <li>
          <span className="dash-swatch dash-stack-4" />
          {t.paretoOther}
        </li>
        <li>
          <span className="dash-swatch dash-line-3" />
          {t.paretoCumulative}
        </li>
      </ul>
      <svg
        viewBox={`0 0 ${String(W)} ${String(H)}`}
        className="dash-svg"
        role="img"
        aria-label={caption}
      >
        <line className="dash-grid" x1={PAD.left} x2={W - PAD.right} y1={yPct(0)} y2={yPct(0)} />
        <line
          className="dash-threshold"
          x1={PAD.left}
          x2={W - PAD.right}
          y1={yPct(PARETO_THRESHOLD)}
          y2={yPct(PARETO_THRESHOLD)}
        />
        <text className="dash-axis" x={W - PAD.right + 6} y={yPct(PARETO_THRESHOLD) + 4}>
          {`${String(PARETO_THRESHOLD)}%`}
        </text>
        {rows.map((row, index) => (
          <g key={row.key}>
            <rect
              className={row.vital ? 'dash-bar dash-stack-1' : 'dash-bar dash-stack-4'}
              x={cx(index) - barW / 2}
              y={yQty(row.value)}
              width={barW}
              height={PAD.top + plotH - yQty(row.value)}
            />
            <text
              className="dash-bar-value"
              x={cx(index)}
              y={yQty(row.value) - 4}
              textAnchor="middle"
            >
              {formatFigure(row.value)}
            </text>
            <text className="dash-axis" x={cx(index)} y={H - 8} textAnchor="middle">
              {row.label}
            </text>
          </g>
        ))}
        <g className="dash-line-3">
          <polyline
            className="dash-line"
            points={rows
              .map((row, index) => `${String(cx(index))},${String(yPct(row.cumulative))}`)
              .join(' ')}
          />
          {rows.map((row, index) => (
            <circle
              key={row.key}
              className="dash-point"
              cx={cx(index)}
              cy={yPct(row.cumulative)}
              r={3}
            />
          ))}
        </g>
      </svg>
      <table className="dash-sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.itemColumn}</th>
            <th scope="col">{t.qtyColumn}</th>
            <th scope="col">{t.cumulativeColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              <td>{formatFigure(row.value)}</td>
              <td>{formatShare(row.cumulative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
};
