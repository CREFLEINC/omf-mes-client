import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { PlanViewLauncher } from '../iqc-inspection/plan-view-launcher';
import type { PlanVersionView } from '../pqc-inspection/queries';
import type { InspectionRequestDetail } from '../pqc-inspection/types';
import { useItem, useLotDetail } from '../production-result/flow-queries';
import { useTargetLots, useWorkOrder } from '../production-result/queries';

const t = messages.pqcInspectionRegister.web.summary;
const empty = messages.pqcInspection.emptyValue;
/** 폐번된 LOT 의 수명 상태 — 서버 W/O 취소·마감이 남긴다. */
const VOIDED_LIFECYCLE = 'VOIDED';

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
  /*
   * PQC 의뢰는 작업지시 단위라 의뢰의 LOT 칸이 비어 있다 — 대상 LOT 은 그 작업지시의 생산 LOT(배포 때 선발행)이다.
   * 폐번된 LOT 은 대상이 아니다. 여럿이면 첫 번호 「외 N건」, 전체 번호는 title 로 본다(#135).
   */
  const workOrderLots = useTargetLots(detail.lotId === null ? detail.workOrderId : null);
  const lotNos = (workOrderLots.data ?? [])
    .filter((row) => row.lifecycleStatusCode !== VOIDED_LIFECYCLE)
    .map((row) => row.lotNo);
  const [firstLotNo, ...restLotNos] = lotNos;
  const lotValue: ReactNode =
    detail.lotId !== null ? (
      (lot.data?.lot.lotNo ?? empty)
    ) : firstLotNo === undefined ? (
      empty
    ) : (
      <span title={lotNos.join('\n')}>
        {restLotNos.length === 0 ? firstLotNo : t.lotMore(firstLotNo, restLotNos.length)}
      </span>
    );

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
      /* IQC 와 같이 「버전 N」 + [기준 조회](사용자 지시 2026-10-28 · #197). */
      value:
        detail.inspectionPlanVersionId === null ? (
          t.noPlan
        ) : (
          <span className="iqc-inspection-plan-cell">
            <span>
              {planVersion === null
                ? empty
                : messages.iqcInspection.detail.planVersion(planVersion.planVersion)}
            </span>
            <PlanViewLauncher
              inspectionPlanVersionId={detail.inspectionPlanVersionId}
              label={messages.iqcInspection.detail.openPlan}
            />
          </span>
        ),
    },
    { key: 'lot', label: t.lot, value: lotValue },
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
