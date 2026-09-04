import { messages } from '@omf-mes/i18n';

import type { DecisionSubject } from './types';

const t = messages.iqcSkipApproval;

export interface DecisionSubjectSummaryProps {
  subject: DecisionSubject;
}

/**
 * 확인 창 안의 **대상 요약** — 되돌릴 수 없는 확인 직전에 「무엇을 결재하는가」를 다시 세는 자리.
 *
 * **이 화면 고유의 방어다**(계획 §13-2 셋째 방어). 목록은 `IQC_SKIP`으로 좁혀 받지만,
 * 되돌릴 수 없는 확인 직전에도 유형과 대상을 다시 보여 서버 응답 어긋남과 오선택을 막는다.
 *
 * **두 창이 이 부품 하나를 나눠 쓴다.** 창마다 따로 그리면 승인 창에만 값이 빠져도 반려 창의
 * 시험이 통과해 방어가 반쪽만 남은 것을 아무도 모른다 — 두 창을 가른 것은 **의견의 지위**가
 * 다르기 때문이지 무엇을 결재하는지가 달라서가 아니다.
 *
 * **라벨과 값을 정의 목록으로 짝짓는다.** 유형 코드와 대상 표시명은 둘 다 낯선 문자열이라,
 * 나열만 하면 어느 것이 무엇인지 보는 사람이 짐작해야 한다.
 *
 * **구획 이름은 목록 바깥에 둔다.** `role`을 `<dl>`에 직접 걸면 그 목록 의미가 덮여 안의
 * `<dt>`·`<dd>`가 **소유자를 잃는다.** 이 슬라이스의 다른 값 구획(`request-detail-pane.tsx`)이
 * 이미 이 형태이며, 한 슬라이스 안에서 같은 것을 두 형태로 쓰면 다음 사람이 어느 쪽을
 * 베낄지 알 수 없다.
 *
 * 기존 디자인 시스템 요소의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const DecisionSubjectSummary = ({ subject }: DecisionSubjectSummaryProps) => (
  <div role="group" aria-label={t.panes.decisionSubject}>
    {/*
     * 배치 클래스를 붙이지 않는다 — 감싸는 상자를 더하는 것이 **보이는 것을 바꾸지 않아야**
     * 브라우저 확인을 다시 받지 않는다. `div`도 `dl`도 블록이라 나열은 그대로다.
     */}
    <dl>
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
  </div>
);
