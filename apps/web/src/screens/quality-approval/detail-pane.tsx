import { Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Fragment, useId } from 'react';

import type { RequestDetailView } from './types';

export interface DetailPaneProps {
  view: RequestDetailView;
}

export const DetailPane = ({ view }: DetailPaneProps) => {
  const t = messages.qualityApproval;
  const targetReasonId = useId();

  return (
    <>
      <dl className="filter-bar">
        {[
          [t.fields.approvalRequestNo, view.approvalRequestNo],
          [t.fields.approvalTypeCode, view.approvalTypeCode],
          [t.fields.requestedByName, view.requesterName],
          [t.fields.requestedAt, view.requestedAtText],
          [t.fields.statusCode, view.statusCode],
        ].map(([label, value]) => (
          <div className="field-cell" key={label}>
            <dt className="field-label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="field-cell" role="group" aria-label={t.panes.reason}>
        <span className="field-label">{t.fields.reason}</span>
        <p>
          {view.reasonLines.map((line) => (
            <Fragment key={`reason:${String(line.sourceOffset)}`}>
              {line.sourceOffset === 0 ? null : <br />}
              {line.text}
            </Fragment>
          ))}
        </p>
      </div>

      <div className="field-cell" role="group" aria-label={t.panes.target}>
        <span className="field-label">{t.fields.target}</span>
        <span>{view.targetName}</span>
        <Button variant="outlined" disabled aria-describedby={targetReasonId}>
          {t.actions.openTarget}
        </Button>
        <span id={targetReasonId} className="field-note">
          {t.detail.targetUnavailable}
        </span>
      </div>
    </>
  );
};
