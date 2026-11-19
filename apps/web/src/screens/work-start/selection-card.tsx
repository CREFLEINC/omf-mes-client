import { messages } from '@omf-mes/i18n';

import { dateTimeText, isOtherEquipment, itemText, plannedEquipmentText, qtyText } from './row-view';
import type { WorkOrder } from './types';
import { WorkOrderProgress } from './work-order-info';
import { WorkOrderChips } from './work-order-list';

import { PuChip, PuEmpty, PuKv, PuNote } from '../../patterns/pop-uniform';

const t = messages.workStart.selection;
const list = messages.workStart.list;

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
  /** 지시 수량을 채운 W/O 의 마감 안내(막지 않는 주의 한 줄, omf-all-around#45). */
  closeNotice?: string | null;
  /** 마감 안내 줄의 id — 주 동작 설명으로 이어 읽힌다. */
  closeNoticeId?: string;
}

/**
 * 오른쪽 「작업 확인」 구획의 「선택한 작업지시」 묶음(POP 통일 시안 P-02-01).
 *
 * 고르기 전에는 빈 모양(아이콘 + 한 줄 + 할 일). 고르면 제목 줄(W/O 번호, 칩)과 「라벨 값」.
 * 설비 줄 옆 칩은 «이 시작이 쓰는 설비가 어디서 왔는가»다 — 단말 설비가 있으면 그 설비로 시작하고
 * (`이 단말 설비`), 단말에 설비가 없을 때만 W/O 의 지정 설비로 시작한다(`작업지시 지정 설비`).
 * 계획 설비가 다른 지시는 막지 않고 정보 안내로 알린다(§6). 실적이 다 찬 지시의 마감 안내는
 * 이 묶음 안 주의 한 줄이다.
 */
export const SelectionCard = ({
  workOrder,
  equipmentId,
  equipmentText,
  isEquipmentUnassigned = false,
  uomCodeOf,
  closeNotice = null,
  closeNoticeId,
}: SelectionCardProps) => {
  if (workOrder === null) {
    return (
      <div className="ws-group" role="group" aria-label={t.title}>
        <h3 className="ws-group-title">{t.title}</h3>
        <PuEmpty icon="list" title={t.emptyTitle} hint={t.emptyHint} />
      </div>
    );
  }

  const planned = plannedEquipmentText(workOrder);
  const uom = uomCodeOf(workOrder.uomId);
  const start = dateTimeText(workOrder.plannedStartAt);
  const hasProgress = workOrder.progress?.goodQty !== undefined;
  const shownEquipment = isEquipmentUnassigned ? null : equipmentText;
  const items = [
    { label: t.item, value: itemText(workOrder) },
    { label: t.process, value: (workOrder.processName ?? '').trim() },
    ...(shownEquipment === null
      ? []
      : [
          {
            label: t.equipment,
            value: (
              <>
                {shownEquipment}{' '}
                {equipmentId === null ? (
                  <PuChip tone="info">{t.assignedEquipment}</PuChip>
                ) : (
                  <PuChip>{t.terminalEquipment}</PuChip>
                )}
              </>
            ),
          },
        ]),
    ...(start === null ? [] : [{ label: t.plannedStart, value: start }]),
    hasProgress
      ? { label: list.goodLabel, value: <WorkOrderProgress workOrder={workOrder} uom={uom} /> }
      : { label: list.orderLabel, value: qtyText(workOrder.orderQty, uom) },
  ];

  return (
    <div className="ws-group" role="group" aria-label={t.title}>
      <h3 className="ws-group-title">{t.title}</h3>
      <div className="ws-sel-top">
        <span className="no">{workOrder.workOrderNo}</span>
        {/* 목록에서 본 긴급 표식과 설비 미지정을 고른 뒤에도 남긴다(§5-3, #1147). */}
        <WorkOrderChips workOrder={workOrder} isEquipmentUnassigned={isEquipmentUnassigned} />
      </div>
      <PuKv items={items} />

      {isOtherEquipment(workOrder, equipmentId) && planned !== null && (
        <PuNote>{t.otherEquipment(planned)}</PuNote>
      )}
      {closeNotice !== null && (
        <PuNote tone="warn" id={closeNoticeId}>
          {closeNotice}
        </PuNote>
      )}
    </div>
  );
};
