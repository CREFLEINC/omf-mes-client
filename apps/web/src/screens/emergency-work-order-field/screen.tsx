import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';

import { DetailPane } from './detail-pane';
import { PopHeader } from './pop-header';
import { useEmergencyWorkOrders } from './queries';
import { reachedServer } from './reached-server';
import type { WorkOrder } from './types';
import { useUomLookup } from './uom-lookup';
import { WorkOrderList } from './work-order-list';
import { EMERGENCY_WORK_ORDER_TYPE_CODE, isEmergencyTypeCodeKnown } from './work-order-type';

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
  /*
   * 단말 번호는 **셸이 아는 값**이라 다른 POP 화면과 같은 자리(`patterns/pop-identity`)에서
   * 읽는다(#1147). 화면 속성으로 받던 때는 채우는 곳이 없어 이 화면만 「단말 —」로 떴다.
   */
  const { terminalId } = usePopIdentity();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  /* 셸이 없는 화면이라 표제가 본문의 이름이 된다 — 이름 없는 랜드마크로 남기지 않는다. */
  const titleId = useId();

  /*
   * ⛔ **「묻지 않았다」를 「없다」로 흘려보내지 않는다.** 조회를 여는 조건을 화면이 알아야
   *    목록 구획이 빈 값을 무엇으로 말할지 가를 수 있다 — `isPending` 은 «꺼 둔» 조회에
   *    대해 거짓이라 그것만으로는 두 상태가 구별되지 않는다.
   */
  const isAsked = isEmergencyTypeCodeKnown(typeCode);
  const [listPage, setListPage] = useState(1);
  const list = useEmergencyWorkOrders(typeCode, listPage);
  const uoms = useUomLookup(t.detail.unknown);

  const workOrders = list.data?.items;
  /*
   * 고른 것을 «지금 목록에서» 다시 찾는다 — 줄을 복사해 들고 있으면 새로고침 뒤 사라진
   * W/O 의 상세가 화면에 남아, 없는 지시로 현장 화면에 들어가게 된다.
   */
  const selected =
    (workOrders ?? []).find((workOrder) => workOrder.workOrderId === selectedId) ?? null;

  return (
    <main className="pop-shell pop-ui" aria-labelledby={titleId}>
      <PopHeader
        titleId={titleId}
        terminalNo={terminalId === null ? undefined : String(terminalId)}
        /*
         * ⭐ 연결 여부는 «마지막 조회가 서버에 닿았는가»로 말한다 — 브라우저의 온라인
         *    표시는 산업용 패널 PC 에서 사실과 다르다(같은 기기의 서버에는 랜선 없이도 닿는다).
         *    아직 답을 못 받았으면 `undefined` 로 두어 «모른다»를 말하지 않는다.
         *
         * ⛔ **실패했다는 사실만으로 「오프라인」이라 말하지 않는다**(#883) — 판정은
         *    `reached-server.ts` 가 갖는다. 서버가 401 로 답한 것을 여기서 「오프라인」으로
         *    부르면 작업자가 네트워크를 확인하러 간다.
         */
        isConnected={reachedServer(list)}
      />

      {/*
       * ⭐ 스펙이 **좌 목록 / 우 상세** 2단으로 못박은 배치다. 세로로 쌓으면 1024×768 단말에서
       *    상세와 이탈 버튼이 접혀 내려가, 고른 뒤 «스크롤해서» 버튼을 찾게 된다.
       *
       * ⛔ 관리웹의 `.two-pane` 을 쓰지 않는다 — 접힘 기준점이 1280px 이라 **1024 단말에서는
       *    언제나 접힌다.** POP 화면들이 함께 쓰는 `.pop-panes`(기준점 900px)를 그대로 쓴다.
       */}
      <div className="pop-panes">
        <WorkOrderList
          workOrders={workOrders}
          isAsked={isAsked}
          isLoading={isAsked && list.isPending}
          total={list.data?.page.total}
          pageMeta={list.data?.page}
          onPageChange={(page) => {
            /* 쪽을 넘기면 고른 것을 놓는다 — 다른 쪽의 지시가 상세에 남으면 화면이 어긋난다. */
            setSelectedId(null);
            setListPage(page);
          }}
          isError={list.isError}
          selectedId={selected?.workOrderId ?? null}
          uomLabel={(uomId) => uoms.labelOf(uomId)}
          /* 고른 줄을 다시 누르면 해제한다(`null`) — 정본 목록이 그렇게 동작한다. */
          onSelect={(workOrder: WorkOrder | null) => {
            setSelectedId(workOrder?.workOrderId ?? null);
          }}
        />

        <DetailPane workOrder={selected} uomLabel={(uomId) => uoms.labelOf(uomId)} />
      </div>
    </main>
  );
};
