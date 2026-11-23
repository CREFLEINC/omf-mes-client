import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';

import { approvalTypeLabelOf } from './code-options';
import type { RequestDetailView } from './types';

export interface DetailPaneProps {
  view: RequestDetailView;
  /**
   * 대상 LOT 을 LOT 상태 화면에서 여는 단추 — 값 바로 옆에 선다(#193). 권한이 없으면 넘기지 않는다.
   * `name` 을 주면 대상 칸에 그 이름을 쓴다.
   */
  targetLot?: { to: string; label: string; name?: string };
  /**
   * 대상이 LOT 이 아닐 때의 대상 칸(#193 · OQC 생략은 출하작업지시) — 이름과 값을 바꾸고, `extra` 줄(출하 예정일 등)을
   * 그 아래에 같은 모양으로 잇는다.
   */
  target?: { label: string; name: string; extra?: ReadonlyArray<readonly [string, string]> };
}

type OpenLink = { to: string; label: string };

/** 작은 보조 단추(테두리 알약 · 아이콘 + 「열기」) — 무엇을 여는지는 소제목이 말하고, 읽기 이름은 전체 이름이다(#193). */
const openLink = (link: OpenLink): ReactNode => (
  <Link className="quality-approval-open-link" to={link.to} aria-label={link.label}>
    <Icon name="open_in_new" size={14} />
    {messages.qualityApproval.condition.open}
  </Link>
);

/** 값 + 바로 옆 작은 보조 「열기」 단추(#193 · 사용자 지시 2026-10-27 — 데이터 옆). 단추가 없으면 값만 둔다. */
export const linkedValue = (name: ReactNode, link: OpenLink | undefined): ReactNode =>
  link === undefined ? (
    name
  ) : (
    <span className="quality-approval-target-value">
      <span>{name}</span>
      {openLink(link)}
    </span>
  );

export const DetailPane = ({ view, targetLot, target }: DetailPaneProps) => {
  const t = messages.qualityApproval;

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

      {/* ⚠ 대상 «이름»만 둔다 — 생략 결재에는 부적합이 없어 부적합으로 나가는 길을 두지 않는다. */}
      <div
        className="field-cell quality-approval-content-card"
        role="group"
        aria-label={t.panes.target}
      >
        <span className="field-label">{target?.label ?? t.fields.targetLot}</span>
        <span>{linkedValue(target?.name ?? targetLot?.name ?? view.targetName, targetLot)}</span>
      </div>
      {target?.extra?.map(([label, value]) => (
        <div className="field-cell quality-approval-content-card" key={label}>
          <span className="field-label">{label}</span>
          <span>{value}</span>
        </div>
      ))}
    </div>
  );
};
