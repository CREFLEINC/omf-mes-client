import { messages } from '@omf-mes/i18n';

import { formatDateTime, type InspectionRequestDetail } from './types';

/**
 * 고른 의뢰의 상세 — **스펙 §4-A 의 여섯 항목이다.**
 *
 * ⚠ **검사기준 버전을 감추지 않는다.** 검사 시점의 기준 버전이 그 검사에 고정되고, 이후
 * 기준이 바뀌어도 이 검사는 당시 버전으로 남는다. 버전이 보이지 않으면 검사자는 자기가 어느
 * 기준으로 재고 있는지 모르고, 나중에 결과를 읽는 사람도 알 수 없다. 숫자만 두지 않고 **왜
 * 중요한지도 한 줄로 밝힌다.**
 *
 * ⚠ **품목·자재 LOT 을 번호로 그린다.** 계약이 식별자만 주고 이름을 주지 않는다. 참조 조회를
 * 얹지 않는 이유는 `queries.ts` 머리에 적었다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.pqcInspection.detail;
const empty = messages.pqcInspection.queue.emptyValue;

export interface RequestDetailPaneProps {
  detail: InspectionRequestDetail;
}

export const RequestDetailPane = ({ detail }: RequestDetailPaneProps) => {
  const items = [
    { key: 'no', label: t.fields.inspectionRequestNo, value: detail.inspectionRequestNo },
    /*
     * ⛔ **검사 유형을 내지 않는다.** 이 화면은 고정 축이 PQC 하나라 늘 같은 값이고,
     * 늘 같은 값을 칸으로 두면 좁은 단말 화면에서 읽을 것만 늘어난다.
     */
    { key: 'item', label: t.fields.itemId, value: String(detail.itemId) },
    {
      key: 'workOrder',
      label: t.fields.workOrderId,
      value: detail.workOrderId === null ? empty : String(detail.workOrderId),
    },
    {
      key: 'lot',
      label: t.fields.lotId,
      value: detail.lotId === null ? empty : String(detail.lotId),
    },
    { key: 'qty', label: t.fields.targetQty, value: String(detail.targetQty) },
    {
      key: 'plan',
      label: t.fields.inspectionPlanVersionId,
      value: String(detail.inspectionPlanVersionId),
    },
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

      {/* 버전 숫자만 보이면 왜 중요한지 알 수 없다. 고정된다는 사실을 화면이 말한다. */}
      <p className="field-note">{t.planVersionNote}</p>

      {/*
       * ⚠ **샘플 수의 단위가 확정되지 않았다**(스펙 §8 #5 · 공유계약 A-8) — 「샘플 30」이
       * 30개인지 30%인지 상류가 정하지 않았다. ⛔ 어느 한쪽으로 읽어 계산하지 않고
       * **단위가 미확정이라는 사실을 화면에 밝힌다.** 감추면 검사자가 자기 방식대로 읽는다.
       */}
      <p className="field-note">{t.sampleUnitPending}</p>

      <p className="field-note">{formatDateTime(detail.requestedAt)}</p>
    </section>
  );
};
