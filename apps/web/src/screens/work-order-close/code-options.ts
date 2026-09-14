import { masterName } from '../../patterns/master-name';
import type { WorkOrderCloseCodeValue, WorkOrderCloseProductionOrder } from './queries';

export const WORK_ORDER_CLOSE_CODE_GROUPS = {
  status: 'WORK_ORDER_STATUS',
  varianceReason: 'WORK_ORDER_COMPLETION_VARIANCE_REASON',
  correctionReason: 'PRODUCTION_RESULT_CORRECT_REASON',
} as const;

export interface WorkOrderCloseOption {
  value: string;
  label: string;
}

/**
 * 코드값의 표시명 — **고른 언어의 다국어 컬럼이 먼저, 기본 이름이 fallback**(공유계약 G-33).
 *
 * 고객이 늘리는 코드(`registry`)의 표시명은 마스터의 `nameKo`·`nameVi`가 정본이고 `codeName`은
 * 그것이 비었을 때의 fallback이다. 어느 칸을 볼지는 `patterns/master-name.ts` 가 정한다 —
 * 화면마다 그 식을 적으면 언어가 늘 때 빠뜨린 화면만 옛 언어로 남는다(#1113).
 * 둘 다 비면 코드를 그대로 보인다 — 빈 라벨을 그리지 않는다.
 */
export const toWorkOrderCloseCodeLabel = (value: {
  code: string;
  codeName: string;
  nameKo?: string | null;
  nameVi?: string | null;
}): string => masterName(value, value.codeName.trim() || value.code);

/** 선택 가능한 현재 값만 서버의 표시 순서로 옮긴다. */
export const toWorkOrderCloseCodeOptions = (
  values: readonly WorkOrderCloseCodeValue[],
): WorkOrderCloseOption[] =>
  values
    .filter((value) => value.isActive)
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((value) => ({ value: value.code, label: toWorkOrderCloseCodeLabel(value) }));

/** P/O의 서버 순서를 바꾸지 않는다. */
export const toWorkOrderCloseProductionOrderOptions = (
  orders: readonly WorkOrderCloseProductionOrder[],
): WorkOrderCloseOption[] =>
  orders.map((order) => ({
    value: String(order.productionOrderId),
    label: order.productionOrderNo,
  }));
