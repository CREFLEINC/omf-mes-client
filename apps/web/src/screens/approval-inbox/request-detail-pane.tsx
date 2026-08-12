import { messages } from '@omf-mes/i18n';

import type { RequestDetailView } from './types';

const t = messages.approvalInbox;

export interface RequestDetailPaneProps {
  view: RequestDetailView;
}

/**
 * 고른 요청의 정보 구획 — **무엇에 대한 결재인지**를 말하는 자리.
 *
 * **폼이 아니라 값 표기다**(배치 규범 3). 결재함에는 고쳐 넣을 값이 하나도 없다 —
 * 계약에 이 리소스의 수정 오퍼레이션이 없고, 결재는 되돌릴 수 없어 기록만 쌓인다.
 *
 * **사유가 마지막이고 대상 구획보다 위다.** 사유가 이 리소스의 **유일한 업무 값**이고
 * (수량·금액 컬럼이 물리 모델에 0건이다) 결재 판단의 근거가 거기에만 있다 — 대상 이름보다
 * 먼저 읽혀야 한다. 목록이 첫 줄만 낸 그 값의 **전문**이 여기서 처음 보인다.
 *
 * **내부 번호를 그리지 않는다.** 그럴 수도 없다 — `RequestDetailView`가 번호를 아예 나르지
 * 않아 이 파일에는 꺼낼 값 자체가 없다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const RequestDetailPane = ({ view }: RequestDetailPaneProps) => (
  <div role="group" aria-label={t.panes.request}>
    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.fields.approvalRequestNo}</dt>
        <dd>{view.approvalRequestNo}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.fields.approvalTypeCode}</dt>
        {/* 코드 문자열 그대로다 — 값 목록이 확정되기 전에 화면이 이름을 지어내지 않는다. */}
        <dd>{view.approvalTypeCode}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.fields.requestedByName}</dt>
        <dd>{view.requesterName}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.fields.requestedAt}</dt>
        <dd>{view.requestedAtText}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.fields.status}</dt>
        <dd>{view.statusCode}</dd>
      </div>
    </dl>

    <div className="field-cell">
      <span className="field-label">{t.fields.reason}</span>
      {/*
       * **줄마다 한 칸이다.** 줄바꿈을 살리는 스타일을 새로 만들지 않고 구조로 낸다 —
       * 배치는 기존 클래스만 쓰고 `app.css`를 고치지 않는다는 규율이 이 슬라이스에 걸려 있다.
       *
       * React key에 차례를 쓴다. **여기서는 차례가 곧 그 줄의 정체다** — 사유는 통째로
       * 갈리는 한 덩어리라 줄이 재배열되거나 사이에 끼어들지 않는다.
       */}
      <div role="group" aria-label={t.panes.reason}>
        {view.reasonLines.map((line, index) => (
          <p key={`${String(index)}:${line}`}>{line}</p>
        ))}
      </div>
    </div>
  </div>
);
