import { AlertBanner, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import {
  dateTimeText,
  isOtherEquipment,
  itemText,
  plannedEquipmentText,
  qtyNumber,
  qtyText,
} from './row-view';
import type { WorkOrder } from './types';
import { STATUS_CHIP } from './work-order-list';
import { statusKeyOf } from './work-order-status';
import { isEmergency } from './work-order-type';

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
}

/** 「라벨 값」 한 쌍. 값이 없으면 그 줄을 숨긴다(C-10). */
const Pair = ({ label, children }: { label: string; children: ReactNode }) =>
  children === null || children === '' ? null : (
    <div className="work-start-pair">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );

/**
 * 오른쪽 구획의 「선택한 작업지시」 묶음. 고른 결과를 목록 아래에 쌓지 않고 오른쪽에 보인다(C-2).
 *
 * 구획 상자 안에 상자를 넣지 않는다(C-19). 값은 「라벨 값」 쌍이고 가운뎃점으로 잇지 않는다(C-10).
 * 금형은 계약이 내부 번호만 주므로 보이지 않는다(C-13, C-15 계약 대기).
 * 계획 설비가 다른 지시는 막지 않는다(§6). 막힌 상태가 아니라 정보 색 안내 상자로 알린다(C-7).
 */
export const SelectionCard = ({
  workOrder,
  equipmentId,
  equipmentText,
  isEquipmentUnassigned = false,
  uomCodeOf,
}: SelectionCardProps) => {
  if (workOrder === null) {
    return (
      <div className="work-start-group" role="group" aria-label={t.title}>
        <h3 className="work-start-group-title">{t.title}</h3>
        <p className="field-note">{t.notSelected}</p>
      </div>
    );
  }

  const statusKey = statusKeyOf(workOrder);
  const order = qtyText(workOrder.orderQty, uomCodeOf(workOrder.uomId));
  const good = qtyNumber(workOrder.progress?.goodQty);
  const planned = plannedEquipmentText(workOrder);

  return (
    <div className="work-start-group" role="group" aria-label={t.title}>
      <h3 className="work-start-group-title">{t.title}</h3>
      <dl className="work-start-pairs">
        <Pair label={t.workOrderNo}>
          <span className="work-start-wo-no">{workOrder.workOrderNo}</span>
          {/* 목록에서 본 긴급 표식을 고른 뒤에도 남긴다(§5-3 · #1147). */}
          {isEmergency(workOrder) && (
            <>
              {' '}
              <Chip status="error" size="md">
                {list.emergencyBadge}
              </Chip>
            </>
          )}
        </Pair>
        <Pair label={t.status}>
          {statusKey === null ? null : (
            <Chip status={STATUS_CHIP[statusKey]} size="md">
              {list.status[statusKey]}
            </Chip>
          )}
        </Pair>
        <Pair label={t.item}>{itemText(workOrder)}</Pair>
        <Pair label={t.process}>{(workOrder.processName ?? '').trim()}</Pair>
        <Pair label={t.qty}>
          {order === null ? null : good === null ? order : list.qty(good, order)}
        </Pair>
        <Pair label={t.plannedStart}>{dateTimeText(workOrder.plannedStartAt)}</Pair>
        <Pair label={t.equipment}>
          {isEquipmentUnassigned ? list.unassignedEquipmentBadge : equipmentText}
        </Pair>
      </dl>

      {isOtherEquipment(workOrder, equipmentId) && planned !== null && (
        <div className="banner-slot">
          <AlertBanner variant="info">{t.otherEquipment(planned)}</AlertBanner>
        </div>
      )}
    </div>
  );
};
