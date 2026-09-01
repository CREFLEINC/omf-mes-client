import { PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { DetailPane } from './detail-pane';
import { useEmergencyWorkOrders } from './queries';
import type { WorkOrder } from './types';
import { useUomLookup } from './uom-lookup';
import { WorkOrderList } from './work-order-list';
import { EMERGENCY_WORK_ORDER_TYPE_CODE } from './work-order-type';

export interface EmergencyWorkOrderFieldScreenProps {
  /**
   * 긴급을 뜻하는 유형 코드. 화면은 기본값으로 상수를 쓴다.
   *
   * ⚠ **값이 정해진 뒤에도 밖에서 받는 자리를 남겨 둔다** — 빈 값이 흘러들었을 때 조회가
   * 열리지 않는지를 감지기가 확인할 수 있어야 한다. 상수만 읽으면 그 닫힌 쪽을 확인할 길이 없다.
   */
  typeCode?: string;
}

/**
 * `P-02-12` 긴급 W/O 현장 투입·실적.
 *
 * ⭐ **진입점이다.** 긴급 W/O 목록을 보이고 정상 경로 화면(자재 투입 `P-02-03` · 실적 등록
 * `P-02-04`)으로 보낸다 — 긴급이라고 투입·실적 화면을 따로 두지 않는 것이 설계 확정이다.
 *
 * ⛔ **이 화면에는 저장 액션이 없다.** 발행은 관리웹(`W-02-07`)이고 투입·실적은 넘어간
 * 화면의 일이다.
 */
export const EmergencyWorkOrderFieldScreen = ({
  typeCode = EMERGENCY_WORK_ORDER_TYPE_CODE,
}: EmergencyWorkOrderFieldScreenProps) => {
  const t = messages.emergencyWorkOrderField;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const list = useEmergencyWorkOrders(typeCode);
  const uoms = useUomLookup(t.detail.unknown);

  const workOrders = list.data?.items;
  /*
   * 고른 것을 «지금 목록에서» 다시 찾는다 — 줄을 복사해 들고 있으면 새로고침 뒤 사라진
   * W/O 의 상세가 화면에 남아, 없는 지시로 현장 화면에 들어가게 된다.
   */
  const selected =
    (workOrders ?? []).find((workOrder) => workOrder.workOrderId === selectedId) ?? null;

  return (
    <>
      <PageHeader title={t.title} />

      <WorkOrderList
        workOrders={workOrders}
        total={list.data?.page.total}
        isError={list.isError}
        selectedId={selected?.workOrderId ?? null}
        uomLabel={(uomId) => uoms.labelOf(uomId)}
        onSelect={(workOrder: WorkOrder) => {
          setSelectedId(workOrder.workOrderId);
        }}
      />

      <DetailPane workOrder={selected} uomLabel={(uomId) => uoms.labelOf(uomId)} />
    </>
  );
};
