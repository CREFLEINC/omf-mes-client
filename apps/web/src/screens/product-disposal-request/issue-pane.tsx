import { messages } from '@omf-mes/i18n';

import { InfoTip } from '../../patterns/info-tip';

import type { DisposalDraft } from './request-draft';
import type { DisposalPartner } from './types';

const t = messages.productDisposalRequest;

export interface IssuePaneProps {
  draft: DisposalDraft;
  partners: readonly DisposalPartner[];
}

/**
 * ③ 승인 후 — 기타출고. **읽기 전용 표시만 둔다.**
 *
 * ⭐ **승인은 자물쇠를 풀 뿐이다**(J-8) — 승인이 끝나도 출고는 «여기서 다시» 눌러야 한다.
 *
 * ⛔ **여기서 도착지를 다시 묻지 않는다**(§5-6 · 통지 `#675` §2) — 요청 작성 때 이미 정해졌고,
 * 이 시점의 호출은 그 값을 받지 않는다. 물으면 **사용자가 고친 값이 조용히 버려진다.**
 */
export const IssuePane = ({ draft, partners }: IssuePaneProps) => {
  const destination = draft.isSelfDisposal
    ? t.issue.destinationSelf
    : (partners.find((one) => String(one.partnerId) === draft.partnerId)?.label ??
      t.issue.destinationUnset);

  return (
    <section className="pane" aria-label={t.panes.issue}>
      {/* 승인은 자물쇠를 풀 뿐이라는 사실(J-8)은 제목 옆 ⓘ 로 둔다(관리웹 정리 시안 A). */}
      <h2>
        <span className="info-label">
          {t.panes.issue}
          <InfoTip text={t.issue.unlockNote} />
        </span>
      </h2>

      <dl className="filter-bar">
        <div className="field-cell">
          <dt className="field-label">{t.issue.typeLabel}</dt>
          <dd>{t.issue.typeFixed}</dd>
        </div>
        <div className="field-cell">
          <dt className="field-label">{t.issue.destinationLabel}</dt>
          <dd>{destination}</dd>
        </div>
      </dl>
    </section>
  );
};
