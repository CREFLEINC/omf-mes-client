import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { describeErp } from './issue-detail-pane';

const t = messages.disposalIssue;

/** 전기된 전표. **전기 응답은 헤더만 준다**(계약 실측) — 라인이 없으므로 담을 자리도 없다. */
export interface PostedIssueSummary {
  goodsIssueNo: string;
  /** 서버가 준 상태 코드 **그대로**. 화면이 「전기 완료」로 바꿔 적지 않는다(공유계약 G-2) */
  statusCode: string;
  /** ERP 송신 **대기열 적재** 여부. 계약이 선택으로 두어 **오지 않는 갈래가 따로 있다** */
  erpMessageQueued: boolean | null;
}

export interface PostResultPaneProps {
  issue: PostedIssueSummary;
}

/**
 * 처리 결과 구획 — **화면이 확인한 것만 말한다**(계획 결정 15).
 *
 * | 말한다 | 말하지 않는다 |
 * | --- | --- |
 * | 「`GI-…`를 기타출고로 처리했습니다」 — **서버가 200으로 받아들였다**는 사실 | 「전기 완료」·「초안」 — **상태 코드로 판정하지 않는다**(목이 전기 뒤에도 초안 상태를 그대로 준다 · 실측) |
 * | 서버가 준 **상태 코드 그대로** | 화면이 센 **줄 수** — 전기 응답에 라인이 없다 |
 * | 「대기열에 적재됨」 | **「ERP로 전송됨」** — 계약이 「적재이지 전송이 아니다」라고 못 박았다 |
 *
 * **상신 결과 구획과 갈라 둔다.** 매인 대상이 다르고(이쪽은 고른 품의, 저쪽은 고른 입고 전표)
 * 담는 값도 다르다 — 하나로 묶으면 갈래가 여섯이 되고, 그때 한 갈래의 문구를 고치다 다른
 * 갈래가 말없이 달라진다.
 *
 * **ERP 표기를 제목줄과 같은 함수로 읽는다**(`issue-detail-pane.tsx`의 `describeErp`) — 세
 * 갈래를 두 자리에서 각자 적으면 한쪽만 고쳐질 때 같은 값이 두 낱말로 보인다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const PostResultPane = ({ issue }: PostResultPaneProps) => (
  <section className="pane" aria-label={t.result.postLabel}>
    <AlertBanner variant="success" title={t.result.postedTitle(issue.goodsIssueNo)}>
      {t.result.postedDescription}
    </AlertBanner>

    <dl className="filter-bar">
      <div className="field-cell">
        <dt className="field-label">{t.result.statusCode}</dt>
        <dd>{issue.statusCode}</dd>
      </div>
      <div className="field-cell">
        <dt className="field-label">{t.issueSummary.erp}</dt>
        <dd>{describeErp(issue.erpMessageQueued)}</dd>
      </div>
    </dl>

    <p className="field-note">{t.result.postedNoLines}</p>
  </section>
);
