import { messages } from '@omf-mes/i18n';

import type { WorkOrder } from './types';

const t = messages.workStart.selection;

const QTY_FORMAT = new Intl.NumberFormat('ko-KR');

const DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/i;

/**
 * 계약이 주는 시각 문자열에서 **글자 그대로** 날짜와 시각을 꺼낸다.
 *
 * ⛔ **`Date` 로 바꿔 다시 찍지 않는다.** 그러면 표시가 브라우저 시간대에 따라 흔들려, 같은
 * W/O 가 단말마다 다른 계획 시각으로 보인다. 계약이 오프셋을 담아 보내므로 그대로 읽는다.
 */
export const dateTimeText = (value: string | undefined): string => {
  if (value === undefined || value === '') return t.unknown;

  const match = DATE_TIME_PATTERN.exec(value);

  return match === null ? value : `${match[1]} ${match[2]}`;
};

/** 수량. 안 온 값을 0으로 떨어뜨리지 않는다. */
export const qtyText = (value: number | undefined): string =>
  value === undefined ? t.unknown : QTY_FORMAT.format(value);

/** 품목. 계약이 이름을 주지 않는 자리라 코드를 그대로 보인다. */
export const itemText = (workOrder: WorkOrder): string =>
  (workOrder.itemCode ?? '').trim() || t.unknown;

/** 식별자 하나를 사람이 읽는 글자로. 이름이 없는 자리라 번호를 그대로 보인다. */
export const idText = (value: number | undefined): string =>
  value === undefined ? t.none : `#${String(value)}`;

/**
 * 계획 설비가 지금 설비와 다른가 — **경고의 근거다**(§6).
 *
 * ⛔ **계획 설비가 비어 있으면 경고하지 않는다.** 긴급 W/O 는 무배정으로 배포되고, 채울 값이
 * 없는 자리에 「다르다」고 말하면 모든 긴급 지시에 경고가 뜬다.
 *
 * ⛔ **지금 설비를 모르면 경고하지 않는다.** 견줄 기준이 없는 채로 「다르다」고 말하지 않는다.
 */
export const isOtherEquipment = (workOrder: WorkOrder, equipmentId: number | null): boolean =>
  equipmentId !== null &&
  workOrder.plannedEquipmentId !== undefined &&
  workOrder.plannedEquipmentId !== equipmentId;
