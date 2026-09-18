import { messages } from '@omf-mes/i18n';

import type { WorkOrder } from './types';
import { formatPlantDateTime } from '../../patterns/plant-time';

const t = messages.emergencyWorkOrderField.detail;

const QTY_FORMAT = new Intl.NumberFormat('ko-KR');

/**
 * 계약이 주는 시각 문자열에서 날짜와 시각(분까지)을 꺼낸다.
 *
 * **공장 시각으로 보인다**(`patterns/plant-time` · omf-all-around#20). 보는 사람(실행 환경)의
 * 시간대로 옮기지 않는다 — 서버가 UTC 로 보내므로 글자만 자르면 7시간 이르게 찍힌다.
 */
export const dateTimeText = (value: string | null | undefined): string => {
  /*
   * ⚠ **`null` 도 거른다**(#1147). 계약 타입은 `undefined` 만 적지만 서버는 `null` 로 답한다 —
   *    타입 검사가 못 잡는 자리라, 거르지 않으면 「발행 null」이 그대로 화면에 선다.
   */
  if (value === undefined || value === null || value === '') return t.unknown;

  return formatPlantDateTime(value) ?? value;
};

/** 수량. 안 온 값을 0으로 떨어뜨리지 않는다. */
export const qtyText = (value: number | null | undefined): string =>
  value === undefined || value === null ? t.unknown : QTY_FORMAT.format(value);

/** 품목 코드. 계약이 이름을 주지 않는 자리라 코드를 그대로 보인다. */
export const itemText = (workOrder: WorkOrder): string =>
  (workOrder.itemCode ?? '').trim() || t.unknown;

/**
 * 4M 배정이 하나도 없는가.
 *
 * ⚠ **긴급 W/O 는 배정 없이 발행된다** — 이것은 오류가 아니라 이 화면이 알려야 할 상태다.
 * 설비·금형·교대 셋이 **전부** 비었을 때만 「배정 없음」이다. 하나라도 배정돼 있으면 그
 * 사실이 더 정확하므로 경고를 세우지 않는다.
 */
export const hasNoAssignment = (workOrder: WorkOrder): boolean =>
  /* `null` 로 온 배정도 «없다»다 — 위 `dateTimeText` 와 같은 이유(#1147). */
  workOrder.plannedEquipmentId == null &&
  workOrder.plannedMoldId == null &&
  workOrder.plannedShiftId == null;
