import { messages } from '@omf-mes/i18n';

import type { InspectionRequestDetail } from './types';

/**
 * 헤더 — 화면 스펙 §3 의 위쪽 64 다. **§4-A 의 필드 표를 그대로 그린다.**
 *
 * ⛔ **칸을 임의로 빼지 않는다.** 「유형은 늘 PQC 라 불필요」처럼 보이는 판단으로 뺐다가
 * 되돌린 자리다 — 무엇을 그릴지는 설계가 정하고 화면은 그대로 따른다.
 *
 * ⚠ 검사기준 버전과 샘플 수는 §3 도면이 **좌측 구획 머리**에 두었으므로 여기가 아니라
 * 그쪽에 있다(`item-panel.tsx`).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.pqcInspection.detail;
const empty = messages.pqcInspection.emptyValue;

export interface TargetHeaderProps {
  detail: InspectionRequestDetail;
}

export const TargetHeader = ({ detail }: TargetHeaderProps) => {
  const items = [
    { key: 'no', label: t.fields.inspectionRequestNo, value: detail.inspectionRequestNo },
    { key: 'type', label: t.fields.inspectionTypeCode, value: detail.inspectionTypeCode },
    /* 대상은 다형 참조라 **유형과 식별자를 함께** 보인다 — 어느 쪽 하나로는 무엇인지 모른다. */
    {
      key: 'target',
      label: t.fields.target,
      value: `${detail.targetTypeCode} ${detail.targetId}`,
    },
    { key: 'item', label: t.fields.itemId, value: String(detail.itemId) },
    {
      key: 'lot',
      label: t.fields.lotId,
      value: detail.lotId === null ? empty : String(detail.lotId),
    },
    {
      key: 'workOrder',
      label: t.fields.workOrderId,
      value: detail.workOrderId === null ? empty : String(detail.workOrderId),
    },
    {
      key: 'productionResult',
      label: t.fields.productionResultId,
      value: detail.productionResultId === null ? empty : String(detail.productionResultId),
    },
    { key: 'qty', label: t.fields.targetQty, value: String(detail.targetQty) },
  ];

  return (
    <section aria-label={t.heading}>
      <dl className="filter-bar">
        {items.map((item) => (
          <div className="field-cell" key={item.key}>
            <dt className="field-label">{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
