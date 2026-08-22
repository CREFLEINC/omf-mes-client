import { AlertBanner, Button, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { toApiError } from '../../patterns/request';
import {
  toConcessionCardinality,
  toConcessionCardView,
  UNKNOWN_CONDITION_REFERENCES,
} from './conditions';
import { useConcessionCandidates, useConcessionDetail } from './queries';

export interface ConditionPaneProps {
  approvalRequestId: number | null;
}

export const ConditionPane = ({ approvalRequestId }: ConditionPaneProps) => {
  const t = messages.qualityApproval.condition;
  const candidates = useConcessionCandidates(approvalRequestId);
  const cardinality =
    approvalRequestId === null || candidates.data === undefined
      ? null
      : toConcessionCardinality(approvalRequestId, candidates.data);
  const concessionId = cardinality?.kind === 'one' ? cardinality.concessionId : null;
  const detail = useConcessionDetail(concessionId);

  if (approvalRequestId === null) return null;
  if (candidates.isPending) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={2} />
      </div>
    );
  }

  const error = candidates.error ?? detail.error;
  if (error !== null) {
    const description =
      toApiError(error).kind === 'network'
        ? messages.httpError.offline
        : messages.httpError.description;
    const retry = candidates.error === null ? detail.refetch : candidates.refetch;
    return (
      <AlertBanner
        variant="error"
        title={messages.httpError.loadTitle}
        action={
          <Button variant="outlined" size="sm" onClick={() => void retry()}>
            {messages.common.retry}
          </Button>
        }
      >
        {description}
      </AlertBanner>
    );
  }

  if (cardinality?.kind === 'none') return <EmptyState size="sm" live title={t.none} />;
  if (cardinality?.kind === 'unsafe') {
    return <AlertBanner variant="error">{t.unsafe}</AlertBanner>;
  }
  if (detail.isPending) {
    return (
      <div role="status" aria-label={t.loading}>
        <SkeletonText lines={2} />
      </div>
    );
  }
  if (detail.data === undefined) return null;

  const view = toConcessionCardView(detail.data, UNKNOWN_CONDITION_REFERENCES);

  return (
    <div role="group" aria-label={t.title}>
      <span className="field-label">{t.title}</span>
      <dl className="filter-bar">
        {[
          [t.concessionNo, view.concessionNo],
          [t.approvedQty, view.approvedQty],
          [t.consumedQty, view.consumedQty],
          [t.uom, view.uom],
          [t.validity, view.validity],
          [messages.qualityApproval.fields.statusCode, view.statusCode],
          [t.usableLabel, view.usable],
          [t.remarks, view.remarks],
          [t.workOrder, view.workOrder],
          [t.process, view.process],
          [t.customer, view.customer],
        ].map(([label, value]) => (
          <div className="field-cell" key={label}>
            <dt className="field-label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
