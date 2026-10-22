import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import type { PlanVersionView } from '../pqc-inspection/queries';
import type { InspectionRequestDetail } from '../pqc-inspection/types';
import { useItem, useLotDetail } from '../production-result/flow-queries';
import { useWorkOrder } from '../production-result/queries';

const t = messages.pqcInspectionRegister.web.summary;
const empty = messages.pqcInspection.emptyValue;

export interface WebSummaryProps {
  detail: InspectionRequestDetail;
  planVersion: PlanVersionView | null;
  uomCode: string | null;
}

interface Fact {
  key: string;
  label: string;
  value: ReactNode;
  emphasized?: boolean;
}

/**
 * W-03-11 관리웹 「검사 기본 정보」(omf-all-around#135) — IQC 판정 화면(#133)의 기본 정보와 같은 짜임이다.
 * 첫 줄은 검사 대상(의뢰번호 · 작업지시 · 품목 · 총 검사 수량)을 굵게, 둘째 줄은 부가 정보.
 * ⛔ 내부 번호를 내지 않는다 — 품목은 이름·코드, 기준은 기준 코드·판으로.
 */
export const WebSummary = ({ detail, planVersion, uomCode }: WebSummaryProps) => {
  const workOrder = useWorkOrder(detail.workOrderId);
  const item = useItem(detail.itemId);
  const lot = useLotDetail(detail.lotId);

  const itemName = item.data?.itemName;
  const itemCode = item.data?.itemCode ?? workOrder.data?.itemCode;
  const targetQty =
    uomCode === null ? String(detail.targetQty) : `${String(detail.targetQty)} ${uomCode}`;

  const facts: Fact[] = [
    {
      key: 'no',
      label: t.inspectionRequestNo,
      value: detail.inspectionRequestNo,
      emphasized: true,
    },
    {
      key: 'workOrder',
      label: t.workOrder,
      value: workOrder.data?.workOrderNo ?? empty,
      emphasized: true,
    },
    {
      key: 'item',
      label: t.item,
      value:
        itemName === undefined ? (
          (itemCode ?? empty)
        ) : (
          <span className="pqc-web-fact-item">
            <span className="pqc-web-fact-item-name">{itemName}</span>
            {itemCode !== undefined && <span className="pqc-web-fact-item-code">{itemCode}</span>}
          </span>
        ),
      emphasized: true,
    },
    { key: 'qty', label: t.targetQty, value: targetQty, emphasized: true },
    { key: 'type', label: t.inspectionType, value: t.inspectionTypeName },
    {
      key: 'plan',
      label: t.plan,
      value:
        detail.inspectionPlanVersionId === null
          ? t.noPlan
          : planVersion === null
            ? empty
            : t.planLabel(planVersion.planCode, planVersion.planVersion),
    },
    { key: 'lot', label: t.lot, value: lot.data?.lot.lotNo ?? empty },
    {
      key: 'at',
      label: t.requestedAt,
      value: formatPlantDateTime(detail.requestedAt) ?? detail.requestedAt,
    },
  ];

  return (
    <section className="pqc-web-section pqc-web-summary" aria-label={t.heading}>
      {/* 제목 글은 두지 않는다 — 쪽 머리 경로가 「검사 기본 정보」를 이미 말한다(#133 과 같다). */}
      <dl className="pqc-web-facts">
        {facts.map((fact) => (
          <div className="pqc-web-fact" key={fact.key}>
            <dt className="field-label">{fact.label}</dt>
            <dd className={fact.emphasized === true ? 'pqc-web-fact-key' : undefined}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
};
