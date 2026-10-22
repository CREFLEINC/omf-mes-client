import { named } from '@omf-mes/i18n';

import type { WorkOrder } from './types';
import { formatPlantDateTime } from '../../patterns/plant-time';

const QTY_FORMAT = new Intl.NumberFormat('ko-KR');

/**
 * 계약이 주는 시각 문자열을 공장 시각으로 보인다(`patterns/plant-time` · omf-all-around#20).
 * 값이 없으면 `null`이다. 그 줄을 숨긴다(C-10).
 */
export const dateTimeText = (value: string | undefined): string | null => {
  if (value === undefined || value === '') return null;

  return formatPlantDateTime(value) ?? value;
};

/** 수량 숫자. 안 온 값을 0으로 떨어뜨리지 않는다(`null`). */
export const qtyNumber = (value: number | undefined): string | null =>
  value === undefined ? null : QTY_FORMAT.format(value);

/**
 * 수량과 단위. 단위를 못 받았으면 붙이지 않는다. 지어낸 단위는 거짓이다.
 */
export const qtyText = (value: number | undefined, uomCode?: string | null): string | null => {
  const formatted = qtyNumber(value);
  if (formatted === null) return null;

  return uomCode === undefined || uomCode === null ? formatted : `${formatted} ${uomCode}`;
};

/** 품목 코드. 계약이 품목명을 주지 않는다(C-15 계약 대기). 없으면 `null`. */
export const itemText = (workOrder: WorkOrder): string | null =>
  (workOrder.itemCode ?? '').trim() || null;

/** 계획 설비 「이름 (코드)」. 코드가 없으면 `null`(내부 번호를 보이지 않는다, C-13). */
export const plannedEquipmentText = (workOrder: WorkOrder): string | null => {
  const code = (workOrder.plannedEquipmentCode ?? '').trim();

  return code === '' ? null : named(workOrder.plannedEquipmentName, code);
};

/**
 * 계획 설비가 지금 설비와 다른가. 경고의 근거다(§6).
 *
 * 계획 설비가 비어 있거나 지금 설비를 모르면 경고하지 않는다. 긴급 W/O는 무배정으로 배포된다.
 */
export const isOtherEquipment = (workOrder: WorkOrder, equipmentId: number | null): boolean =>
  equipmentId !== null &&
  workOrder.plannedEquipmentId !== undefined &&
  workOrder.plannedEquipmentId !== equipmentId;
