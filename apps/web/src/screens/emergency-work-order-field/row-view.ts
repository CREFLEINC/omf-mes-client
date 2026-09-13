import { messages } from '@omf-mes/i18n';

import type { WorkOrder } from './types';

const t = messages.emergencyWorkOrderField.detail;

const QTY_FORMAT = new Intl.NumberFormat('ko-KR');

const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/i;

/**
 * 계약이 주는 시각 문자열에서 **글자 그대로** 날짜와 시각을 꺼낸다.
 *
 * ⛔ **`Date` 로 바꿔 다시 찍지 않는다.** 그러면 표시가 브라우저 시간대에 따라 흔들려,
 * 같은 W/O 가 단말마다 다른 발행 시각으로 보인다. 계약이 오프셋을 담아 보내므로 그 값을
 * 그대로 읽는 것이 옳다.
 */
export const dateTimeText = (value: string | null | undefined): string => {
  /*
   * ⚠ **`null` 도 거른다**(#1147). 계약 타입은 `undefined` 만 적지만 서버는 `null` 로 답한다 —
   *    타입 검사가 못 잡는 자리라, 거르지 않으면 「발행 null」이 그대로 화면에 선다.
   */
  if (value === undefined || value === null || value === '') return t.unknown;

  const match = DATE_TIME_PATTERN.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
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
