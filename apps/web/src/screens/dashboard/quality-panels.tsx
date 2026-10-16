import {
  BarChart,
  Chip,
  EmptyState,
  LineChart,
  PieChart,
  Skeleton,
  StatCard,
  Table,
  type ChipStatus,
  type Column,
} from '@crefle/web-ui';
import type {
  DashboardJudgmentCode,
  DashboardQuality,
  DashboardQualityTypeBlock,
} from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  blockOf,
  lotTotal,
  shortDate,
  sumLots,
  toDailyPoints,
  toDailyRateRows,
  toRecentLotRows,
  type DailyRateRow,
  type QualityKind,
  type RecentLotRow,
} from './quality';
import { formatFigure } from './types';

const t = messages.dashboard.quality;

/** 합격률 · 불량률 표기. 모수가 0이라 `null`이면 「—」 — ⛔ 0%로 그리지 않는다. */
export const formatRate = (rate: number | null): string =>
  rate === null ? t.rateNone : t.percent(formatFigure(rate));

const JUDGMENT_TONE: Record<DashboardJudgmentCode, ChipStatus> = {
  ACCEPTED: 'success',
  REJECTED: 'error',
  HELD: 'warning',
};

const JudgmentChip = ({ code }: { code: DashboardJudgmentCode }) => (
  <Chip size="sm" status={JUDGMENT_TONE[code]}>
    {t.judgment[code]}
  </Chip>
);

const Block = ({
  title,
  lead,
  children,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
}) => (
  <section className="dashboard-quality-block" aria-label={title}>
    <h3 className="dashboard-subtitle">{title}</h3>
    {lead !== undefined && <p className="pane-lead">{lead}</p>}
    {children}
  </section>
);

const NoRecords = () => <EmptyState size="sm" title={t.noRecordsTitle} description={t.noRecords} />;

const lotNote = (counts: { accepted: number; rejected: number; held: number }): string =>
  t.lotBreakdown(
    formatFigure(counts.accepted),
    formatFigure(counts.rejected),
    formatFigure(counts.held),
  );

const Note = ({ lines }: { lines: string[] }) => (
  <span className="kpi-card-note">
    {lines.map((line) => (
      <span key={line}>{line}</span>
    ))}
  </span>
);

const PassRateCard = ({ label, block }: { label: string; block: DashboardQualityTypeBlock }) => (
  <StatCard label={label} value={formatRate(block.monthPassRate)} bordered>
    <Note lines={[t.prevMonth(formatRate(block.prevMonthPassRate))]} />
  </StatCard>
);

const LotCard = ({
  label,
  counts,
}: {
  label: string;
  counts: { accepted: number; rejected: number; held: number };
}) => (
  <StatCard label={label} value={formatFigure(lotTotal(counts))} unit={t.lotUnit} bordered>
    <Note lines={[lotNote(counts)]} />
  </StatCard>
);

const QtyCard = ({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: number;
  unit: string;
  note?: string;
}) => (
  <StatCard label={label} value={formatFigure(value)} unit={unit} bordered>
    {note !== undefined && <Note lines={[note]} />}
  </StatCard>
);

/** 이름 · 수량 목록을 막대로. 비어 있으면 「기록 없음」 — 불량 기록이 아직 쌓이지 않는 자리가 있다. */
const QtyBars = ({
  name,
  entries,
}: {
  name: string;
  entries: { label: string; value: number }[];
}) =>
  entries.length === 0 ? (
    <NoRecords />
  ) : (
    <BarChart
      series={[{ name, data: entries }]}
      formatValue={formatFigure}
      height={220}
      showLegend={false}
    />
  );

const Phenomena = ({
  entries,
}: {
  entries: { defectCodeId: number; defectName: string; qty: number }[];
}) =>
  entries.length === 0 ? (
    <NoRecords />
  ) : (
    <PieChart
      donut
      data={entries.map((entry) => ({ label: entry.defectName, value: entry.qty }))}
      formatValue={formatFigure}
      height={220}
    />
  );

/** 단일 유형 일별 합격률. ⛔ 목표선을 긋지 않는다 — 목표값은 MES DB에 없다. */
const DailyRateChart = ({
  kind,
  block,
}: {
  kind: QualityKind;
  block: DashboardQualityTypeBlock;
}) => {
  const points = toDailyPoints(block);

  return (
    <Block title={`${kind} ${t.dailyTitle}`} lead={`${t.dailyRecent} · ${t.dailyGapNote}`}>
      {points.length === 0 ? (
        <EmptyState size="sm" title={t.noRecordsTitle} description={t.dailyEmpty} />
      ) : (
        <LineChart
          series={[{ name: `${kind} ${t.passRate}`, data: points }]}
          formatValue={formatFigure}
          height={220}
          showPoints
          showLegend={false}
        />
      )}
    </Block>
  );
};

const DAILY_COLUMNS: Column<DailyRateRow>[] = [
  { key: 'date', header: t.dailyColumn, render: (row) => shortDate(row.date) },
  ...(['IQC', 'PQC', 'OQC'] as const).map((kind) => ({
    key: kind,
    header: kind,
    align: 'end' as const,
    render: (row: DailyRateRow) => formatRate(row.rates[kind]),
  })),
];

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

const RecentLots = ({ rows, counterpart }: { rows: RecentLotRow[]; counterpart: Counterpart }) => (
  <Block title={t.recentLots} lead={t.recentLotsLead}>
    <Table
      columns={[
        {
          key: 'inspectedAt',
          header: t.column.inspectedAt,
          render: (row) => formatPlantDateTime(row.inspectedAt) ?? row.inspectedAt,
        },
        counterpartColumn(counterpart),
        { key: 'item', header: t.column.item, render: (row) => `${row.itemCode} ${row.itemName}` },
        /* PQC · OQC 는 LOT 번호가 오지 않는다(규격 보정) — 「—」. */
        { key: 'lotNo', header: t.column.lotNo, render: (row) => row.lotNo ?? t.none },
        { key: 'qty', header: t.column.qty, align: 'end', render: (row) => formatFigure(row.qty) },
        {
          key: 'judgment',
          header: t.column.judgment,
          render: (row) => <JudgmentChip code={row.judgmentCode} />,
        },
      ]}
      rows={rows}
      getRowId={(row) => `${row.kind}-${String(row.inspectionResultId)}`}
      density="compact"
      caption={t.recentLots}
      empty={<EmptyState size="sm" title={t.noRecordsTitle} description={t.recentEmpty} />}
    />
  </Block>
);

const recentOf = (quality: DashboardQuality, kind: QualityKind): RecentLotRow[] =>
  blockOf(quality, kind).recentLots.map((lot) => ({ ...lot, kind }));

/** 품질 종합 — 세 유형 합격률 · 금일 검사 LOT · 일별 합격률 · 업체별 IQC 불량 · 불량현상 · 최근 판정. */
export const QualityOverviewTab = ({ quality }: { quality: DashboardQuality }) => (
  <div className="dashboard-quality">
    <p className="pane-lead">{t.passRateRule}</p>
    <div className="kpi-grid">
      <PassRateCard label={t.monthPassRate('IQC')} block={quality.iqc} />
      <PassRateCard label={t.monthPassRate('PQC')} block={quality.pqc} />
      <PassRateCard label={t.monthPassRate('OQC')} block={quality.oqc} />
      <LotCard
        label={t.todayLots}
        counts={sumLots([quality.iqc.todayLots, quality.pqc.todayLots, quality.oqc.todayLots])}
      />
    </div>
    <Block title={t.dailyTitle} lead={t.dailyRecent}>
      <Table
        columns={DAILY_COLUMNS}
        rows={toDailyRateRows(quality)}
        getRowId={(row) => row.date}
        density="compact"
        caption={t.dailyTitle}
        empty={<EmptyState size="sm" title={t.noRecordsTitle} description={t.dailyEmpty} />}
      />
    </Block>
    <Block title={t.vendorDefects} lead={t.vendorDefectsLead}>
      <QtyBars
        name={t.vendorDefects}
        entries={quality.iqc.vendorDefects.map((entry) => ({
          label: entry.partnerName,
          value: entry.rejectedQty,
        }))}
      />
    </Block>
    <Block title={t.phenomena} lead={t.phenomenaMonth}>
      <Phenomena entries={quality.nonconformance.phenomena} />
    </Block>
    <RecentLots rows={toRecentLotRows(quality)} counterpart="kind" />
  </div>
);

export const IqcTab = ({ quality }: { quality: DashboardQuality }) => {
  const iqc = quality.iqc;
  const topVendor = iqc.vendorDefects[0];

  return (
    <div className="dashboard-quality">
      <p className="pane-lead">{t.passRateRule}</p>
      <div className="kpi-grid">
        <PassRateCard label={t.passRate} block={iqc} />
        <LotCard label={t.monthLots} counts={iqc.monthLots} />
        <LotCard label={t.todayLots} counts={iqc.todayLots} />
        <QtyCard label={t.monthDefectQty} value={iqc.monthDefectQty} unit={t.qtyUnit} />
        <StatCard
          label={t.topVendor}
          value={topVendor === undefined ? t.none : topVendor.partnerName}
          bordered
        >
          {topVendor !== undefined && (
            <Note lines={[`${formatFigure(topVendor.rejectedQty)} ${t.qtyUnit}`]} />
          )}
        </StatCard>
        <QtyCard
          label={t.receiptHold}
          value={iqc.receiptHoldLotCount}
          unit={t.lotUnit}
          note={t.receiptHoldNote}
        />
        {/* 지금은 늘 null(양품 복원 데이터 없음) — 값이 오기 전에는 칸을 두지 않는다. */}
        {iqc.fullReinspect !== null && (
          <StatCard
            label={t.fullReinspect}
            value={formatFigure(iqc.fullReinspect.restoredQty)}
            unit={t.qtyUnit}
            bordered
          >
            <Note
              lines={[
                t.fullReinspectNote(
                  formatFigure(iqc.fullReinspect.inputQty),
                  formatFigure(iqc.fullReinspect.restoredQty),
                ),
              ]}
            />
          </StatCard>
        )}
      </div>
      <DailyRateChart kind="IQC" block={iqc} />
      <Block title={t.vendorDefects} lead={t.vendorDefectsLead}>
        <QtyBars
          name={t.vendorDefects}
          entries={iqc.vendorDefects.map((entry) => ({
            label: entry.partnerName,
            value: entry.rejectedQty,
          }))}
        />
      </Block>
      <Block title={t.itemDefects} lead={t.phenomenaMonth}>
        <Table
          columns={[
            {
              key: 'itemCode',
              header: t.column.item,
              render: (row) => `${row.itemCode} ${row.itemName}`,
            },
            {
              key: 'qty',
              header: t.column.qtyOnly,
              align: 'end',
              render: (row) => formatFigure(row.qty),
            },
          ]}
          rows={iqc.itemDefects}
          getRowId={(row) => String(row.itemId)}
          density="compact"
          caption={t.itemDefects}
          empty={<NoRecords />}
        />
      </Block>
      <RecentLots rows={recentOf(quality, 'IQC')} counterpart="vendor" />
    </div>
  );
};

export const PqcTab = ({ quality }: { quality: DashboardQuality }) => {
  const pqc = quality.pqc;
  const worst = pqc.equipmentDefectRates[0];

  return (
    <div className="dashboard-quality">
      <p className="pane-lead">{t.passRateRule}</p>
      <div className="kpi-grid">
        <PassRateCard label={t.passRate} block={pqc} />
        <LotCard label={t.monthLots} counts={pqc.monthLots} />
        <QtyCard
          label={t.pendingLots}
          value={pqc.pendingLotCount}
          unit={t.lotUnit}
          note={t.pendingLotsNote}
        />
        <QtyCard label={t.monthDefectQty} value={pqc.monthDefectQty} unit={t.qtyUnit} />
        <QtyCard
          label={t.reworkRequests}
          value={pqc.reworkRequestCount}
          unit={t.countUnit}
          note={t.reworkRequestsNote}
        />
        <StatCard
          label={t.worstEquipment}
          value={worst === undefined ? t.none : worst.equipmentCode}
          bordered
        >
          {worst !== undefined && <Note lines={[formatRate(worst.defectRate)]} />}
        </StatCard>
      </div>
      <DailyRateChart kind="PQC" block={pqc} />
      <Block title={t.equipmentDefectRates} lead={t.equipmentDefectRatesLead}>
        <QtyBars
          name={t.column.rate}
          entries={pqc.equipmentDefectRates.map((entry) => ({
            label: entry.equipmentCode,
            value: entry.defectRate,
          }))}
        />
      </Block>
      <Block title={t.phenomena} lead={t.phenomenaMonth}>
        <Phenomena entries={pqc.defectPhenomena} />
      </Block>
      <RecentLots rows={recentOf(quality, 'PQC')} counterpart="equipment" />
    </div>
  );
};

export const OqcTab = ({ quality }: { quality: DashboardQuality }) => {
  const oqc = quality.oqc;

  return (
    <div className="dashboard-quality">
      <p className="pane-lead">{t.passRateRule}</p>
      <div className="kpi-grid">
        <PassRateCard label={t.passRate} block={oqc} />
        <LotCard label={t.monthLots} counts={oqc.monthLots} />
        <LotCard label={t.todayLots} counts={oqc.todayLots} />
        <QtyCard label={t.monthDefectQty} value={oqc.monthDefectQty} unit={t.qtyUnit} />
        <QtyCard
          label={t.customerReturn}
          value={oqc.customerReturnQty}
          unit={t.qtyUnit}
          note={t.customerReturnNote}
        />
      </div>
      <DailyRateChart kind="OQC" block={oqc} />
      <RecentLots rows={recentOf(quality, 'OQC')} counterpart="customer" />
    </div>
  );
};

export const NonconformanceTab = ({ quality }: { quality: DashboardQuality }) => {
  const nc = quality.nonconformance;

  return (
    <div className="dashboard-quality">
      <div className="kpi-grid">
        <QtyCard label={t.ncMonthQty} value={nc.monthQty} unit={t.qtyUnit} />
        <QtyCard label={t.ncOpen} value={nc.openCount} unit={t.countUnit} />
        {/* 지금은 늘 null(조치 기한 데이터 없음) — 값이 오기 전에는 칸을 두지 않는다. */}
        {nc.overdueCount !== null && (
          <StatCard
            label={t.ncOverdue}
            value={formatFigure(nc.overdueCount)}
            unit={t.countUnit}
            status={nc.overdueCount > 0 ? 'warning' : undefined}
            statusLabel={nc.overdueCount > 0 ? t.ncOverdue : undefined}
            bordered
          />
        )}
        <QtyCard label={t.ncScrap} value={nc.scrapQty} unit={t.qtyUnit} note={t.ncScrapNote} />
        <QtyCard
          label={t.ncReworkReleased}
          value={nc.reworkReleasedQty}
          unit={t.qtyUnit}
          note={t.ncReworkReleasedNote}
        />
      </div>
      <Block title={t.ncPareto} lead={t.phenomenaMonth}>
        {/* 파레토 — 서버가 많은 순으로 준다. 화면이 다시 정렬하지 않는다. */}
        <QtyBars
          name={t.ncPareto}
          entries={nc.phenomena.map((entry) => ({ label: entry.defectName, value: entry.qty }))}
        />
      </Block>
      <Block title={t.ncCauseGroups} lead={t.phenomenaMonth}>
        <QtyBars
          name={t.ncCauseGroups}
          entries={nc.causeGroups.map((entry) => ({ label: entry.causeName, value: entry.qty }))}
        />
      </Block>
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
 *
 * ⭐ 품질은 **summary 의 `quality` 섹션**으로 온다(규격 보정 2026-10-16) — 탭을 열 때 따로 부르지 않는다.
 */
export const QualityGate = ({ quality, isLoading, isFailed, children }: QualityGateProps) => {
  if (isLoading) return <Skeleton variant="rect" height="16rem" />;

  if (quality === null) {
    return (
      <EmptyState
        size="sm"
        live
        title={t.absentTitle}
        description={isFailed ? t.failed : t.absent}
      />
    );
  }

  return <>{children(quality)}</>;
};
