import { messages } from '@omf-mes/i18n';

import type { RequestDetailView } from './types';

const t = messages.iqcSkipApproval;

/** 줄바꿈이 일어나지 않는 공백. 상자 첫머리에서도 축약되지 않아 **글자로 남는다.** */
export const NO_BREAK_SPACE = ' ';

/**
 * 사유 한 줄을 **보이는 그대로** 세운다 — 자료 층이 지킨 것을 표기 층이 도로 삼키지 않게 한다.
 *
 * | 무엇 | 그냥 두면 왜 사라지는가 |
 * | --- | --- |
 * | 줄 앞 들여쓰기 | 블록 상자 첫머리의 보통 공백은 HTML이 축약한다 |
 * | 가운데 빈 줄 | 빈 상자는 높이가 0이고 위·아래 마진이 이웃과 합쳐져 문단 구분이 남지 않는다 |
 *
 * 둘 다 「보이지 않게 되는」 자리라 **글자를 세워** 상자가 높이를 갖게 한다.
 *
 * **왜 `white-space`를 주지 않는가.** 이 슬라이스는 배치를 기존 클래스로만 하고 `app.css`를
 * 고치지 않는다 — 전역 스타일시트에 이 화면만 쓰는 규칙을 더하면 다른 화면이 그것을 물려받는
 * 자리가 생기고, 그 결정은 배치 규범을 바꾸는 일이라 이 회차의 범위가 아니다. 그래서
 * **구조로 푼다** — 이 슬라이스 밖에 영향이 없고, 스타일이 생기는 날 이 함수만 지우면 된다.
 *
 * **줄 가운데·끝 공백은 바꾸지 않는다.** 축약돼도 읽는 데 지장이 없고, 전부 바꾸면 사용자가
 * 복사해 간 사유에 보통 공백이 하나도 남지 않는다.
 */
export const toVisibleLine = (line: string): string => {
  if (line === '') return NO_BREAK_SPACE;

  const indentLength = line.length - line.trimStart().length;

  return indentLength === 0 ? line : NO_BREAK_SPACE.repeat(indentLength) + line.slice(indentLength);
};

export interface RequestDetailPaneProps {
  view: RequestDetailView;
}

/**
 * 고른 요청의 정보 구획 — **무엇에 대한 결재인지**를 말하는 자리.
 *
 * **폼이 아니라 값 표기다**(배치 규범 3). 이 화면에는 고쳐 넣을 값이 하나도 없다 —
 * 계약에 이 리소스의 수정 오퍼레이션이 없고, 결재는 되돌릴 수 없어 기록만 쌓인다.
 *
 * **사유가 마지막이고 대상 구획보다 위다.** 사유가 이 리소스의 **유일한 업무 값**이고
 * (수량·금액 컬럼이 물리 모델에 0건이다) 결재 판단의 근거가 거기에만 있다 — 대상 이름보다
 * 먼저 읽혀야 한다. 목록이 첫 줄만 낸 그 값의 **전문**이 여기서 처음 보인다.
 *
 * **오결재 방어 ②가 여기에도 선다** — 승인 유형 코드를 이 구획이 그대로 낸다. 유형 코드가
 * 확정되기 전이라 이 화면에는 다른 유형의 요청도 섞여 오고(`omf-mes#64`), 목록의 유형 열과
 * 이 칸이 함께 「지금 결재하려는 것이 무엇인가」를 말한다.
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
       * 들여쓰기와 빈 줄이 표기 층에서 사라지지 않게 하는 것은 `toVisibleLine`이 맡는다.
       *
       * React key에 차례를 쓴다. **여기서는 차례가 곧 그 줄의 정체다** — 사유는 통째로
       * 갈리는 한 덩어리라 줄이 재배열되거나 사이에 끼어들지 않는다.
       */}
      <div role="group" aria-label={t.panes.reason}>
        {view.reasonLines.map((line, index) => (
          <p key={`${String(index)}:${line}`}>{toVisibleLine(line)}</p>
        ))}
      </div>
    </div>
  </div>
);
