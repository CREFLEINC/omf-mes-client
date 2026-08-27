import { messages } from '@omf-mes/i18n';
import { Fragment } from 'react';

import type { RequestDetailView } from './types';

export interface DetailPaneProps {
  view: RequestDetailView;
}

export const DetailPane = ({ view }: DetailPaneProps) => {
  const t = messages.qualityApproval;

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

      {/*
       * ⚠ 대상 «이름»만 둔다. 부적합으로 나가는 길은 연결 조건 칸에 있다 — 그 이동은 특채일
       * 때만 성립하고(스펙 §5-1), 지목할 부적합 식별자는 특채가 들고 있기 때문이다. 여기 두면
       * 한도승인처럼 부적합이 없는 결재에도 갈 곳 없는 버튼이 선다.
       */}
      <div className="field-cell" role="group" aria-label={t.panes.target}>
        <span className="field-label">{t.fields.target}</span>
        <span>{view.targetName}</span>
      </div>
    </>
  );
};
