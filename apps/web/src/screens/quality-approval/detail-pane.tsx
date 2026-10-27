import { Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router';

import { approvalTypeLabelOf } from './code-options';
import type { RequestDetailView } from './types';

export interface DetailPaneProps {
  view: RequestDetailView;
  /**
   * `concession` 이면 특채 승인 상세 카드의 「요청 정보」 묶음이다(#193) — 요청번호는 카드 머리에 서므로 빼고,
   * 승인 유형 · 상신자 · 상신 일시 · 대상 LOT 을 두 칸씩, 사유를 한 줄 전부로 둔다.
   */
  variant?: 'default' | 'concession';
  /**
   * 대상 LOT 을 LOT 상태 화면에서 여는 단추 — 특채 요청 정보는 소제목 옆, 요청 상세(이름 | 값 줄)는 값 옆에 선다(#193). 권한이 없으면 넘기지 않는다.
   * `name` 을 주면 대상 칸에 그 이름을 쓴다 — 특채는 결재 대상(부적합)이 아니라 특채의 LOT 을 보여야 단추와 맞는다.
   */
  targetLot?: { to: string; label: string; name?: string };
  /**
   * 특채의 연관 부적합 — 사유 옆 칸에 번호를, 소제목 옆에 「부적합 열기」 단추를 둔다(#193 · 사용자 지시 2026-10-27).
   * 특채는 늘 부적합을 근거로 만든다(서버 DB 필수). 처분 판정 처리 권한이 없으면 `link` 를 넘기지 않는다.
   */
  nonconformance?: { name: string; link?: { to: string; label: string } };
}

type OpenLink = { to: string; label: string };

const openLink = (link: OpenLink): ReactNode => (
  <Link className="quality-approval-concession-nc-link is-inline" to={link.to}>
    {link.label}
    <Icon name="open_in_new" size={14} />
  </Link>
);

/**
 * 작은 제목 + 옆 「열기」 단추(#193 · 사용자 지시 2026-10-27 — 단추는 소제목 옆, 작게). 단추가 없으면 제목만 둔다.
 * 특채 사용 조건의 허용 작업지시도 같은 모양을 쓴다.
 */
export const linkedLabel = (label: string, link: OpenLink | undefined): ReactNode =>
  link === undefined ? (
    label
  ) : (
    <span className="quality-approval-label-link">
      {label}
      {openLink(link)}
    </span>
  );

/** 값 + 옆 단추 — 이름 | 값 한 줄 배치(요청 상세)에서 쓴다. 이름 칸이 좁아 단추를 값 옆에 둔다. */
const linkedValue = (name: string, link: { to: string; label: string } | undefined): ReactNode =>
  link === undefined ? (
    name
  ) : (
    <span className="quality-approval-target-value">
      <span>{name}</span>
      {openLink(link)}
    </span>
  );

export const DetailPane = ({
  view,
  variant = 'default',
  targetLot,
  nonconformance,
}: DetailPaneProps) => {
  const t = messages.qualityApproval;

  if (variant === 'concession') {
    const concessionRows: ReadonlyArray<readonly [string, string, OpenLink?]> = [
      [t.fields.approvalTypeCode, approvalTypeLabelOf(view.approvalTypeCode)],
      [t.fields.requestedByName, view.requesterName],
      [t.fields.requestedAt, view.requestedAtText],
      [t.fields.targetLot, targetLot?.name ?? view.targetName, targetLot],
    ];

    return (
      <section
        className="quality-approval-concession-section is-request"
        aria-label={t.detail.requestInfo}
      >
        <h3>{t.detail.requestInfo}</h3>
        <dl className="quality-approval-concession-grid">
          {concessionRows.map(([label, value, link]) => (
            <div className="field-cell" key={label}>
              <dt className="field-label">{linkedLabel(label, link)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div
            className={`field-cell${nonconformance === undefined ? ' is-wide' : ''}`}
            role="group"
            aria-label={t.panes.reason}
          >
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
          {nonconformance !== undefined && (
            <div className="field-cell">
              <dt className="field-label">
                {linkedLabel(t.condition.nonconformanceHeading, nonconformance.link)}
              </dt>
              <dd>{nonconformance.name}</dd>
            </div>
          )}
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
        <span>{linkedValue(targetLot?.name ?? view.targetName, targetLot)}</span>
      </div>
    </div>
  );
};
