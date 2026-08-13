import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatDateTime, type IssueView } from './types';

const t = messages.disposalIssue;

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

export interface IssueDetailPaneProps {
  /** 고른 품의. **상세 응답의 헤더다** — 목록 행이 아니라 상세가 단계 판정의 근거다. */
  issue: IssueView;
  /**
   * 창고 이름. **참조 자체가 아니라 이름만 받는다** — 이 참조의 실패 안내와 복구는
   * 위 구획이 소유한다. 이 부품에 번호를 문자열로 만드는 자리는 없다(`omf-mes#44`).
   */
  warehouseName: string;
}

/**
 * ERP 적재 표기 — **세 갈래**다.
 *
 * **「전송됨」이라 적지 않는다.** 계약이 「적재이지 전송이 아니다」라고 못 박았다 — 대기열에
 * 들어간 것과 상대 시스템이 받은 것은 다른 사실이고, 뒤엣것은 이 화면이 알 수 없다.
 *
 * **값이 오지 않는 갈래를 따로 둔다.** 계약이 이 필드를 선택으로 두어 실제로 오지 않는 응답이
 * 있고, 그때 「적재되지 않음」으로 적으면 화면이 확인하지 않은 것을 말하는 것이 된다.
 */
const describeErp = (erpMessageQueued: boolean | null): string => {
  if (erpMessageQueued === null) return t.values.erpUnknown;

  return erpMessageQueued ? t.values.erpQueued : t.values.erpNotQueued;
};

/**
 * 고른 품의의 제목줄.
 *
 * **일곱 값만 낸다** — 출고번호·출고 유형·폐기 사유·출고 일시·상태·창고·ERP 적재. 계약의
 * 헤더에는 원천 문서·도착지도 있으나 이 화면의 판단에 쓰이지 않고 낼 것이 번호밖에 없다
 * (`omf-mes#44`).
 *
 * **상신 여부를 여기서 말하지 않는다.** 그것은 결재 진행 구획이 말한다 — 같은 사실을 두 구획이
 * 각자 말하면 한쪽만 고쳐질 때 화면이 자기 모순에 빠진다.
 *
 * **코드를 값으로 해석하지 않는다.** 유형·사유·상태의 값 집합이 확정되지 않아 화면이 뜻을
 * 붙이면 값이 정해질 때 조용히 틀린다 — 서버가 준 코드를 그대로 낸다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const IssueDetailPane = ({ issue, warehouseName }: IssueDetailPaneProps) => {
  const summary: SummaryItem[] = [
    { key: 'goodsIssueNo', label: t.issueSummary.goodsIssueNo, value: issue.goodsIssueNo },
    { key: 'issueType', label: t.issueSummary.issueType, value: issue.issueTypeCode },
    {
      key: 'reason',
      label: t.issueSummary.reason,
      /* 사유 코드는 계약이 선택으로 두어 **없이 오는 전표가 실재한다** — 그 사실을 적는다. */
      value: issue.reasonCode ?? t.values.noReasonCode,
    },
    { key: 'issuedAt', label: t.issueSummary.issuedAt, value: formatDateTime(issue.issuedAt) },
    { key: 'status', label: t.issueSummary.status, value: issue.statusCode },
    { key: 'warehouse', label: t.issueSummary.warehouse, value: warehouseName },
    { key: 'erp', label: t.issueSummary.erp, value: describeErp(issue.erpMessageQueued) },
  ];

  return (
    /*
     * 값 표기다 — 폼 컨트롤을 잠그지 않는다(배치 규범 3). `role="group"`을 명시해
     * 제목줄 전체가 하나의 이름을 갖게 한다.
     */
    <div role="group" aria-label={t.issueSummary.label}>
      <dl className="filter-bar">
        {summary.map((item) => (
          <div className="field-cell" key={item.key}>
            <dt className="field-label">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
