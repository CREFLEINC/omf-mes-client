import { Card, Chip, EmptyState, Icon, IconButton, Tooltip, type ChipStatus } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react';

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
import { useChartWidth } from './use-chart-width';

const t = messages.dashboard.viz;

/** 날짜 이름표 하나에 줄 폭(px) — 「10-14」 글자 폭 + 사이 여백. */
const AXIS_LABEL_SLOT_PX = 56;

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
  /** 제목 오른쪽의 이동 단추 등(예: 「알림센터 보기」). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** 시안의 패널 한 칸 — 제목 · 부제 · 기간 표시 · 본문. */
export const Panel = ({ title, sub, tag, action, className, children }: PanelProps) => (
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
      {action}
    </div>
    <div className="dash-panel-body">{children}</div>
  </Card>
);

/**
 * 툴팁 글. DS 툴팁은 줄바꿈 없이(nowrap) 그려 긴 설명이 화면 오른쪽 끝을 넘었다(768 폭 실측) — 글에 최대 폭을
 * 주어 줄을 바꾼다(`.dash-tip-text`). 공용 Tooltip 은 고치지 않는다.
 */
/*
 * 문장마다 한 줄로 세운다(사용자 보고 2026-10-16) — 꺾인 글 상자는 최대 폭에 붙어 남아 말풍선 오른쪽이 비었다.
 * 문장 단위로 끊으면 상자는 가장 긴 문장 폭에 맞고, 한 문장은 최대 폭을 넘을 때만 꺾인다.
 */
const TipText = ({ children }: { children: string }) => (
  <span className="dash-tip-text">
    {children.split(/(?<=[.。])\s+/).map((sentence) => (
      <span key={sentence} className="dash-tip-line">
        {sentence}
      </span>
    ))}
  </span>
);

/**
 * 설명 단추 — 누르거나 올리면 DS 툴팁으로 서버 설명 원문을 보인다. ⭐ KPI 띠에 한해 「상세 설명은
 * 툴팁」을 허용한다(사용자 지시 2026-10-16) — 칸 높이가 설명 때문에 늘지 않게. 원문은 그대로 넣는다.
 */
/** 눌러서 연 설명 툴팁이 스스로 닫히기까지(사용자 지시 2026-10-16). */
export const INFO_TIP_CLICK_CLOSE_MS = 3_000;

/** 올림 · 포커스 뒤 툴팁이 뜨기까지(DS 기본값과 같은 값을 명시). 누른 뒤 닫힘은 뜬 순간부터 3초로 센다. */
const INFO_TIP_DELAY_MS = 400;

/**
 * 설명 단추(ⓘ) — 마우스 올림 · 키보드 포커스로 열리는 DS Tooltip 동작은 그대로 두고, **누르면 열리고
 * 3초 뒤 닫힌다**. 열려 있을 때 다시 누르면 바로 닫힌다(사용자 지시 2026-10-16 — 터치 화면에는 올림이 없다).
 *
 * DS Tooltip 은 열림 상태를 밖에서 받지 않는다(`open` · `onOpenChange` 없음). 공용 부품을 고치지 않고 DS 가
 * 이미 받는 신호로만 움직인다: 열기는 단추에 포커스를 다시 주고(포커스로 열림), 닫기는 Esc 를 보낸다
 * (DS 가 Esc 로 닫는다 — 포커스는 단추에 남는다).
 */
export const InfoTip = ({ label, content }: { label: string; content: string }) => {
  const rootRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const stopTimer = () => {
    if (timerRef.current !== undefined) clearTimeout(timerRef.current);
    timerRef.current = undefined;
  };

  useEffect(() => stopTimer, []);

  const close = (button: HTMLButtonElement) => {
    stopTimer();
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    /* 칸 전체가 링크일 수 있다 — 설명 단추를 누른 것은 이동이 아니다. */
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    if (timerRef.current !== undefined) {
      close(button);
      return;
    }

    const isOpen = rootRef.current?.querySelector('[role="tooltip"]') != null;
    if (!isOpen) {
      button.blur();
      button.focus();
    }
    /* 이미 떠 있으면 지금부터, 아니면 뜨는 순간부터 3초 — 보이는 시간이 3초다. */
    timerRef.current = setTimeout(
      () => {
        close(button);
      },
      INFO_TIP_CLICK_CLOSE_MS + (isOpen ? 0 : INFO_TIP_DELAY_MS),
    );
  };

  return (
    /*
     * 아래로 연다 — KPI 띠는 화면 맨 위쪽에 있어 위로 열면 스크롤 영역(셸 `main`) 위 끝에 잘린다.
     */
    <Tooltip
      ref={rootRef}
      content={<TipText>{content}</TipText>}
      placement="bottom"
      delay={INFO_TIP_DELAY_MS}
    >
      <IconButton
        size="sm"
        icon="info"
        className="dash-info"
        aria-label={label}
        onClick={onClick}
      />
    </Tooltip>
  );
};

/**
 * 증감 기호 · 수치(⭐ 사용자 결정 2026-10-16) — 오르면 초록 · 내리면 주황 · 변동 없음 회색. 늘수록 나쁜 지표
 * (`lowerIsBetter`)는 색을 뒤집는다. 기호(↑ · ↓)는 실제 방향 그대로 — 색만으로 말하지 않는다.
 */
export const DeltaMark = ({
  direction,
  lowerIsBetter = false,
  children,
}: {
  direction: 'up' | 'down' | 'flat';
  lowerIsBetter?: boolean;
  children: ReactNode;
}) => {
  const tone =
    direction === 'flat' ? 'flat' : (direction === 'up') !== lowerIsBetter ? 'good' : 'bad';

  return <span className={`dash-delta dash-delta-${tone}`}>{children}</span>;
};

export interface KpiTileProps {
  label: string;
  /** 이름 옆 설명 단추(툴팁). */
  info?: string;
  tag?: string;
  value: string;
  unit?: string;
  /** 값의 색. 불량은 error, 경고는 warning. 없으면 기본 글자색. */
  tone?: 'error' | 'warning';
  children?: ReactNode;
}

/** KPI 띠의 한 칸. */
export const KpiTile = ({ label, info, tag, value, unit, tone, children }: KpiTileProps) => (
  <div className="dash-kpi" role="group" aria-label={label}>
    <div className="dash-kpi-head">
      <span className="dash-kpi-label">
        {label}
        {info !== undefined && <InfoTip label={t.infoLabel(label)} content={info} />}
      </span>
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

/**
 * 빈 상태 한 줄(전 탭 레이아웃 정비 2026-10-16) — 제목 + 설명 두 줄이 같은 말을 되풀이하고 카드를 높였다.
 * DS EmptyState 를 제목 한 줄로만 쓰고 위아래 여백을 줄인다(`.dash-empty`).
 */
export const EmptyLine = ({ text, live = false }: { text: string; live?: boolean }) => (
  <EmptyState size="sm" live={live} title={text} className="dash-empty" />
);

export const NoRecords = ({ description }: { description?: string }) => (
  <EmptyLine text={description ?? t.noRecords} />
);

/** 이 길이를 넘는 이름은 두 줄에서 잘릴 수 있어 전체 이름을 툴팁으로도 준다(키보드로도 열린다). */
const RANK_LABEL_TOOLTIP_FROM = 12;

const RankLabel = ({ label }: { label: string }) =>
  label.length > RANK_LABEL_TOOLTIP_FROM ? (
    <Tooltip content={<TipText>{label}</TipText>} placement="top">
      <span className="dash-rank-label" tabIndex={0}>
        {label}
      </span>
    </Tooltip>
  ) : (
    <span className="dash-rank-label">{label}</span>
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
  /**
   * 수량 큰 순 상위 몇 줄만 보일지. 없으면 받은 순서 그대로 모두. ⭐ 비율의 분모는 **잘라 내기 전 전체 합**이다 —
   * 상위 몇 개 합으로 나누면 실제보다 크게 나온다(사용자 확정 2026-10-19). 그래서 보이는 줄 비율 합이 100% 가 안 될 수 있다.
   */
  top?: number;
}

/** 순위 막대 — 받은 순서대로, 1위만 진하게. 비어 있으면 「기록 없음」. */
export const RankBars = ({
  entries,
  formatValue = formatFigure,
  showShare = true,
  aside,
  top,
}: RankBarsProps) => {
  if (entries.length === 0) return <NoRecords />;

  const shareRows = toShareRows(entries);
  const rows =
    top === undefined ? shareRows : [...shareRows].sort((a, b) => b.value - a.value).slice(0, top);

  return (
    <ol className="dash-rank">
      {rows.map((row, index) => (
        <li key={row.key} className="dash-rank-row">
          <RankLabel label={row.label} />
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
export const MiniLotBar = ({
  counts,
  order = 'default',
}: {
  counts: LotCounts;
  /** `legend` — 글(합격 · 불합격 · 검사 보류)과 같은 순서(품질 종합). 기본은 합격 · 검사 보류 · 불합격. */
  order?: 'default' | 'legend';
}) => {
  const total = counts.accepted + counts.rejected + counts.held;
  if (total === 0) return null;
  const pct = (value: number): string => `${String((value / total) * 100)}%`;
  const held = (
    <span key="held" className="dash-minibar-held" style={{ width: pct(counts.held) }} />
  );
  const ng = <span key="ng" className="dash-minibar-ng" style={{ width: pct(counts.rejected) }} />;

  return (
    <span className="dash-minibar" aria-hidden="true">
      <span className="dash-minibar-ok" style={{ width: pct(counts.accepted) }} />
      {order === 'legend' ? [ng, held] : [held, ng]}
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
const StatusRowBody = ({ item }: { item: StatusItem }) => (
  <>
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
  </>
);

/**
 * `onSelect` 를 주면 줄 전체가 단추다(품질 종합 「현재 현황」 · ⭐ 사용자 결정 2026-10-19 — 누르면 LOT 목록 창).
 * `selectable: false` 인 줄(0건)은 누를 수 없다. 주지 않으면 지금처럼 읽기 전용 목록.
 */
export const StatusList = ({
  items,
  onSelect,
  rowProps,
}: {
  items: readonly (StatusItem & { selectable?: boolean })[];
  onSelect?: (key: string) => void;
  /** 단추 줄에 더할 속성 — 포인터로 연 창을 닫았을 때 포커스 링을 숨기는 처리 등. */
  rowProps?: ButtonHTMLAttributes<HTMLButtonElement>;
}) => (
  <ul className="dash-status-list">
    {items.map((item) => (
      <li key={item.key}>
        {onSelect === undefined ? (
          <StatusRowBody item={item} />
        ) : (
          <button
            type="button"
            className="dash-status-row"
            {...rowProps}
            disabled={item.selectable === false}
            onClick={() => {
              onSelect(item.key);
            }}
          >
            <StatusRowBody item={item} />
            <Icon name="chevron_right" size={18} className="dash-status-arrow" aria-hidden="true" />
          </button>
        )}
      </li>
    ))}
  </ul>
);

/* ── SVG 그림 ─────────────────────────────────────────────── */

/* 높이는 고정, 폭은 실제 폭(`useChartWidth`) — 그림을 늘이고 줄이지 않아 글자 크기가 그대로다. */
export const CHART_H = 240;
const PAD = { top: 16, right: 64, bottom: 28, left: 40 };

/** 선 끝 이름표의 최소 세로 간격(px) — 글자 줄 높이. */
const LABEL_GAP = 13;

/**
 * 선 끝 이름표가 겹치지 않게 위아래로 민다 — 세 계열의 마지막 값이 같으면 「IQC 95 · PQC 95 · OQC 95」가 한
 * 자리에 겹쳐 읽히지 않았다(점검 2026-10-16). 원래 순서(위→아래)는 지킨다. `null` 은 이름표 없음.
 */
const spreadLabels = (ys: readonly (number | null)[]): (number | null)[] => {
  const order = ys
    .map((y, index) => ({ y, index }))
    .filter((entry): entry is { y: number; index: number } => entry.y !== null)
    .sort((a, b) => a.y - b.y);
  const placed = [...ys];
  let previous = -Infinity;
  for (const entry of order) {
    const y = Math.max(entry.y, previous + LABEL_GAP);
    placed[entry.index] = y;
    previous = y;
  }

  return placed;
};

/** 툴팁과 날짜 칸 사이 간격(px). */
const LINE_TIP_GAP = 12;

/** 보기 좋은 눈금 간격의 앞자리. */
const NICE_TICK_STEPS = [1, 2, 2.5, 5, 10] as const;

/**
 * 범위 안의 보기 좋은 눈금(1 · 2 · 2.5 · 5 × 10ⁿ의 배수) — 범위는 바꾸지 않는다. 눈금이 여섯 개 이하가 되는 가장
 * 촘촘한 간격을 고르고, 범위 아래 끝은 이름 없는 바닥선으로 남긴다(맨 아래 눈금이 끝과 다를 때).
 */
export const toNiceRateTicks = (domain: { min: number; max: number }): number[] => {
  const span = domain.max - domain.min;
  if (!(span > 0)) return [domain.min];
  const magnitude = 10 ** Math.floor(Math.log10(span / 6));
  const steps = [...NICE_TICK_STEPS.map((nice) => nice * magnitude), 10 * 10 * magnitude];
  const step = steps.find((candidate) => span / candidate <= 6) ?? span;
  const first = Math.ceil(domain.min / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let value = first; value <= domain.max + 1e-9; value += step) {
    /* `+ 0` — 0 아래에서 올림한 -0 을 0 으로. */
    ticks.push(Math.round(value * 1000) / 1000 + 0);
  }

  return ticks;
};

/**
 * 일별 꺾은선 툴팁(⭐ 사용자 지시 2026-10-19 — 품질 종합, 대시보드 탭 추이 툴팁 참고). 그림 위에 날짜 칸마다 투명한
 * 단추를 겹친다. 마우스 올림 · 키보드 포커스로 보이고, 누르면(터치) 고정 · 다른 곳을 누르면 닫힌다. 내용은 날짜 +
 * 계열(IQC · PQC · OQC)별 합격률(값이 없는 날은 「—」). 말풍선은 날짜 칸 오른쪽에, 자리가 모자라면 왼쪽에 연다 —
 * 그림 밖으로 나가지 않는다. 고른 날짜에는 세로 안내선.
 */
const LineTips = ({
  series,
  labels,
  width,
  height,
  xAt,
}: {
  series: readonly LineSeries[];
  labels: readonly string[];
  width: number;
  height: number;
  xAt: (index: number) => number;
}) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [tipWidth, setTipWidth] = useState(140);
  const layerRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const shown = hovered ?? pinned;
  const count = labels.length;

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

  useEffect(() => {
    const measured = tipRef.current?.offsetWidth ?? 0;
    if (measured > 0 && measured !== tipWidth) setTipWidth(measured);
  });

  if (count === 0) return null;
  const plotW = width - PAD.left - PAD.right;
  const slot = count <= 1 ? plotW : plotW / (count - 1);
  const valueText = (value: number | null | undefined): string =>
    value === null || value === undefined ? t.tipNone : t.tipRate(formatFigure(value));
  const textOf = (index: number): string =>
    [
      labels[index] ?? '',
      ...series.map((entry) => `${entry.name} ${valueText(entry.points[index]?.value)}`),
    ].join(' · ');

  const x = shown === null ? 0 : xAt(shown);
  const right = x + LINE_TIP_GAP;
  const left = right + tipWidth <= width ? right : Math.max(0, x - LINE_TIP_GAP - tipWidth);

  return (
    <div ref={layerRef} className="dash-line-tips" style={{ width, height }}>
      {labels.map((label, index) => (
        <button
          key={label}
          type="button"
          className="dash-line-hit"
          style={{
            left: xAt(index) - slot / 2,
            width: slot,
            top: PAD.top,
            height: height - PAD.top - PAD.bottom,
          }}
          aria-label={textOf(index)}
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
      ))}
      {shown !== null && (
        <>
          <span
            className="dash-line-guide"
            style={{ left: x, top: PAD.top, height: height - PAD.top - PAD.bottom }}
            aria-hidden="true"
          />
          <div ref={tipRef} role="tooltip" className="dash-line-tip" style={{ left, top: PAD.top }}>
            <span className="dash-line-tip-date">{labels[shown]}</span>
            {series.map((entry) => (
              <span key={entry.name} className="dash-line-tip-row">
                <span className={`dash-swatch dash-line-${String(entry.tone)}`} />
                <span className="dash-line-tip-name">{entry.name}</span>
                <span className="dash-line-tip-value">{valueText(entry.points[shown]?.value)}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

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
export const MultiLineChart = ({
  series,
  caption,
  height,
  tooltip = false,
  tipLabels,
  niceTicks = false,
}: {
  series: LineSeries[];
  caption: string;
  /** 그림 높이(px). 없으면 기본 높이 — 품질 탭이 행 높이에 맞출 때만 준다(`FitChart`). */
  height?: number;
  /** 날짜 칸 툴팁(날짜 + 계열별 값) — 품질 종합 탭만 켠다(사용자 지시 2026-10-19). */
  tooltip?: boolean;
  /** 툴팁 머리에 쓸 날짜(점 이름표와 같은 순서). 없으면 이름표. */
  tipLabels?: readonly string[];
  /**
   * 눈금을 보기 좋은 간격(1 · 2 · 2.5 · 5 × 10ⁿ)으로 — 범위(점 · 선 위치)는 그대로 두고 눈금 위치 · 글자만 바꾼다.
   * IQC · PQC · OQC 탭만 켠다(4개 탭 정돈 2026-10-19).
   */
  niceTicks?: boolean;
}) => {
  const [figureRef, W] = useChartWidth<HTMLElement>();
  const H = height ?? CHART_H;
  const plotH = H - PAD.top - PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  const xAt = (index: number, count: number): number =>
    PAD.left + (count <= 1 ? plotW / 2 : (plotW * index) / (count - 1));
  const labels = series[0]?.points.map((point) => point.label) ?? [];
  const values = series.flatMap((entry) => entry.points.map((point) => point.value));
  if (values.every((value) => value === null)) return <NoRecords description={t.noRates} />;

  const domain = toRateDomain(values);
  const yAt = (value: number): number =>
    PAD.top + plotH - ((value - domain.min) / (domain.max - domain.min || 1)) * plotH;
  const ticks = niceTicks
    ? toNiceRateTicks(domain)
    : [0, 1, 2, 3, 4].map((step) => domain.min + ((domain.max - domain.min) * step) / 4);
  /* 날짜 이름표 솎기(기간 조회 2026-10-16 — 최대 92점) — 폭에 들어가는 만큼만, 점 · 선은 그대로. */
  const labelStep = Math.max(
    1,
    Math.ceil(labels.length / Math.max(1, Math.floor(plotW / AXIS_LABEL_SLOT_PX))),
  );
  const endLabelY = spreadLabels(
    series.map((entry) => {
      const last = toLineSegments(entry.points).at(-1)?.at(-1);
      return last === undefined ? null : yAt(last.value) + 4;
    }),
  );

  return (
    <figure className="dash-figure" ref={figureRef}>
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
      <div className="dash-svg-wrap">
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
          {niceTicks && !ticks.includes(domain.min) && (
            <line
              className="dash-grid"
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yAt(domain.min)}
              y2={yAt(domain.min)}
            />
          )}
          {labels.map((label, index) =>
            index % labelStep !== 0 ? null : (
              <text
                key={label}
                className="dash-axis"
                x={xAt(index, labels.length)}
                y={H - 8}
                textAnchor="middle"
              >
                {label}
              </text>
            ),
          )}
          {series.map((entry, seriesIndex) => {
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
                    y={endLabelY[seriesIndex] ?? yAt(last.value) + 4}
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
        {tooltip && (
          <LineTips
            series={series}
            labels={tipLabels ?? labels}
            width={W}
            height={H}
            xAt={(index) => xAt(index, labels.length)}
          />
        )}
      </div>
      {/* 숨김 표는 감싼 상자로 줄인다 — 표는 높이 1px 를 받지 않아 행 수만큼 페이지 아래에 빈 스크롤을 만들었다. */}
      <div className="dash-sr-only">
        <table>
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
      </div>
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
  height,
}: {
  entries: readonly NamedQty[];
  caption: string;
  /** 그림 높이(px). 없으면 기본 높이 — 품질 탭이 행 높이에 맞출 때만 준다(`FitChart`). */
  height?: number;
}) => {
  const [figureRef, W] = useChartWidth<HTMLElement>();
  const H = height ?? CHART_H;
  const plotH = H - PAD.top - PAD.bottom;
  const plotW = W - PAD.left - PAD.right;
  if (entries.length === 0) return <NoRecords />;

  const rows = toParetoRows(entries);
  const max = Math.max(...rows.map((row) => row.value), 1);
  const slot = plotW / rows.length;
  const barW = slot * 0.6;
  const yQty = (value: number): number => PAD.top + plotH - (value / max) * plotH;
  const yPct = (value: number): number => PAD.top + plotH - (value / 100) * plotH;
  const cx = (index: number): number => PAD.left + slot * index + slot / 2;

  return (
    <figure className="dash-figure" ref={figureRef}>
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
        {/*
         * 막대 값 글자는 누적 비율 선 위에 그리고 카드 바탕색 테두리를 둘러 선이 지나가도 읽히게 한다(4개 탭 정돈
         * 2026-10-19 — 「49」가 선에 가려졌다). 위치는 그대로다.
         */}
        {rows.map((row, index) => (
          <text
            key={row.key}
            className="dash-bar-value dash-bar-value-halo"
            x={cx(index)}
            y={yQty(row.value) - 4}
            textAnchor="middle"
          >
            {formatFigure(row.value)}
          </text>
        ))}
      </svg>
      {/* 숨김 표는 감싼 상자로 줄인다 — 표는 높이 1px 를 받지 않아 행 수만큼 페이지 아래에 빈 스크롤을 만들었다. */}
      <div className="dash-sr-only">
        <table>
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
      </div>
    </figure>
  );
};
