import { messages } from '@omf-mes/i18n';

import type { DecisionSubject } from './types';

const t = messages.iqcSkipApproval;

export interface DecisionSubjectSummaryProps {
  subject: DecisionSubject;
}

/**
 * 확인 창 안의 **대상 요약** — 되돌릴 수 없는 확인 직전에 「무엇을 결재하는가」를 다시 세는 자리.
 *
 * **이 화면 고유의 방어다**(계획 §13-2 셋째 방어). 승인 유형 코드가 미확정인 동안 이 화면은
 * 내가 승인자인 요청을 전부 보이고(`omf-mes#64`), 목록 위 안내가 「유형과 사유로 긴급 IQC
 * 생략 건인지 확인하라」고 말한다. 그 확인 수단이 **확인 창에도 서야** 목록에서 한 줄 잘못
 * 누른 것이 걸러진다.
 *
 * **두 창이 이 부품 하나를 나눠 쓴다.** 창마다 따로 그리면 승인 창에만 값이 빠져도 반려 창의
 * 시험이 통과해 방어가 반쪽만 남은 것을 아무도 모른다 — 두 창을 가른 것은 **의견의 지위**가
 * 다르기 때문이지 무엇을 결재하는지가 달라서가 아니다.
 *
 * **라벨과 값을 정의 목록으로 짝짓는다.** 유형 코드와 대상 표시명은 둘 다 낯선 문자열이라,
 * 나열만 하면 어느 것이 무엇인지 보는 사람이 짐작해야 한다.
 *
 * 기존 디자인 시스템 요소의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const DecisionSubjectSummary = ({ subject }: DecisionSubjectSummaryProps) => (
  <dl role="group" aria-label={t.panes.decisionSubject}>
    <div className="field-cell">
      <dt className="field-label">{t.fields.approvalRequestNo}</dt>
      <dd>{subject.approvalRequestNo}</dd>
    </div>
    <div className="field-cell">
      <dt className="field-label">{t.fields.approvalTypeCode}</dt>
      {/* 코드 문자열 그대로다 — 값 목록이 확정되기 전에 화면이 이름을 지어내지 않는다. */}
      <dd>{subject.approvalTypeCode}</dd>
    </div>
    <div className="field-cell">
      <dt className="field-label">{t.fields.target}</dt>
      <dd>{subject.targetName}</dd>
    </div>
    <div className="field-cell">
      <dt className="field-label">{t.fields.requestedByName}</dt>
      <dd>{subject.requesterName}</dd>
    </div>
    <div className="field-cell">
      <dt className="field-label">{t.fields.reason}</dt>
      {/* 첫 줄이다 — 전문은 아래 구획이 이미 보였고, 여기서는 갈래를 가리는 단서로만 쓴다. */}
      <dd>{subject.reasonFirstLine}</dd>
    </div>
  </dl>
);
