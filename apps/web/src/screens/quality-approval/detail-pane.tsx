import { messages } from '@omf-mes/i18n';
import { Fragment } from 'react';

import { approvalTypeLabelOf } from './code-options';
import type { RequestDetailView } from './types';

export interface DetailPaneProps {
  view: RequestDetailView;
  /**
   * `concession` 이면 특채 승인 상세 카드의 「요청 정보」 묶음이다(#193) — 요청번호는 카드 머리에 서므로 빼고,
   * 승인 유형 · 상신자 · 상신 일시 · 대상 LOT 을 두 칸씩, 사유를 한 줄 전부로 둔다.
   */
  variant?: 'default' | 'concession';
}

export const DetailPane = ({ view, variant = 'default' }: DetailPaneProps) => {
  const t = messages.qualityApproval;

  if (variant === 'concession') {
    return (
      <section className="quality-approval-concession-section" aria-label={t.detail.requestInfo}>
        <h3>{t.detail.requestInfo}</h3>
        <dl className="quality-approval-concession-grid">
          {[
            [t.fields.approvalTypeCode, approvalTypeLabelOf(view.approvalTypeCode)],
            [t.fields.requestedByName, view.requesterName],
            [t.fields.requestedAt, view.requestedAtText],
            [t.fields.targetLot, view.targetName],
          ].map(([label, value]) => (
            <div className="field-cell" key={label}>
              <dt className="field-label">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="field-cell is-wide" role="group" aria-label={t.panes.reason}>
            <dt className="field-label">{t.fields.reason}</dt>
            <dd>
              {view.reasonLines.map((line) => (
                <Fragment key={`reason:${String(line.sourceOffset)}`}>
                  {line.sourceOffset === 0 ? null : <br />}
                  {line.text}
                </Fragment>
              ))}
            </dd>
          </div>
        </dl>
      </section>
    );
  }

  return (
    <div className="quality-approval-detail">
      <dl className="quality-approval-detail-facts">
        {[
          [t.fields.approvalRequestNo, view.approvalRequestNo],
          [t.fields.approvalTypeCode, approvalTypeLabelOf(view.approvalTypeCode)],
          [t.fields.requestedByName, view.requesterName],
          [t.fields.requestedAt, view.requestedAtText],
        ].map(([label, value]) => (
          <div className="field-cell" key={label}>
            <dt className="field-label">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div
        className="field-cell quality-approval-content-card quality-approval-reason"
        role="group"
        aria-label={t.panes.reason}
      >
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
      <div
        className="field-cell quality-approval-content-card"
        role="group"
        aria-label={t.panes.target}
      >
        <span className="field-label">{t.fields.targetLot}</span>
        <span>{view.targetName}</span>
      </div>
    </div>
  );
};
