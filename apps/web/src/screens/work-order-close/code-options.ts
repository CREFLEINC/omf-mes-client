import type { WorkOrderCloseCodeValue, WorkOrderCloseProductionOrder } from './queries';

export const WORK_ORDER_CLOSE_CODE_GROUPS = {
  status: 'WORK_ORDER_STATUS',
  varianceReason: 'WORK_ORDER_COMPLETION_VARIANCE_REASON',
} as const;

export interface WorkOrderCloseOption {
  value: string;
  label: string;
}

/** 선택 가능한 현재 값만 서버의 표시 순서로 옮긴다. */
export const toWorkOrderCloseCodeOptions = (
  values: readonly WorkOrderCloseCodeValue[],
): WorkOrderCloseOption[] =>
  values
    .filter((value) => value.isActive)
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((value) => ({
      value: value.code,
      label: value.codeName.trim() === '' ? value.code : value.codeName,
    }));

/** P/O의 서버 순서를 바꾸지 않는다. */
export const toWorkOrderCloseProductionOrderOptions = (
  orders: readonly WorkOrderCloseProductionOrder[],
): WorkOrderCloseOption[] =>
  orders.map((order) => ({
    value: String(order.productionOrderId),
    label: order.productionOrderNo,
  }));
