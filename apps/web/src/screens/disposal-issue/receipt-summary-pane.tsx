import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatDateTime, type ReceiptView } from './types';

const t = messages.disposalIssue;

interface SummaryItem {
  key: string;
  label: string;
  value: ReactNode;
}

export interface ReceiptSummaryPaneProps {
  /** 고른 입고 전표. **상세 응답의 헤더다** — 목록 행이 아니라 상세가 단계 판정의 근거다. */
  receipt: ReceiptView;
  /**
   * 창고 이름. **참조 자체가 아니라 이름만 받는다** — 이 참조의 실패 안내와 복구는
   * 위 구획이 소유한다. 이 부품에 번호를 문자열로 만드는 자리는 없다(`omf-mes#44`).
   */
  warehouseName: string;
}

/**
 * 고른 입고 전표의 제목줄.
 *
 * **다섯 값만 낸다** — 입고번호·창고·입고 일시·입고 유형·상태. 계약의 헤더에는 공장·원천
 * 문서·사유·비고도 있으나 폐기할 것을 고르는 판단에 쓰이지 않고, 원천 문서는 낼 것이
 * 번호밖에 없다(`omf-mes#44`).
 *
 * **코드를 값으로 해석하지 않는다.** 입고 유형·상태의 값 집합이 확정되지 않아 화면이 뜻을
 * 붙이면 값이 정해질 때 조용히 틀린다 — 서버가 준 코드를 그대로 낸다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const ReceiptSummaryPane = ({ receipt, warehouseName }: ReceiptSummaryPaneProps) => {
  const summary: SummaryItem[] = [
    { key: 'goodsReceiptNo', label: t.summary.goodsReceiptNo, value: receipt.goodsReceiptNo },
    { key: 'warehouse', label: t.summary.warehouse, value: warehouseName },
    {
      key: 'receiptDatetime',
      label: t.summary.receiptDatetime,
      value: formatDateTime(receipt.receiptDatetime),
    },
    { key: 'receiptType', label: t.summary.receiptType, value: receipt.receiptTypeCode },
    { key: 'status', label: t.summary.status, value: receipt.statusCode },
  ];

  return (
    /*
     * 값 표기다 — 폼 컨트롤을 잠그지 않는다(배치 규범 3). `role="group"`을 명시해
     * 제목줄 전체가 하나의 이름을 갖게 한다.
     */
    <div role="group" aria-label={t.summary.label}>
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
