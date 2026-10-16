import { Chip, Skeleton, Table, type ChipStatus, type Column } from '@crefle/web-ui';
import type {
  DashboardJudgmentCode,
  DashboardLotCounts,
  DashboardQuality,
  DashboardQualityTypeBlock,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

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
import { formatFigure } from './types';
import {
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

/** 전월 대비 p(퍼센트 포인트). 둘 중 하나라도 없으면 `null`. */
export const rateDelta = (month: number | null, prev: number | null): string | null => {
  if (month === null || prev === null) return null;
  const diff = Math.round((month - prev) * 10) / 10;

  return diff > 0
    ? t.deltaUp(formatFigure(diff))
    : diff < 0
      ? t.deltaDown(formatFigure(-diff))
      : t.deltaFlat;
};

const JUDGMENT_TONE: Record<DashboardJudgmentCode, ChipStatus> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
};

const Row = ({
  kind,
  children,
}: {
  kind: 'row2' | 'row2-single' | 'row3';
  children: ReactNode;
}) => <div className={`dash-${kind}`}>{children}</div>;

const PassRateTile = ({
  label,
  block,
  showDelta,
}: {
  label: string;
  block: DashboardQualityTypeBlock;
  showDelta?: boolean;
}) => {
  const delta = showDelta === true ? rateDelta(block.monthPassRate, block.prevMonthPassRate) : null;

  return (
    <KpiTile label={label} tag={t.tagMonth} value={formatRate(block.monthPassRate)}>
      <span>
        {t.prevMonth(formatRate(block.prevMonthPassRate))}
        {delta !== null && ` · ${delta}`}
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

const dailySeries = (quality: DashboardQuality, kinds: readonly QualityKind[]): LineSeries[] =>
  kinds.map((kind, index) => ({
    name: kind,
    tone: kinds.length === 1 ? 1 : ((index + 1) as 1 | 2 | 3),
    points: blockOf(quality, kind).dailyPassRates.map((entry) => ({
      label: shortDate(entry.date),
      value: entry.passRate,
    })),
  }));

const DailyPanel = ({
  quality,
  kinds,
  title,
}: {
  quality: DashboardQuality;
  kinds: readonly QualityKind[];
  title: string;
}) => (
  <Panel title={title} sub={t.dailySub} tag={t.dailyRecent} className="dash-span-wide">
    <MultiLineChart series={dailySeries(quality, kinds)} caption={title} />
  </Panel>
);

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
}: {
  title: string;
  rows: RecentLotRow[];
  counterpart: Counterpart;
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
            render: (row) => <span className="dash-cell-wrap">{row.itemCode}</span>,
          },
          /*
           * LOT 열을 두지 않는다 — 시안의 표는 일자 · 구분 · CODE · 수량 · 판정이고, 좁은 row3 칸에서 LOT 열이
           * 판정을 칸 밖으로 밀어냈다(브라우저 확인). LOT 은 PQC · OQC 에서 오지도 않는다(규격 보정).
           */
          {
            key: 'qty',
            header: t.column.qty,
            align: 'end',
            render: (row) => formatFigure(row.qty),
          },
          {
            key: 'judgment',
            header: t.column.judgment,
            align: 'center',
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
export const QualityOverviewTab = ({ quality }: { quality: DashboardQuality }) => {
  const todayLots = sumLots([quality.iqc.todayLots, quality.pqc.todayLots, quality.oqc.todayLots]);
  const monthHeld = sumLots([
    quality.iqc.monthLots,
    quality.pqc.monthLots,
    quality.oqc.monthLots,
  ]).held;

  return (
    <div className="dash-tab">
      <div className="dash-kpis">
        <PassRateTile label={t.passRateOf('IQC')} block={quality.iqc} showDelta />
        <PassRateTile label={t.passRateOf('PQC')} block={quality.pqc} />
        <PassRateTile label={t.passRateOf('OQC')} block={quality.oqc} />
        <LotTile label={t.todayLots} tag={t.tagToday} counts={todayLots} />
        <KpiTile
          label={t.customerReturn}
          tag={t.tagMonth}
          value={formatFigure(quality.oqc.customerReturnQty)}
          unit={t.qtyUnit}
        >
          <span>{t.customerReturnNote}</span>
        </KpiTile>
      </div>
      <Row kind="row2">
        <DailyPanel quality={quality} kinds={['IQC', 'PQC', 'OQC']} title={t.dailyTitleAll} />
        <Panel title={t.vendorDefects} sub={t.qtyShareSub} tag={t.tagMonthTotal}>
          <RankBars
            entries={quality.iqc.vendorDefects.map((entry) => ({
              key: String(entry.partnerId),
              label: entry.partnerName,
              value: entry.rejectedQty,
            }))}
          />
        </Panel>
      </Row>
      <Row kind="row3">
        <Panel title={t.phenomena} sub={t.qtyShareSub} tag={t.tagMonth}>
          <RankBars entries={phenomenaEntries(quality.nonconformance.phenomena)} />
        </Panel>
        <RecentLotsPanel title={t.recentLots} rows={toRecentLotRows(quality)} counterpart="kind" />
        <Panel title={t.currentTitle} tag={t.tagNow}>
          <StatusList
            items={[
              {
                key: 'held',
                label: t.heldLots,
                note: t.heldLotsNote,
                value: formatFigure(monthHeld),
                unit: t.lotUnit,
                tone: countTone(monthHeld, 'warning'),
              },
              {
                key: 'receiptHold',
                label: t.receiptHold,
                note: t.receiptHoldNote,
                value: formatFigure(quality.iqc.receiptHoldLotCount),
                unit: t.lotUnit,
                tone: countTone(quality.iqc.receiptHoldLotCount, 'warning'),
              },
              {
                key: 'pending',
                label: t.pendingLots,
                note: t.pendingLotsNote,
                value: formatFigure(quality.pqc.pendingLotCount),
                unit: t.lotUnit,
              },
              {
                key: 'ncOpen',
                label: t.ncOpen,
                value: formatFigure(quality.nonconformance.openCount),
                unit: t.countUnit,
                tone: countTone(quality.nonconformance.openCount, 'error'),
              },
            ]}
          />
        </Panel>
      </Row>
    </div>
  );
};

export const IqcTab = ({ quality }: { quality: DashboardQuality }) => {
  const iqc = quality.iqc;
  const topVendor = iqc.vendorDefects[0];
  const vendorTotal = iqc.vendorDefects.reduce((sum, entry) => sum + entry.rejectedQty, 0);

  return (
    <div className="dash-tab">
      <div className="dash-kpis">
        <PassRateTile label={t.passRateOf('IQC')} block={iqc} showDelta />
        <LotTile label={t.monthLots} tag={t.tagMonth} counts={iqc.monthLots} />
        {/* 지금은 늘 null(양품 복원 데이터 없음) — 값이 오기 전에는 칸을 두지 않는다. */}
        {iqc.fullReinspect !== null && (
          <KpiTile
            label={t.fullReinspect}
            tag={t.tagMonth}
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
          tag={t.tagMonth}
          value={topVendor === undefined ? t.none : topVendor.partnerName}
        >
          {topVendor !== undefined && (
            <span>{`${formatFigure(topVendor.rejectedQty)} ${t.qtyUnit}`}</span>
          )}
        </KpiTile>
      </div>
      <Row kind="row2">
        <DailyPanel quality={quality} kinds={['IQC']} title={t.dailyTitleOf('IQC')} />
        <Panel title={t.vendorDefects} sub={t.vendorTableSub} tag={t.tagMonthTotal}>
          <Table
            columns={[
              { key: 'vendor', header: t.column.vendor, render: (row) => row.partnerName },
              {
                key: 'qty',
                header: t.column.defectQty,
                align: 'end',
                render: (row) => formatFigure(row.rejectedQty),
              },
              {
                key: 'share',
                header: t.column.share,
                align: 'end',
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
        </Panel>
      </Row>
      <Row kind="row3">
        <Panel title={t.itemDefects} sub={t.qtyShareSub} tag={t.tagMonth}>
          <StackedBar100
            entries={iqc.itemDefects.map((entry) => ({
              key: String(entry.itemId),
              label: entry.itemCode,
              value: entry.qty,
            }))}
          />
        </Panel>
        <RecentLotsPanel
          title={t.recentLotsOf('IQC')}
          rows={recentOf(quality, 'IQC')}
          counterpart="vendor"
        />
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
      </Row>
    </div>
  );
};

export const PqcTab = ({ quality }: { quality: DashboardQuality }) => {
  const pqc = quality.pqc;
  const worst = pqc.equipmentDefectRates[0];

  return (
    <div className="dash-tab">
      <div className="dash-kpis">
        <PassRateTile label={t.passRateOf('PQC')} block={pqc} />
        <LotTile label={t.pqcLots} tag={t.tagMonth} counts={pqc.monthLots} />
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
          tag={t.tagMonth}
          value={formatFigure(pqc.monthDefectQty)}
          unit={t.qtyUnit}
          tone={pqc.monthDefectQty > 0 ? 'error' : undefined}
        >
          <span>{t.reworkLine(formatFigure(pqc.reworkRequestCount))}</span>
        </KpiTile>
        <KpiTile
          label={t.worstEquipment}
          tag={t.tagToday}
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
        <Panel title={t.equipmentDefectRates} sub={t.equipmentDefectRatesSub} tag={t.tagToday}>
          <RankBars
            entries={pqc.equipmentDefectRates.map((entry) => ({
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
      <Row kind="row3">
        <Panel title={t.phenomenaOf('PQC')} sub={t.qtyShareSub} tag={t.tagMonth}>
          <RankBars entries={phenomenaEntries(pqc.defectPhenomena)} />
        </Panel>
        <RecentLotsPanel
          title={t.recentLotsOf('PQC')}
          rows={recentOf(quality, 'PQC')}
          counterpart="equipment"
        />
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
      </Row>
    </div>
  );
};

export const OqcTab = ({ quality }: { quality: DashboardQuality }) => {
  const oqc = quality.oqc;

  return (
    <div className="dash-tab">
      <div className="dash-kpis">
        <PassRateTile label={t.passRateOf('OQC')} block={oqc} />
        <LotTile label={t.oqcLots} tag={t.tagMonth} counts={oqc.monthLots} />
        <KpiTile
          label={t.customerReturn}
          tag={t.tagMonth}
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
    </div>
  );
};

export const NonconformanceTab = ({ quality }: { quality: DashboardQuality }) => {
  const nc = quality.nonconformance;
  const causes = nc.causeGroups.map((entry) => ({
    key: String(entry.causeCodeId),
    label: entry.causeName,
    value: entry.qty,
  }));

  return (
    <div className="dash-tab">
      <div className="dash-kpis">
        <KpiTile
          label={t.ncMonthQty}
          tag={t.tagMonth}
          value={formatFigure(nc.monthQty)}
          unit={t.qtyUnit}
          tone={nc.monthQty > 0 ? 'error' : undefined}
        />
        <KpiTile
          label={t.ncScrap}
          tag={t.tagMonth}
          value={formatFigure(nc.scrapQty)}
          unit={t.qtyUnit}
        >
          <span>{t.ncScrapNote}</span>
        </KpiTile>
        <KpiTile
          label={t.ncReworkReleased}
          tag={t.tagMonth}
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
        <Panel title={t.ncPareto} sub={t.paretoSub} tag={t.tagMonth} className="dash-span-wide">
          <ParetoChart
            entries={nc.phenomena.map((entry) => ({
              key: String(entry.defectCodeId),
              label: entry.defectName,
              value: entry.qty,
            }))}
            caption={t.ncPareto}
          />
        </Panel>
        <Panel title={t.ncCauseGroups} sub={t.qtyShareSub} tag={t.tagMonth}>
          <RankBars entries={causes} />
        </Panel>
      </Row>
      <Row kind="row3">
        <Panel title={t.ncCauseShare} sub={t.qtyShareSub} tag={t.tagMonth}>
          <StackedBar100 entries={causes} />
        </Panel>
        <Panel title={t.ncHandlingTitle} tag={t.tagMonth}>
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
    </div>
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
