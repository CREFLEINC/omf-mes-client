import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { isOtherEquipment, plannedEquipmentText } from './row-view';
import type { WorkOrder } from './types';
import { WorkOrderInfo } from './work-order-info';
import { WorkOrderChips } from './work-order-list';

import { PopRowHead } from '../../patterns/pop-list-row';

const t = messages.workStart.selection;

export interface SelectionCardProps {
  workOrder: WorkOrder | null;
  /** 이 단말이 붙어 있는 설비. 계획 설비와 견주는 기준이다. */
  equipmentId: number | null;
  /** 이 시작이 쓸 설비 「이름 (코드)」. 모르면 `null`이고 그 줄을 숨긴다. */
  equipmentText: string | null;
  /** 이 시작이 쓸 설비가 없다. 「설비 미지정」으로 보인다. */
  isEquipmentUnassigned?: boolean;
  /** 단위 번호를 코드로 옮긴다. 못 옮기면 `null`. 수량만 낸다. */
  uomCodeOf: (uomId: number | undefined) => string | null;
}

/**
 * 오른쪽 구획의 「선택한 작업지시」 묶음. 고른 결과를 목록 아래에 쌓지 않고 오른쪽에 보인다(C-2).
 *
 * 구획 상자 안에 상자를 넣지 않는다(C-19). 목록 카드와 같은 틀이다: 제목 줄(W/O 번호, 오른쪽 끝
 * 칩)과 정보 영역(「라벨 값」 쌍)을 간격으로 나눈다(C-21). 금형은 계약이 내부 번호만 주므로 보이지
 * 않는다(C-13, C-15 계약 대기). 계획 설비가 다른 지시는 막지 않는다(§6). 막힌 상태가 아니라 정보 색
 * 안내 상자로 알린다(C-7).
 */
export const SelectionCard = ({
  workOrder,
  equipmentId,
  equipmentText,
  isEquipmentUnassigned = false,
  uomCodeOf,
}: SelectionCardProps) => {
  /* 고른 것이 없으면 묶음을 세우지 않는다. 할 일은 하단 바가 한 곳에서 말한다(C-4). */
  if (workOrder === null) return null;

  const planned = plannedEquipmentText(workOrder);

  return (
    <div className="work-start-group" role="group" aria-label={t.title}>
      <h3 className="work-start-group-title">{t.title}</h3>
      <div className="work-start-selection">
        <PopRowHead
          title={<span className="work-start-wo-no">{workOrder.workOrderNo}</span>}
          /* 목록에서 본 긴급 표식과 설비 미지정을 고른 뒤에도 남긴다(§5-3, #1147). */
          chips={
            <WorkOrderChips workOrder={workOrder} isEquipmentUnassigned={isEquipmentUnassigned} />
          }
        />
        <WorkOrderInfo
          workOrder={workOrder}
          uomCodeOf={uomCodeOf}
          equipmentText={isEquipmentUnassigned ? null : equipmentText}
        />
      </div>

      {isOtherEquipment(workOrder, equipmentId) && planned !== null && (
        <div className="banner-slot">
          <AlertBanner variant="info">{t.otherEquipment(planned)}</AlertBanner>
        </div>
      )}
    </div>
  );
};
