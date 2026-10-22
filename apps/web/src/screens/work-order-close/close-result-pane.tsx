import { AlertBanner, Button, SkeletonText } from '@crefle/web-ui';
import type { WorkOrderForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import type { JSX } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import type { WorkOrderCloseDetailFact } from './queries';

const t = messages.workOrderClose.closeResult;

export type WorkOrderCloseResultState =
  | { kind: 'CHECKING' }
  | { kind: 'UNAVAILABLE'; onRetry: () => void }
  | { kind: 'RESOLVED'; detail: WorkOrderCloseDetailFact; reasonLabel: (code: string) => string };

/** 관리웹 마감은 마감자 칸이 없다 — 지어내지 않고 모른다고 둔다. */
const closedByLabel = (detail: WorkOrderCloseDetailFact): string =>
  detail.closedWorkerName === null || detail.closedWorkerNo === null
    ? t.values.unknown
    : t.values.popWorker(detail.closedWorkerName, detail.closedWorkerNo);

const dispositionLabel = (code: WorkOrderForward['closeDispositionCode'] | null): string =>
  code === null || code === undefined
    ? t.values.none
    : messages.workOrderClose.input.remainder[code];

export const WorkOrderCloseResultPane = ({
  state,
}: {
  state: WorkOrderCloseResultState;
}): JSX.Element => {
  if (state.kind === 'CHECKING') {
    return (
      <section aria-label={t.pane} className="pane work-order-close-summary-pane">
        <h2 className="pane-title">{t.pane}</h2>
        <div aria-label={t.loading} role="status">
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }

  if (state.kind === 'UNAVAILABLE') {
    return (
      <section aria-label={t.pane} className="pane work-order-close-summary-pane">
        <h2 className="pane-title">{t.pane}</h2>
        <AlertBanner
          variant="error"
          action={<Button onClick={state.onRetry}>{messages.common.retry}</Button>}
        >
          {t.loadFailed}
        </AlertBanner>
      </section>
    );
  }

  const { detail } = state;
  const judgment = detail.progress?.completionJudgmentCode;
  const fields: [label: string, value: string][] = [
    [t.fields.closedAt, formatPlantDateTime(detail.closedAt) ?? t.values.unknown],
    [t.fields.closedBy, closedByLabel(detail)],
    [
      t.fields.judgment,
      judgment === undefined
        ? t.values.unknown
        : messages.workOrderClose.detailSummary.judgments[judgment],
    ],
    [t.fields.disposition, dispositionLabel(detail.closeDispositionCode)],
    [
      t.fields.reason,
      detail.completionVarianceReasonCode === null
        ? t.values.none
        : state.reasonLabel(detail.completionVarianceReasonCode),
    ],
    [
      t.fields.voidedLots,
      detail.voidedLotCount === null
        ? t.values.unknown
        : `${String(detail.voidedLotCount)}${messages.workOrderClose.detailSummary.units.count}`,
    ],
  ];

  return (
    <section aria-label={t.pane} className="pane work-order-close-summary-pane">
      <h2 className="pane-title">{t.pane}</h2>
      <dl className="work-order-close-confirm-details">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
