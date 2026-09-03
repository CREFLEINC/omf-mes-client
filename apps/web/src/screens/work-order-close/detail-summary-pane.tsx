import { EmptyState, SkeletonText, StatCard } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { JSX, ReactNode } from 'react';

import type { WorkOrderCloseCompletionJudgment } from './close-readiness';
import type { WorkOrderCloseDetailFact } from './queries';

const t = messages.workOrderClose.detailSummary;

const JUDGMENT_LABELS = {
  UNDER: t.judgments.UNDER,
  NORMAL: t.judgments.NORMAL,
  OVER: t.judgments.OVER,
} as const satisfies Record<WorkOrderCloseCompletionJudgment, string>;

export type WorkOrderCloseDetailSummaryState =
  | { kind: 'CHECKING' }
  | { kind: 'UNAVAILABLE'; content: ReactNode }
  | { kind: 'RESOLVED'; detail: WorkOrderCloseDetailFact; unitLabel: string | null };

export interface WorkOrderCloseDetailSummaryPaneProps {
  state: WorkOrderCloseDetailSummaryState;
}

interface SummaryStat {
  key: string;
  label: string;
  value: number;
}

interface QuantityStat {
  key: string;
  label: string;
  value: number | undefined;
}

const displayQuantity = (value: number | undefined): string =>
  value === undefined ? t.values.notConfirmed : String(value);

const quantityUnit = (unitLabel: string | null): string =>
  unitLabel === null || unitLabel.trim() === '' ? t.values.unitNotConfirmed : unitLabel;

const formatAchievementRate = (rate: number): string =>
  new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 6,
    useGrouping: false,
  }).format(rate * 100);

export const WorkOrderCloseDetailSummaryPane = ({
  state,
}: WorkOrderCloseDetailSummaryPaneProps): JSX.Element => {
  if (state.kind === 'CHECKING') {
    return (
      <section aria-label={t.pane} className="pane work-order-close-summary-pane">
        <h2 className="pane-title">{t.heading}</h2>
        <div aria-label={t.loading} role="status">
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }

  if (state.kind === 'UNAVAILABLE') {
    return (
      <section aria-label={t.pane} className="pane work-order-close-summary-pane">
        <h2 className="pane-title">{t.heading}</h2>
        {state.content}
      </section>
    );
  }

  const { detail, unitLabel } = state;
  const unit = quantityUnit(unitLabel);
  const progressStats: QuantityStat[] =
    detail.progress === null
      ? []
      : [
          { key: 'goodQty', label: t.fields.goodQty, value: detail.progress.goodQty },
          { key: 'defectQty', label: t.fields.defectQty, value: detail.progress.defectQty },
          { key: 'holdQty', label: t.fields.holdQty, value: detail.progress.holdQty },
          { key: 'scrapQty', label: t.fields.scrapQty, value: detail.progress.scrapQty },
          { key: 'reworkQty', label: t.fields.reworkQty, value: detail.progress.reworkQty },
          { key: 'varianceQty', label: t.fields.varianceQty, value: detail.progress.varianceQty },
        ];
  const preIssuedLotStats: SummaryStat[] =
    detail.preIssuedLots === null
      ? []
      : [
          {
            key: 'slotCount',
            label: t.fields.slotCount,
            value: detail.preIssuedLots.slotCount,
          },
          {
            key: 'withResultCount',
            label: t.fields.withResultCount,
            value: detail.preIssuedLots.withResultCount,
          },
          {
            key: 'withoutResultCount',
            label: t.fields.withoutResultCount,
            value: detail.preIssuedLots.withoutResultCount,
          },
        ];

  return (
    <section aria-label={t.pane} className="pane work-order-close-summary-pane">
      <h2 className="pane-title">{t.heading}</h2>
      <div className="work-order-close-summary-section">
        <h3>{t.groups.order}</h3>
        <div aria-label={t.groups.order} className="work-order-close-stats" role="group">
          <dl className="field-cell work-order-close-order-field">
            <dt className="field-label">{t.fields.workOrderNo}</dt>
            <dd>{detail.workOrderNo}</dd>
          </dl>
          <StatCard label={t.fields.orderQty} value={String(detail.orderQty)} unit={unit} />
        </div>
      </div>

      <div className="work-order-close-summary-section">
        <h3>{t.groups.progress}</h3>
        {detail.progress === null ? (
          <div aria-label={t.groups.progress} role="group">
            <EmptyState
              size="sm"
              title={t.empty.progressTitle}
              description={t.empty.progressDescription}
            />
          </div>
        ) : (
          <div aria-label={t.groups.progress} className="work-order-close-stats" role="group">
            {progressStats.map((stat) => (
              <StatCard
                key={stat.key}
                label={stat.label}
                value={displayQuantity(stat.value)}
                unit={unit}
              />
            ))}
            <StatCard
              label={t.fields.achievementRate}
              value={formatAchievementRate(detail.progress.achievementRate)}
              unit={t.units.percent}
            />
            <StatCard
              label={t.fields.judgment}
              value={JUDGMENT_LABELS[detail.progress.completionJudgmentCode]}
            />
          </div>
        )}
      </div>

      <div className="work-order-close-summary-section">
        <h3>{t.groups.preIssuedLots}</h3>
        {detail.preIssuedLots === null ? (
          <div aria-label={t.groups.preIssuedLots} role="group">
            <EmptyState
              size="sm"
              title={t.empty.preIssuedLotsTitle}
              description={t.empty.preIssuedLotsDescription}
            />
          </div>
        ) : (
          <div aria-label={t.groups.preIssuedLots} className="work-order-close-stats" role="group">
            {preIssuedLotStats.map((stat) => (
              <StatCard
                key={stat.key}
                label={stat.label}
                value={String(stat.value)}
                unit={t.units.count}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
