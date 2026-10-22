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

/** POP 작업자 → 관리웹 계정 순서. 둘 다 없으면(이 기능 전 마감) 지어내지 않는다. */
const closedByLabel = (detail: WorkOrderCloseDetailFact): string => {
  if (detail.closedWorkerName !== null && detail.closedWorkerNo !== null) {
    return t.values.popWorker(detail.closedWorkerName, detail.closedWorkerNo);
  }

  return detail.closedByUserName ?? t.values.unknown;
};

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
  /* 마감 시점 판정 — 지금 판정은 마감 뒤 지연 실적으로 바뀔 수 있다. */
  const judgment = detail.closeJudgmentCode;
  const fields: [label: string, value: string][] = [
    [t.fields.closedAt, formatPlantDateTime(detail.closedAt) ?? t.values.unknown],
    [t.fields.closedBy, closedByLabel(detail)],
    [
      t.fields.judgment,
      judgment === null
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
