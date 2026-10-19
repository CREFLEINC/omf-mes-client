import { Chip, Skeleton, Table, type ChipStatus, type Column } from '@crefle/web-ui';
import type {
  DashboardJudgmentCode,
  DashboardLotCounts,
  DashboardQuality,
  DashboardQualityLotStatus,
  DashboardQualityTypeBlock,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { toPlantDateTimeParts } from '../../patterns/plant-time';
import {
  blockOf,
  lotTotal,
  shortDate,
  sumLots,
  toRecentLotRows,
  type QualityKind,
  type RecentLotRow,
} from './quality';
import { compareEquipmentCode } from './equipment';
import { pointerFocusProps, usePointerInput } from './equipment-panel';
import { formatFigure } from './types';
import { usePeriodTags } from './period';
import { QualityLotsDialog } from './quality-lots-dialog';
import { useFillHeight } from './use-fill-height';
import {
  CHART_H,
  DeltaMark,
  EmptyLine,
  KpiTile,
  MiniLotBar,
  MultiLineChart,
  NoRecords,
  Panel,
  ParetoChart,
  RankBars,
  StackedBar100,
  StatusList,
  type LineSeries,
} from './viz';

const t = messages.dashboard.quality;

/*
 * 품질 탭 다섯(omf-all-around#113 · ⭐ 사용자 지시 2026-10-16, 시안 v1.3 기준 재구성).
 * 시안의 격자 — KPI 띠 → row2(넓은 패널 + 좁은 패널) → row3(패널 셋). 규격에 없는 칸(손실금액 · 반품 금액 ·
 * 클레임 · CAPA · 목표값 · 재발 · 업체 시정요구 · Ass'y 구성비)은 만들지 않고, 빈 자리는 남기지 않는다.
 *
 * ⛔ 「선별」이라는 말을 쓰지 않는다 — **검사 보류** · **전수 재검**. ⛔ 목표선을 긋지 않는다.
 * 합격률은 서버가 낸다(최종 판정 · 보류 제외) — 화면이 다시 계산하지 않는다.
 */

/** 합격률 · 불량률 표기. 모수가 0이라 `null`이면 「—」 — ⛔ 0%로 그리지 않는다. */
export const formatRate = (rate: number | null): string =>
  rate === null ? t.rateNone : t.percent(formatFigure(rate));

/** 전월 대비 p(퍼센트 포인트) — 방향과 표기. 둘 중 하나라도 없으면 `null`. */
export const rateDelta = (
  month: number | null,
  prev: number | null,
  flatText: string = t.deltaFlat,
  /** 품질 종합 KPI 는 %p(사용자 지시 2026-10-19), 다른 탭은 기존 p. */
  unit: 'p' | '%p' = 'p',
): { direction: 'up' | 'down' | 'flat'; text: string } | null => {
  if (month === null || prev === null) return null;
  const diff = Math.round((month - prev) * 10) / 10;

  return diff > 0
    ? { direction: 'up', text: (unit === '%p' ? t.deltaUpPp : t.deltaUp)(formatFigure(diff)) }
    : diff < 0
      ? {
          direction: 'down',
          text: (unit === '%p' ? t.deltaDownPp : t.deltaDown)(formatFigure(-diff)),
        }
      : { direction: 'flat', text: flatText };
};

const JUDGMENT_TONE: Record<DashboardJudgmentCode, ChipStatus> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
};

/*
 * ⭐ 아래 줄(사용자 점검 2026-10-16) — 판정 표를 넓게, 짧은 상자 둘(구성비 · 현재 현황)은 다른 한 열에 위아래로
 * 쌓는다(`split`). 셋을 나란히 두고 높이를 맞추면 빈 상태 상자가 표 높이만큼 늘어 큰 빈 상자가 됐다.
 */
const Row = ({
  kind,
  children,
}: {
  kind: 'row2' | 'row2-single' | 'row3' | 'split';
  children: ReactNode;
}) => (
  /* 품질 탭의 차트 + 짧은 상자 줄은 중간 폭에서 오른쪽을 넓힌다(`.dash-row2-quality`) — 업체 표가 잘렸다. */
  <div className={kind === 'row2' ? 'dash-row2 dash-row2-quality' : `dash-${kind}`}>{children}</div>
);

/**
 * 품질 종합 KPI 의 합격률 칸(⭐ 사용자 지시 2026-10-19) — 이름 → 현재 합격률(숫자 크게 · % 작게) → 전월 값 · 증감
 * (↑ · ↓ %p, 대시보드와 같은 색). 전월 값이 없으면 증감을 지어내지 않고 「전월 데이터 없음」. 다른 탭은
 * `PassRateTile` 그대로다.
 */
const OverviewPassRateTile = ({
  label,
  block,
}: {
  label: string;
  block: DashboardQualityTypeBlock;
}) => {
  const tags = usePeriodTags();
  const delta = rateDelta(block.monthPassRate, block.prevMonthPassRate, tags.flat, '%p');

  return (
    <KpiTile
      label={label}
      tag={tags.month}
      value={block.monthPassRate === null ? t.rateNone : formatFigure(block.monthPassRate)}
      unit={block.monthPassRate === null ? undefined : '%'}
    >
      <span className="dash-kpi-compare">
        {block.prevMonthPassRate === null ? (
          tags.prevMissing
        ) : (
          <>
            {tags.prev(formatRate(block.prevMonthPassRate))}
            {delta !== null && (
              <>
                {' · '}
                <DeltaMark direction={delta.direction}>{delta.text}</DeltaMark>
              </>
            )}
          </>
        )}
      </span>
    </KpiTile>
  );
};

/**
 * 품질 종합 KPI 의 금일 검사 LOT 칸(⭐ 사용자 지시 2026-10-19) — 합계를 크게, 그 아래 합격 · 불합격 · 검사 보류를
 * 막대와 같은 색 점으로 구분하고(색만으로 말하지 않게 글도 함께), 막대는 같은 순서로 그린다. 0건이면 막대 없음.
 */
const OverviewLotTile = ({
  label,
  tag,
  counts,
}: {
  label: string;
  tag: string;
  counts: DashboardLotCounts;
}) => (
  <KpiTile label={label} tag={tag} value={formatFigure(lotTotal(counts))} unit={t.lotUnit}>
    <span className="dash-lot-legend">
      {(['accepted', 'rejected', 'held'] as const).map((key) => (
        <span key={key} className="dash-lot-legend-item">
          <span className={`dash-lot-key dash-lot-key-${key}`} aria-hidden="true" />
          {t.lotLegend[key]}
          <strong>{formatFigure(counts[key])}</strong>
        </span>
      ))}
    </span>
    <MiniLotBar counts={counts} order="legend" />
  </KpiTile>
);

const PassRateTile = ({
  label,
  block,
  showDelta,
}: {
  label: string;
  block: DashboardQualityTypeBlock;
  showDelta?: boolean;
}) => {
  const tags = usePeriodTags();
  const delta =
    showDelta === true ? rateDelta(block.monthPassRate, block.prevMonthPassRate, tags.flat) : null;

  return (
    <KpiTile label={label} tag={tags.month} value={formatRate(block.monthPassRate)}>
      <span>
        {tags.prev(formatRate(block.prevMonthPassRate))}
        {/* 합격률은 높을수록 좋다 — 오르면 초록(`DeltaMark`). */}
        {delta !== null && (
          <>
            {' · '}
            <DeltaMark direction={delta.direction}>{delta.text}</DeltaMark>
          </>
        )}
      </span>
    </KpiTile>
  );
};

const LotTile = ({
  label,
  tag,
  counts,
}: {
  label: string;
  tag: string;
  counts: DashboardLotCounts;
}) => (
  <KpiTile label={label} tag={tag} value={formatFigure(lotTotal(counts))} unit={t.lotUnit}>
    <span>
      {t.lotBreakdown(
        formatFigure(counts.accepted),
        formatFigure(counts.rejected),
        formatFigure(counts.held),
      )}
    </span>
    <MiniLotBar counts={counts} />
  </KpiTile>
);

/** 툴팁 머리의 날짜(YYYY.MM.DD) — 첫 유형의 날짜 축을 쓴다(세 유형이 같은 날짜 축이다). */
const tipDates = (quality: DashboardQuality, kinds: readonly QualityKind[]): string[] =>
  kinds[0] === undefined
    ? []
    : blockOf(quality, kinds[0]).dailyPassRates.map((entry) => entry.date.replaceAll('-', '.'));

const dailySeries = (quality: DashboardQuality, kinds: readonly QualityKind[]): LineSeries[] =>
  kinds.map((kind, index) => ({
    name: kind,
    tone: kinds.length === 1 ? 1 : ((index + 1) as 1 | 2 | 3),
    points: blockOf(quality, kind).dailyPassRates.map((entry) => ({
      label: shortDate(entry.date),
      value: entry.passRate,
    })),
  }));

/** 품질 탭의 주 그래프가 남는 높이를 받아 커질 때의 상한(px) — 지나치게 길쭉해지지 않게(원문 6.2). */
export const FIT_CHART_MAX_H = 480;

/** 이 폭(px) 이하면 1열로 쌓여(`.dash-row2` 등) 화면 높이 채우기를 쉰다. */
const QUALITY_FILL_MIN_WIDTH = 861;

/**
 * 품질 · 부적합 탭의 틀(⭐ 사용자 지정 2026-10-16 — 품질 5개 탭 레이아웃). 화면 아래까지 남은 높이를 재서
 * `--dash-fill` 로 준다 — 주 그래프 행(2행)이 그 남는 높이를 먼저 쓴다(`.dash-tab-quality`). 1열(좁은 폭)에서는
 * 쉰다. 대시보드 탭은 이 틀을 쓰지 않는다.
 */
/**
 * 주 그래프가 상한에 닿고도 남는 높이(px, 모자라면 음수) — 틀이 그만큼 채우기 높이를 덜어 낸다. 그래프가 상한에
 * 닿으면 행도 더 늘지 않고, 남는 높이는 페이지 아래에 그대로 남는다(헤더 결정 2026-10-16).
 */
const FitSlackContext = createContext<(slack: number) => void>(() => undefined);

const QualityTabFrame = ({
  children,
  fill: fillScreen = true,
  className,
}: {
  children: ReactNode;
  /** 화면 아래까지 남은 높이 채우기 — 품질 종합은 끈다(카드 높이는 내용대로 · 사용자 지시 2026-10-19). */
  fill?: boolean;
  className?: string;
}) => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [wide, setWide] = useState(false);
  const [reduction, setReduction] = useState(0);
  const fill = useFillHeight(element);
  const reportSlack = useCallback((slack: number) => {
    if (Math.abs(slack) < 1) return;
    setReduction((current) => Math.max(0, Math.round(current + slack)));
  }, []);

  useEffect(() => {
    if (element === null || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      setWide(element.clientWidth >= QUALITY_FILL_MIN_WIDTH);
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [element]);

  const style =
    fill === null || !wide || !fillScreen
      ? undefined
      : ({ '--dash-fill': `${String(Math.max(0, fill - reduction))}px` } as CSSProperties);

  return (
    <FitSlackContext.Provider value={reportSlack}>
      <div
        ref={setElement}
        className={
          className === undefined
            ? 'dash-tab dash-tab-quality'
            : `dash-tab dash-tab-quality ${className}`
        }
        style={style}
      >
        {children}
      </div>
    </FitSlackContext.Provider>
  );
};

/**
 * 주 그래프를 카드 높이에 맞춰 다시 그린다 — 행이 늘면 그래프 실제 영역이 함께 커진다(기본 240 ~ 상한 480).
 * 자리는 크기 봉쇄(`contain: size`)로 제 높이를 행에 내지 않고, 최소 높이만 기본 그림 + 범례로 둔다. 범례 줄은
 * 재서 뺀다. 데이터가 없는 그래프에는 쓰지 않는다 — 빈 카드를 그래프 높이로 키우지 않는다(원문 6.5).
 */
const FitChart = ({ children }: { children: (height: number) => ReactNode }) => {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(CHART_H);
  const [legend, setLegend] = useState(0);
  const reportSlack = useContext(FitSlackContext);

  useEffect(() => {
    if (element === null || typeof ResizeObserver === 'undefined') return undefined;
    const measure = (): void => {
      const legendEl = element.querySelector<HTMLElement>('.dash-legend-inline');
      const legendHeight =
        legendEl === null
          ? 0
          : legendEl.offsetHeight +
            (Number.parseFloat(getComputedStyle(legendEl).marginBottom) || 0);
      setLegend(legendHeight);
      reportSlack(element.clientHeight - legendHeight - FIT_CHART_MAX_H);
      setHeight(
        Math.min(
          FIT_CHART_MAX_H,
          Math.max(CHART_H, Math.floor(element.clientHeight - legendHeight)),
        ),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();

    return () => {
      observer.disconnect();
    };
  }, [element, reportSlack]);

  return (
    <div ref={setElement} className="dash-chart-fit" style={{ minHeight: CHART_H + legend }}>
      {children(height)}
    </div>
  );
};

const DailyPanel = ({
  quality,
  kinds,
  title,
  tooltip = false,
}: {
  quality: DashboardQuality;
  kinds: readonly QualityKind[];
  title: string;
  /** 날짜 칸 툴팁(날짜 + 유형별 합격률) — 품질 종합만(사용자 지시 2026-10-19). */
  tooltip?: boolean;
}) => {
  const tags = usePeriodTags();
  const series = dailySeries(quality, kinds);
  const hasPoints = series.some((entry) => entry.points.some((point) => point.value !== null));

  return (
    <Panel
      title={title}
      sub={t.dailySub}
      tag={tags.recent}
      className={hasPoints ? 'dash-span-wide dash-panel-fit' : 'dash-span-wide'}
    >
      {hasPoints ? (
        <FitChart>
          {(height) => (
            <MultiLineChart
              series={series}
              caption={title}
              height={height}
              tooltip={tooltip}
              tipLabels={tooltip ? tipDates(quality, kinds) : undefined}
            />
          )}
        </FitChart>
      ) : (
        <MultiLineChart series={series} caption={title} />
      )}
    </Panel>
  );
};

type Counterpart = 'kind' | 'vendor' | 'customer' | 'equipment';

const counterpartColumn = (counterpart: Counterpart): Column<RecentLotRow> => {
  switch (counterpart) {
    case 'kind':
      return { key: 'kind', header: t.column.kind, render: (row) => row.kind };
    case 'vendor':
      return {
        key: 'vendor',
        header: t.column.vendor,
        render: (row) => row.counterpartName ?? t.none,
      };
    case 'customer':
      return {
        key: 'customer',
        header: t.column.customer,
        render: (row) => row.counterpartName ?? t.none,
      };
    case 'equipment':
      return {
        key: 'equipment',
        header: t.column.equipment,
        render: (row) => row.equipmentCode ?? t.none,
      };
  }
};

/**
 * 검사 일자는 「10-16」(공장 시각)만 칸에 적고, 시각까지는 `title`로 둔다 — 좁은 칸에서 일시가 두 줄로
 * 꺾였다(브라우저 확인). 읽을 수 없으면 원문.
 */
const InspectedAt = ({ value }: { value: string }) => {
  const parts = toPlantDateTimeParts(value);
  if (parts === null) return <>{value}</>;

  return (
    <time dateTime={value} title={`${parts.date} ${parts.time}`}>
      {shortDate(parts.date)}
    </time>
  );
};

const RecentLotsPanel = ({
  title,
  rows,
  counterpart,
  itemTitle = false,
}: {
  title: string;
  rows: RecentLotRow[];
  counterpart: Counterpart;
  /** 품목 칸 마우스 올림 글(코드 · 이름) — 품질 종합만(사용자 지시 2026-10-19). */
  itemTitle?: boolean;
}) => (
  <Panel title={title} tag={t.recentLotsLead}>
    {/* 제목은 패널이 이미 말한다 — 표 제목(caption)을 두면 같은 말이 두 번 보인다. 이름은 aria-label 로. */}
    <div className="dash-table-wrap">
      <Table
        columns={[
          {
            key: 'inspectedAt',
            header: t.column.inspectedAt,
            render: (row) => <InspectedAt value={row.inspectedAt} />,
          },
          counterpartColumn(counterpart),
          {
            key: 'item',
            header: t.column.item,
            /* 품목 전체(코드 · 이름)는 마우스 올림 글로 — 품질 종합은 좁은 칸에서 말줄임(사용자 지시 2026-10-19). */
            render: (row) => (
              <span
                className="dash-cell-wrap dash-cell-item"
                title={
                  itemTitle ? [row.itemCode, row.itemName].filter(Boolean).join(' ') : undefined
                }
              >
                {row.itemCode}
              </span>
            ),
          },
          /*
           * LOT 열을 두지 않는다 — 시안의 표는 일자 · 구분 · CODE · 수량 · 판정이고, 좁은 row3 칸에서 LOT 열이
           * 판정을 칸 밖으로 밀어냈다(브라우저 확인). LOT 은 PQC · OQC 에서 오지도 않는다(규격 보정).
           */
          {
            key: 'qty',
            header: t.column.qty,
            render: (row) => formatFigure(row.qty),
          },
          {
            key: 'judgment',
            header: t.column.judgment,
            render: (row) => (
              <Chip size="sm" status={JUDGMENT_TONE[row.judgmentCode]}>
                {t.judgment[row.judgmentCode]}
              </Chip>
            ),
          },
        ]}
        rows={rows}
        getRowId={(row) => `${row.kind}-${String(row.inspectionResultId)}`}
        density="compact"
        aria-label={title}
        empty={<NoRecords description={t.recentEmpty} />}
      />
    </div>
  </Panel>
);

const recentOf = (quality: DashboardQuality, kind: QualityKind): RecentLotRow[] =>
  blockOf(quality, kind).recentLots.map((lot) => ({ ...lot, kind }));

const phenomenaEntries = (entries: { defectCodeId: number; defectName: string; qty: number }[]) =>
  entries.map((entry) => ({
    key: String(entry.defectCodeId),
    label: entry.defectName,
    value: entry.qty,
  }));

const countTone = (value: number, tone: ChipStatus): ChipStatus | undefined =>
  value > 0 ? tone : undefined;

/** 품질 종합. */
/** 「현재 현황」 줄 → LOT 목록 상태(연결 규격의 status). */
const LOT_STATUS_OF_ROW: Record<string, DashboardQualityLotStatus> = {
  held: 'INSPECTION_HELD',
  receiptHold: 'RECEIPT_HOLD',
  pending: 'PQC_PENDING',
  ncOpen: 'NC_OPEN',
};

export const QualityOverviewTab = ({ quality }: { quality: DashboardQuality }) => {
  const tags = usePeriodTags();
  /* 「현재 현황」에서 고른 상태 — 그 상태의 LOT 목록 창을 연다(사용자 결정 2026-10-19). */
  const [lotStatus, setLotStatus] = useState<DashboardQualityLotStatus | null>(null);
  /* 한 번 연 뒤에는 창을 남겨 둔다 — 닫을 때 없애면 포커스가 눌렀던 줄로 돌아오지 못한다. */
  const [lotDialogMounted, setLotDialogMounted] = useState(false);
  const pointerInput = usePointerInput();
  const todayLots = sumLots([quality.iqc.todayLots, quality.pqc.todayLots, quality.oqc.todayLots]);
  const monthHeld = sumLots([
    quality.iqc.monthLots,
    quality.pqc.monthLots,
    quality.oqc.monthLots,
  ]).held;

  return (
    <QualityTabFrame fill={false} className="dash-tab-quality-overview">
      <div className="dash-kpis">
        <OverviewPassRateTile label={t.passRateOf('IQC')} block={quality.iqc} />
        <OverviewPassRateTile label={t.passRateOf('PQC')} block={quality.pqc} />
        <OverviewPassRateTile label={t.passRateOf('OQC')} block={quality.oqc} />
        <OverviewLotTile label={t.todayLots} tag={tags.today} counts={todayLots} />
        <KpiTile
          label={t.customerReturn}
          tag={tags.month}
          value={formatFigure(quality.oqc.customerReturnQty)}
          unit={t.qtyUnit}
        >
          <span>{t.customerReturnNoteShort}</span>
        </KpiTile>
      </div>
      {/*
       * ⭐ 품질 종합 배치(사용자 지시 2026-10-19 — 카드 5개 그대로, 카드 높이는 내용대로). 위: 일별 합격률(넓게) |
       * 업체별 IQC 불량 · 현재 현황(짧은 목록 둘을 세로로) — 그래프가 오른쪽 묶음 높이에 맞춰 커진다(상한 480).
       * 아래: 불량현상 구성비 | 최근 검사 LOT 판정 — 둘 다 내용 높이. 같은 행을 같은 높이로 늘이지 않는다.
       */}
      <div className="dash-qo-top">
        <DailyPanel
          quality={quality}
          kinds={['IQC', 'PQC', 'OQC']}
          title={t.dailyTitleAll}
          tooltip
        />
        <div className="dash-qo-side">
          <Panel title={t.vendorDefects} sub={t.qtyShareSub} tag={tags.monthTotal}>
            <RankBars
              entries={quality.iqc.vendorDefects.map((entry) => ({
                key: String(entry.partnerId),
                label: entry.partnerName,
                value: entry.rejectedQty,
              }))}
            />
          </Panel>
          <Panel title={t.currentTitle} tag={t.tagNow}>
            <StatusList
              rowProps={pointerFocusProps(pointerInput)}
              onSelect={(key) => {
                setLotStatus(LOT_STATUS_OF_ROW[key] ?? null);
                setLotDialogMounted(true);
              }}
              items={[
                {
                  key: 'held',
                  label: t.heldLots,
                  note: t.heldLotsNote,
                  value: formatFigure(monthHeld),
                  unit: t.lotUnit,
                  tone: countTone(monthHeld, 'warning'),
                  selectable: monthHeld > 0,
                },
                {
                  key: 'receiptHold',
                  label: t.receiptHold,
                  note: t.receiptHoldNote,
                  value: formatFigure(quality.iqc.receiptHoldLotCount),
                  unit: t.lotUnit,
                  tone: countTone(quality.iqc.receiptHoldLotCount, 'warning'),
                  selectable: quality.iqc.receiptHoldLotCount > 0,
                },
                {
                  key: 'pending',
                  label: t.pendingLots,
                  note: t.pendingLotsNote,
                  value: formatFigure(quality.pqc.pendingLotCount),
                  unit: t.lotUnit,
                  selectable: quality.pqc.pendingLotCount > 0,
                },
                {
                  key: 'ncOpen',
                  label: t.ncOpen,
                  value: formatFigure(quality.nonconformance.openCount),
                  unit: t.countUnit,
                  tone: countTone(quality.nonconformance.openCount, 'error'),
                  selectable: quality.nonconformance.openCount > 0,
                },
              ]}
            />
          </Panel>
        </div>
      </div>
      <div className="dash-qo-bottom">
        <Panel title={t.phenomena} sub={t.qtyShareSub} tag={tags.month}>
          <RankBars entries={phenomenaEntries(quality.nonconformance.phenomena)} />
        </Panel>
        <RecentLotsPanel
          title={t.recentLots}
          rows={toRecentLotRows(quality)}
          counterpart="kind"
          itemTitle
        />
      </div>
      {/* 처음 고를 때 그린다 — 그 전에는 목록을 부르지 않는다(닫힌 동안에도 부르지 않는다 · `enabled`). */}
      {lotDialogMounted && (
        <QualityLotsDialog
          status={lotStatus}
          onClose={() => {
            setLotStatus(null);
          }}
        />
      )}
    </QualityTabFrame>
  );
};

export const IqcTab = ({ quality }: { quality: DashboardQuality }) => {
  const tags = usePeriodTags();
  const iqc = quality.iqc;
  const topVendor = iqc.vendorDefects[0];
  const vendorTotal = iqc.vendorDefects.reduce((sum, entry) => sum + entry.rejectedQty, 0);

  return (
    <QualityTabFrame>
      <div className="dash-kpis">
        <PassRateTile label={t.passRateOf('IQC')} block={iqc} showDelta />
        <LotTile label={t.monthLots} tag={tags.month} counts={iqc.monthLots} />
        {/* 지금은 늘 null(양품 복원 데이터 없음) — 값이 오기 전에는 칸을 두지 않는다. */}
        {iqc.fullReinspect !== null && (
          <KpiTile
            label={t.fullReinspect}
            tag={tags.month}
            value={formatFigure(iqc.fullReinspect.inputQty)}
            unit={t.qtyUnit}
          >
            <span>
              {t.fullReinspectNote(
                formatFigure(iqc.fullReinspect.inputQty),
                formatFigure(iqc.fullReinspect.restoredQty),
              )}
            </span>
          </KpiTile>
        )}
        <KpiTile
          label={t.topVendor}
          tag={tags.month}
          value={topVendor === undefined ? t.none : topVendor.partnerName}
        >
          {topVendor !== undefined && (
            <span>{`${formatFigure(topVendor.rejectedQty)} ${t.qtyUnit}`}</span>
          )}
        </KpiTile>
      </div>
      <Row kind="row2">
        <DailyPanel quality={quality} kinds={['IQC']} title={t.dailyTitleOf('IQC')} />
        <Panel title={t.vendorDefects} sub={t.vendorTableSub} tag={tags.monthTotal}>
          {/* 표 칸은 줄을 바꾸지 않는다 — 넓으면 표 영역만 가로 스크롤(원칙 a). */}
          <div className="dash-table-wrap">
            <Table
              columns={[
                { key: 'vendor', header: t.column.vendor, render: (row) => row.partnerName },
                {
                  key: 'qty',
                  header: t.column.defectQty,
                  render: (row) => formatFigure(row.rejectedQty),
                },
                {
                  key: 'share',
                  header: t.column.share,
                  render: (row) =>
                    vendorTotal === 0
                      ? t.none
                      : `${String(Math.round((row.rejectedQty / vendorTotal) * 100))}%`,
                },
              ]}
              rows={iqc.vendorDefects}
              getRowId={(row) => String(row.partnerId)}
              density="compact"
              aria-label={t.vendorDefects}
              empty={<NoRecords />}
            />
          </div>
        </Panel>
      </Row>
      <Row kind="split">
        <div className="dash-stack">
          <Panel title={t.itemDefects} sub={t.qtyShareSub} tag={tags.month}>
            <StackedBar100
              entries={iqc.itemDefects.map((entry) => ({
                key: String(entry.itemId),
                label: entry.itemCode,
                value: entry.qty,
              }))}
            />
          </Panel>
          <Panel title={t.currentTitle} tag={t.tagNow}>
            <StatusList
              items={[
                {
                  key: 'held',
                  label: t.heldLots,
                  note: t.heldLotsNote,
                  value: formatFigure(iqc.monthLots.held),
                  unit: t.lotUnit,
                  tone: countTone(iqc.monthLots.held, 'warning'),
                },
                {
                  key: 'receiptHold',
                  label: t.receiptHold,
                  note: t.receiptHoldNote,
                  value: formatFigure(iqc.receiptHoldLotCount),
                  unit: t.lotUnit,
                  tone: countTone(iqc.receiptHoldLotCount, 'warning'),
                },
              ]}
            />
          </Panel>
        </div>
        <RecentLotsPanel
          title={t.recentLotsOf('IQC')}
          rows={recentOf(quality, 'IQC')}
          counterpart="vendor"
        />
      </Row>
    </QualityTabFrame>
  );
};

export const PqcTab = ({ quality }: { quality: DashboardQuality }) => {
  const tags = usePeriodTags();
  const pqc = quality.pqc;
  const worst = pqc.equipmentDefectRates[0];

  return (
    <QualityTabFrame>
      <div className="dash-kpis">
        <PassRateTile label={t.passRateOf('PQC')} block={pqc} />
        <LotTile label={t.pqcLots} tag={tags.month} counts={pqc.monthLots} />
        <KpiTile
          label={t.pendingLots}
          tag={t.tagNow}
          value={formatFigure(pqc.pendingLotCount)}
          unit={t.lotUnit}
        >
          <span>{t.pendingLotsNote}</span>
        </KpiTile>
        <KpiTile
          label={t.monthDefectQty}
          tag={tags.month}
          value={formatFigure(pqc.monthDefectQty)}
          unit={t.qtyUnit}
          tone={pqc.monthDefectQty > 0 ? 'error' : undefined}
        >
          <span>{t.reworkLine(formatFigure(pqc.reworkRequestCount))}</span>
        </KpiTile>
        <KpiTile
          label={t.worstEquipment}
          tag={tags.today}
          value={worst === undefined ? t.none : worst.equipmentCode}
        >
          {worst !== undefined && (
            <span>
              {t.worstEquipmentNote(formatFigure(worst.ngQty), formatRate(worst.defectRate))}
            </span>
          )}
        </KpiTile>
      </div>
      <Row kind="row2">
        <DailyPanel quality={quality} kinds={['PQC']} title={t.dailyTitleOf('PQC')} />
        <Panel title={t.equipmentDefectRates} sub={t.equipmentDefectRatesSub} tag={tags.today}>
          <RankBars
            /*
             * 불량률이 같으면 설비 코드 자연 정렬(17-1 < 17-2 < 17-10) — 서버 순서는 같은 값끼리 문자열
             * 순이었다(사용자 점검 2026-10-16). 불량률 높은 순은 그대로.
             */
            entries={[...pqc.equipmentDefectRates]
              .sort(
                (a, b) =>
                  b.defectRate - a.defectRate ||
                  compareEquipmentCode(a.equipmentCode, b.equipmentCode),
              )
              .map((entry) => ({
                key: String(entry.equipmentId),
                label: entry.equipmentCode,
                value: entry.defectRate,
              }))}
            formatValue={formatRate}
            showShare={false}
            aside={(entry) => {
              const source = pqc.equipmentDefectRates.find(
                (rate) => String(rate.equipmentId) === entry.key,
              );
              return source === undefined ? undefined : t.ngShort(formatFigure(source.ngQty));
            }}
          />
        </Panel>
      </Row>
      <Row kind="split">
        <div className="dash-stack">
          <Panel title={t.phenomenaOf('PQC')} sub={t.qtyShareSub} tag={tags.month}>
            <RankBars entries={phenomenaEntries(pqc.defectPhenomena)} />
          </Panel>
          <Panel title={t.currentTitle} tag={t.tagNow}>
            <StatusList
              items={[
                {
                  key: 'pending',
                  label: t.pendingLots,
                  note: t.pendingLotsNote,
                  value: formatFigure(pqc.pendingLotCount),
                  unit: t.lotUnit,
                  tone: countTone(pqc.pendingLotCount, 'warning'),
                },
                {
                  key: 'rework',
                  label: t.reworkRequests,
                  note: t.reworkRequestsNote,
                  value: formatFigure(pqc.reworkRequestCount),
                  unit: t.countUnit,
                },
              ]}
            />
          </Panel>
        </div>
        <RecentLotsPanel
          title={t.recentLotsOf('PQC')}
          rows={recentOf(quality, 'PQC')}
          counterpart="equipment"
        />
      </Row>
    </QualityTabFrame>
  );
};

export const OqcTab = ({ quality }: { quality: DashboardQuality }) => {
  const tags = usePeriodTags();
  const oqc = quality.oqc;

  return (
    <QualityTabFrame>
      <div className="dash-kpis">
        <PassRateTile label={t.passRateOf('OQC')} block={oqc} />
        <LotTile label={t.oqcLots} tag={tags.month} counts={oqc.monthLots} />
        <KpiTile
          label={t.customerReturn}
          tag={tags.month}
          value={formatFigure(oqc.customerReturnQty)}
          unit={t.qtyUnit}
        >
          <span>{t.customerReturnNote}</span>
        </KpiTile>
      </div>
      {/* 반품 구분 · 금액 · 반출 · 클레임 칸이 없다 — 빈 자리를 남기지 않고 넓게 쓴다. */}
      <Row kind="row2-single">
        <DailyPanel quality={quality} kinds={['OQC']} title={t.dailyTitleOf('OQC')} />
      </Row>
      <Row kind="row2-single">
        <RecentLotsPanel
          title={t.recentLotsOf('OQC')}
          rows={recentOf(quality, 'OQC')}
          counterpart="customer"
        />
      </Row>
    </QualityTabFrame>
  );
};

export const NonconformanceTab = ({ quality }: { quality: DashboardQuality }) => {
  const tags = usePeriodTags();
  const nc = quality.nonconformance;
  const paretoEntries = nc.phenomena.map((entry) => ({
    key: String(entry.defectCodeId),
    label: entry.defectName,
    value: entry.qty,
  }));
  const causes = nc.causeGroups.map((entry) => ({
    key: String(entry.causeCodeId),
    label: entry.causeName,
    value: entry.qty,
  }));

  return (
    <QualityTabFrame>
      <div className="dash-kpis">
        <KpiTile
          label={t.ncMonthQty}
          tag={tags.month}
          value={formatFigure(nc.monthQty)}
          unit={t.qtyUnit}
          tone={nc.monthQty > 0 ? 'error' : undefined}
        />
        <KpiTile
          label={t.ncScrap}
          tag={tags.month}
          value={formatFigure(nc.scrapQty)}
          unit={t.qtyUnit}
        >
          <span>{t.ncScrapNote}</span>
        </KpiTile>
        <KpiTile
          label={t.ncReworkReleased}
          tag={tags.month}
          value={formatFigure(nc.reworkReleasedQty)}
          unit={t.qtyUnit}
        >
          <span>{t.ncReworkReleasedNote}</span>
        </KpiTile>
        <KpiTile
          label={t.ncOpen}
          tag={t.tagNow}
          value={formatFigure(nc.openCount)}
          unit={t.countUnit}
        />
        {/* 지금은 늘 null(조치 기한 데이터 없음) — 값이 오기 전에는 칸을 두지 않는다. */}
        {nc.overdueCount !== null && (
          <KpiTile
            label={t.ncOverdue}
            tag={t.tagNow}
            value={formatFigure(nc.overdueCount)}
            unit={t.countUnit}
            tone={nc.overdueCount > 0 ? 'warning' : undefined}
          />
        )}
      </div>
      <Row kind="row2">
        <Panel
          title={t.ncPareto}
          sub={t.paretoSub}
          tag={tags.month}
          className={paretoEntries.length > 0 ? 'dash-span-wide dash-panel-fit' : 'dash-span-wide'}
        >
          {paretoEntries.length > 0 ? (
            <FitChart>
              {(height) => (
                <ParetoChart entries={paretoEntries} caption={t.ncPareto} height={height} />
              )}
            </FitChart>
          ) : (
            <ParetoChart entries={paretoEntries} caption={t.ncPareto} />
          )}
        </Panel>
        <Panel title={t.ncCauseGroups} sub={t.qtyShareSub} tag={tags.month}>
          <RankBars entries={causes} />
        </Panel>
      </Row>
      <Row kind="row3">
        <Panel title={t.ncCauseShare} sub={t.qtyShareSub} tag={tags.month}>
          <StackedBar100 entries={causes} />
        </Panel>
        <Panel title={t.ncHandlingTitle} tag={tags.month}>
          <StatusList
            items={[
              {
                key: 'scrap',
                label: t.ncScrap,
                note: t.ncScrapNote,
                value: formatFigure(nc.scrapQty),
                unit: t.qtyUnit,
              },
              {
                key: 'released',
                label: t.ncReworkReleased,
                note: t.ncReworkReleasedNote,
                value: formatFigure(nc.reworkReleasedQty),
                unit: t.qtyUnit,
              },
              {
                key: 'open',
                label: t.ncOpen,
                value: formatFigure(nc.openCount),
                unit: t.countUnit,
                tone: countTone(nc.openCount, 'error'),
              },
              ...(nc.overdueCount === null
                ? []
                : [
                    {
                      key: 'overdue',
                      label: t.ncOverdue,
                      value: formatFigure(nc.overdueCount),
                      unit: t.countUnit,
                      tone: countTone(nc.overdueCount, 'warning'),
                    },
                  ]),
            ]}
          />
        </Panel>
      </Row>
    </QualityTabFrame>
  );
};

export interface QualityGateProps {
  quality: DashboardQuality | null;
  isLoading: boolean;
  /** 첫 조회가 실패해 보일 값이 없다. 재시도는 화면 위 오류 배너가 맡는다. */
  isFailed: boolean;
  children: (quality: DashboardQuality) => ReactNode;
}

/**
 * 다섯 품질 탭이 함께 쓰는 문 — 불러오는 중 · 섹션이 오지 않음 · 첫 조회 실패를 한 곳에서 가른다.
 * ⭐ 품질은 **summary 의 `quality` 섹션**으로 온다(규격 보정 2026-10-16) — 탭을 열 때 따로 부르지 않는다.
 */
export const QualityGate = ({ quality, isLoading, isFailed, children }: QualityGateProps) => {
  if (isLoading) return <Skeleton variant="rect" height="16rem" />;

  if (quality === null) {
    return <EmptyLine live text={isFailed ? t.failed : t.absent} />;
  }

  return <>{children(quality)}</>;
};
