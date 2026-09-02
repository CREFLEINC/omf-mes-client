import type { components } from '@omf-mes/api-client';

import type { Lot } from '../../patterns/lots';

export type WorkOrder = components['schemas']['WorkOrder'];
export type OperationHandoverCreate = components['schemas']['OperationHandoverCreate'];

/** 생산LOT 만 공정을 넘어간다. 값 목록이 계약에 적혀 있다. */
export const PRODUCTION = 'PRODUCTION';

export type LotProblem = 'notProduction' | 'notCompleted' | 'held';

/**
 * 이 LOT 을 넘길 수 있는가.
 *
 * 완료를 시각으로 판정한다 - 상태 코드 문자열을 몰라도 갈린다. 완료되지 않은 LOT 은 다음
 * 공정이 받을 것이 아직 없다.
 *
 * 홀드품 이동은 재고 이동에서 허용되지만 공정 인계에서는 막는다. 다음 공정이 홀드품을
 * 투입하면 불량이 확산된다. 재고 이동과 공정 인계가 다르다는 판단이라 근거를 화면이 적는다.
 */
export const lotProblemOf = (lot: Lot): LotProblem | null => {
  if (lot.lotTypeCode !== PRODUCTION) {
    return 'notProduction';
  }

  if (lot.completedAt === null || lot.completedAt === undefined) {
    return 'notCompleted';
  }

  return lot.held === true ? 'held' : null;
};

/**
 * 출발 W/O.
 *
 * 생산LOT 을 만든 원천이 그 W/O 다. 계약이 원천을 다형 참조 짝으로 담고 판별자 값 목록은
 * 아직 열리지 않았는데, 이 화면은 유형이 생산이고 완료된 LOT 만 받으므로 그 원천은 W/O 다.
 */
export const fromWorkOrderIdOf = (lot: Lot): number | null =>
  lotProblemOf(lot) === null ? lot.sourceId : null;

/**
 * 아직 배포되지 않은 공정인가.
 *
 * 배포 시각이 있고 없고로 가른다 - 상태 코드 문자열이 아직 확정되지 않았고, 계약이 그 값으로
 * 화면이 분기하지 말라고 못박았다. 배포 전이면 시작도 안 했다는 뜻이라 경고로 족하다.
 */
export const isUnreleased = (workOrder: WorkOrder): boolean =>
  workOrder.releasedAt === null || workOrder.releasedAt === undefined;

export type QtyProblem = 'notNumber' | 'notPositive' | 'overCompleted';

export const qtyProblemOf = (text: string, completedQty: number): QtyProblem | null => {
  const trimmed = text.trim();
  const value = Number(trimmed);

  if (trimmed === '' || !Number.isFinite(value)) {
    return 'notNumber';
  }

  if (value <= 0) {
    return 'notPositive';
  }

  return value > completedQty ? 'overCompleted' : null;
};

export const canConfirm = (
  lot: Lot | null,
  toWorkOrder: WorkOrder | null,
  qty: string,
  hasWorker: boolean,
): boolean => {
  if (!hasWorker || lot === null || toWorkOrder === null) {
    return false;
  }

  const from = fromWorkOrderIdOf(lot);

  /* 같은 W/O 로는 넘기지 못한다. 서버도 막지만 눌러 보고 알게 두지 않는다. */
  if (from === null || from === toWorkOrder.workOrderId) {
    return false;
  }

  return qtyProblemOf(qty, lot.initialQty) === null;
};

/**
 * 인계 확정 본문.
 *
 * 수령 시각은 싣지 않는다 - 받는 쪽 화면이 없어 서버가 인계와 같은 시각으로 함께 찍는다.
 * 화면의 단추가 하나인 이유다.
 */
export const toBody = (
  lot: Lot,
  fromWorkOrderId: number,
  toWorkOrderId: number,
  qty: string,
  now: Date,
): OperationHandoverCreate => ({
  fromWorkOrderId,
  toWorkOrderId,
  handedOverAt: now.toISOString(),
  lines: [
    {
      lotId: lot.lotId,
      handoverQty: Number(qty.trim()),
      uomId: lot.uomId,
    },
  ],
});
