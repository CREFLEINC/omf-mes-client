import { messages } from '@omf-mes/i18n';

import { formatDateTime, type InspectionRequestDetail } from '../oqc-inspection/types';

const t = messages.popOqcInspection.detail;
const empty = messages.oqcInspection.queue.emptyValue;

export interface PopRequestSummaryProps {
  detail: InspectionRequestDetail;
}

/**
 * 고른 의뢰 — **검사에 바로 쓰는 값(의뢰번호·검사수량)을 크게, 나머지는 참고 줄로** 나눈다.
 *
 * 보이는 값은 W-04-03 의 대상 정보와 같다. 대상 유형만 표시명으로 바꾸고(모르는 코드는 그대로),
 * 이름을 받지 못하는 식별자(품목·대상·기준)는 번호임을 `#` 으로 드러낸다.
 */
export const PopRequestSummary = ({ detail }: PopRequestSummaryProps) => {
  const typeLabel = t.targetTypes[detail.targetTypeCode] ?? detail.targetTypeCode;
  const reference = [
    { key: 'type', label: t.fields.inspectionType, value: detail.inspectionTypeCode },
    { key: 'target', label: t.fields.target, value: t.target(typeLabel, detail.targetId) },
    {
      key: 'lot',
      label: t.fields.lot,
      value: detail.lotId === null ? empty : t.idValue(detail.lotId),
    },
    {
      key: 'plan',
      label: t.fields.plan,
      value:
        detail.inspectionPlanVersionId === null
          ? t.noPlanVersion
          : t.planValue(detail.inspectionPlanVersionId),
    },
    { key: 'requestedAt', label: t.fields.requestedAt, value: formatDateTime(detail.requestedAt) },
  ];

  return (
    <section className="pop-oqc-summary" aria-label={detail.inspectionRequestNo}>
      <div className="pop-oqc-summary__key">
        <p className="pop-oqc-summary__no">{detail.inspectionRequestNo}</p>
        <dl className="pop-oqc-summary__figures">
          <div>
            <dt>{t.fields.item}</dt>
            <dd>{t.idValue(detail.itemId)}</dd>
          </div>
          <div>
            <dt>{t.fields.targetQty}</dt>
            <dd className="pop-oqc-num">{String(detail.targetQty)}</dd>
          </div>
        </dl>
      </div>

      <dl className="pop-oqc-summary__ref">
        {reference.map((item) => (
          <div key={item.key}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
