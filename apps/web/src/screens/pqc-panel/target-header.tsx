import { messages } from '@omf-mes/i18n';

import type { InspectionRequestDetail } from '../pqc-inspection/types';
import { useItem, useLotDetail } from '../production-result/flow-queries';
import { useWorkOrder } from '../production-result/queries';

const t = messages.pqcInspection.detail;
const empty = messages.pqcInspection.emptyValue;

export interface PanelTargetHeaderProps {
  detail: InspectionRequestDetail;
}

/**
 * 분할 패널의 머리줄 — W/O 번호 · 품목 코드 · LOT 번호(omf-all-around#107 담당자 확인 B-1).
 *
 * ⭐ 의뢰 응답은 셋을 내부 id 로만 준다 — 그대로 그리면 현장에서 아무것도 가리키지 않는다.
 * 실적 화면이 이미 쓰는 조회(W/O·품목·LOT 상세)로 번호를 채우고, 오기 전·실패면 「—」다.
 * ⛔ 단독 화면 P-02-13 의 머리줄(`pqc-inspection/target-header`)은 건드리지 않는다(사용자 결정).
 */
export const PanelTargetHeader = ({ detail }: PanelTargetHeaderProps) => {
  const workOrder = useWorkOrder(detail.workOrderId);
  const item = useItem(detail.itemId);
  const lot = useLotDetail(detail.lotId);

  const items = [
    { key: 'workOrder', label: t.fields.workOrderId, value: workOrder.data?.workOrderNo },
    {
      key: 'item',
      label: t.fields.itemId,
      value: item.data?.itemCode ?? workOrder.data?.itemCode,
    },
    { key: 'lot', label: t.fields.lotId, value: lot.data?.lot.lotNo },
  ];

  return (
    <p className="pop-context" aria-label={t.heading}>
      {items.map((entry) => `${entry.label} ${entry.value ?? empty}`).join(' · ')}
    </p>
  );
};
