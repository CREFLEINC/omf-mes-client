import { messages } from '@omf-mes/i18n';

import { dateTimeText, itemText, plannedEquipmentText, qtyNumber, qtyText } from './row-view';
import type { WorkOrder } from './types';

import { PopQtyProgress, PopRowInfo, PopRowPair } from '../../patterns/pop-list-row';

const t = messages.workStart.list;
const labels = messages.workStart.selection;

export interface WorkOrderInfoProps {
  workOrder: WorkOrder;
  /** 단위 번호를 코드로 옮긴다. 못 옮기면 `null`. 수량만 낸다. */
  uomCodeOf: (uomId: number | undefined) => string | null;
  /**
   * 설비 줄의 값. 목록 카드는 계획 설비이고(기본), 「선택한 작업지시」는 이 시작이 쓸 설비를 넘긴다.
   * `null`이면 그 줄을 숨긴다(설비 미지정은 제목 줄 칩이 말한다).
   */
  equipmentText?: string | null;
}

/**
 * W/O 정보 영역(C-21). 「라벨 값」 쌍을 같은 열에 맞춘다. 두 열로 두어 카드 높이를 줄인다(사용자 결정
 * 2026-10-26, PG-31): 「품목 | 공정」 한 줄, 설비, 계획 시작, 실적은 각각 한 줄. 목록 카드와 「선택한
 * 작업지시」가 같은 배치, 같은 순서, 같은 말을 쓴다.
 *
 * 수량은 「실적 0 / 200 EA」(실적 / 지시) 한 쌍과 진행 막대다(C-21 「진행 / 기준」). 실적을 못
 * 받았으면 지시만 「지시 200 EA」로 보이고 막대를 두지 않는다(못 받은 값을 0으로 지어내지 않는다).
 * 품목은 계약이 품목명을 주지 않아 코드만 보인다(C-15 계약 대기, PG-28).
 */
export const WorkOrderInfo = ({
  workOrder,
  uomCodeOf,
  equipmentText = plannedEquipmentText(workOrder),
}: WorkOrderInfoProps) => {
  const uom = uomCodeOf(workOrder.uomId);
  const good = workOrder.progress?.goodQty;
  const order = workOrder.orderQty;
  const goodText = qtyNumber(good);
  const orderText = qtyNumber(order);

  return (
    <PopRowInfo columns={2}>
      <PopRowPair label={labels.item}>{itemText(workOrder)}</PopRowPair>
      <PopRowPair label={labels.process}>{(workOrder.processName ?? '').trim()}</PopRowPair>
      {/* 「설비 이름 (코드)」는 반 칸에 다 들어가지 않는다(1024×768 실측, PG-31). 한 줄을 다 쓴다. */}
      <PopRowPair label={t.equipment} wide>
        {equipmentText}
      </PopRowPair>
      <PopRowPair label={labels.plannedStart} wide>
        {dateTimeText(workOrder.plannedStartAt)}
      </PopRowPair>
      {good !== undefined && goodText !== null && orderText !== null ? (
        <PopRowPair label={t.goodLabel} wide>
          <PopQtyProgress
            current={good}
            target={order}
            text={t.progress(goodText, orderText, uom)}
            label={t.goodLabel}
          />
        </PopRowPair>
      ) : (
        <PopRowPair label={t.orderLabel} wide>
          {qtyText(order, uom)}
        </PopRowPair>
      )}
    </PopRowInfo>
  );
};
