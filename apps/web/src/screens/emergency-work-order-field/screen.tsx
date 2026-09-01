import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { DetailPane } from './detail-pane';
import { PopHeader } from './pop-header';
import { useEmergencyWorkOrders } from './queries';
import type { WorkOrder } from './types';
import { useUomLookup } from './uom-lookup';
import { WorkOrderList } from './work-order-list';
import { EMERGENCY_WORK_ORDER_TYPE_CODE, isEmergencyTypeCodeKnown } from './work-order-type';

export interface EmergencyWorkOrderFieldScreenProps {
  /** 이 단말의 번호. 셸이 채운다 — 아직 채우는 곳이 없어 기본은 「모른다」다. */
  terminalNo?: string;
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
  terminalNo,
}: EmergencyWorkOrderFieldScreenProps) => {
  const t = messages.emergencyWorkOrderField;
  const [selectedId, setSelectedId] = useState<number | null>(null);

  /*
   * ⛔ **「묻지 않았다」를 「없다」로 흘려보내지 않는다.** 조회를 여는 조건을 화면이 알아야
   *    목록 구획이 빈 값을 무엇으로 말할지 가를 수 있다 — `isPending` 은 «꺼 둔» 조회에
   *    대해 거짓이라 그것만으로는 두 상태가 구별되지 않는다.
   */
  const isAsked = isEmergencyTypeCodeKnown(typeCode);
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
      <PopHeader terminalNo={terminalNo} />

      {/*
       * ⭐ 스펙이 **좌 목록 / 우 상세** 2단으로 못박은 배치다. 세로로 쌓으면 1024×768 단말에서
       *    상세와 이탈 버튼이 접혀 내려가, 고른 뒤 «스크롤해서» 버튼을 찾게 된다.
       *
       * ⛔ 관리웹의 `.two-pane` 을 쓰지 않는다 — 접힘 기준점이 1280px 이라 **1024 단말에서는
       *    언제나 접힌다.** POP 기준점(900px)과 그 근거는 `app.css` 의 `.pop-two-pane` 에 적었다
       *    (배치 규범 5 이탈 조건).
       */}
      <div className="pop-two-pane">
        <WorkOrderList
          workOrders={workOrders}
          isAsked={isAsked}
          isLoading={isAsked && list.isPending}
          total={list.data?.page.total}
          isError={list.isError}
          selectedId={selected?.workOrderId ?? null}
          uomLabel={(uomId) => uoms.labelOf(uomId)}
          onSelect={(workOrder: WorkOrder) => {
            setSelectedId(workOrder.workOrderId);
          }}
        />

        <DetailPane workOrder={selected} uomLabel={(uomId) => uoms.labelOf(uomId)} />
      </div>
    </>
  );
};
