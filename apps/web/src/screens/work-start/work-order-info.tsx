import { messages } from '@omf-mes/i18n';

import { listDateTimeText } from '../../patterns/pop-list-order';
import { itemText, plannedEquipmentText, qtyNumber, qtyText } from './row-view';
import type { WorkOrder } from './types';

const t = messages.workStart.list;
const labels = messages.workStart.selection;

/**
 * 실적 「120 / 500 EA」와 진행 막대(C-21 「진행 / 기준」). 지시를 넘기면 막대가 노랑이다.
 * 실적을 못 받았으면 `null` — 부르는 쪽이 지시 수량만 보인다(못 받은 값을 0으로 지어내지 않는다).
 */
export const WorkOrderProgress = ({
  workOrder,
  uom,
}: {
  workOrder: WorkOrder;
  uom: string | null;
}) => {
  const good = workOrder.progress?.goodQty;
  const order = workOrder.orderQty;
  const goodText = qtyNumber(good);
  const orderText = qtyNumber(order);
  if (good === undefined || goodText === null || orderText === null) return null;

  const text = t.progress(goodText, orderText, uom);
  const ratio = order > 0 ? Math.min(1, good / order) : 1;

  return (
    <span className="ws-prog">
      <b>{text}</b>
      <span
        className={good > order ? 'pu-progress ws-over' : 'pu-progress'}
        role="progressbar"
        aria-label={t.goodLabel}
        aria-valuemin={0}
        aria-valuemax={order > 0 ? order : 1}
        aria-valuenow={Math.min(good, order > 0 ? order : 1)}
        aria-valuetext={text}
      >
        <i style={{ width: `${String(Math.round(ratio * 100))}%` }} />
      </span>
    </span>
  );
};

export interface WorkOrderInfoProps {
  workOrder: WorkOrder;
  /**
   * 이 단말의 설비. 계획 설비가 이것과 같으면 설비 줄을 두지 않는다 — 기본 목록은 이 설비 것이라 늘 같은 말이
   * 되풀이된다(카드를 두 줄로 줄여 한 쪽에 더 담는다 · 사용자 지시 2026-11-19). 모르면 `null` 이고 늘 보인다.
   */
  terminalEquipmentId?: number | null;
  /** 단위 번호를 코드로 옮긴다. 못 옮기면 `null`. 수량만 낸다. */
  uomCodeOf: (uomId: number | undefined) => string | null;
}

/**
 * 목록 카드의 정보는 두 줄(사용자 지시 2026-11-19): 「품목 · 공정 · 설비(이 단말과 다를 때만)」, 「계획 시작 · 실적」.
 * 설비는 계획 설비 「이름 (코드)」 — 정해지지 않은 W/O 는 줄을 두지 않고 「설비 미지정」 칩이 말한다.
 * 품목은 계약이 품목명을 주지 않아 코드만 보인다(C-15 계약 대기, PG-28).
 */
export const WorkOrderInfo = ({
  workOrder,
  uomCodeOf,
  terminalEquipmentId = null,
}: WorkOrderInfoProps) => {
  const uom = uomCodeOf(workOrder.uomId);
  const isSameEquipment =
    terminalEquipmentId !== null && workOrder.plannedEquipmentId === terminalEquipmentId;
  const equipment = isSameEquipment ? null : plannedEquipmentText(workOrder);
  const start = listDateTimeText(workOrder.plannedStartAt);
  const progress = <WorkOrderProgress workOrder={workOrder} uom={uom} />;
  const hasProgress = workOrder.progress?.goodQty !== undefined;

  return (
    <span className="pu-item-sub ws-item-sub">
      <span className="ws-line">
        <span>{labels.item}</span> <b>{itemText(workOrder)}</b>
        <span>{labels.process}</span> <b>{(workOrder.processName ?? '').trim()}</b>
        {equipment !== null && (
          <>
            <span>{t.equipment}</span> <b title={equipment}>{equipment}</b>
          </>
        )}
      </span>
      <span className="ws-line">
        {start !== null && (
          <>
            <span>{labels.plannedStart}</span> <b>{start}</b>
          </>
        )}
        {hasProgress ? (
          <>
            <span>{t.goodLabel}</span> {progress}
          </>
        ) : (
          <>
            <span>{t.orderLabel}</span> <b>{qtyText(workOrder.orderQty, uom)}</b>
          </>
        )}
      </span>
    </span>
  );
};
