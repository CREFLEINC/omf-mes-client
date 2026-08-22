import type { ChipStatus } from '@crefle/web-ui';

import type { WorkOrderFact } from './queries';

export interface WorkOrderListRow {
  workOrderId: number;
  workOrderNo: string;
  operationLabel: string | null | undefined;
  quantityLabel: string;
  priorityText: string;
  priorityError: string | undefined;
  assignmentLabel: string;
  validationLabel: string;
  validationTone: ChipStatus;
}

export interface WorkOrderListPresentation {
  operationLabel: string | null | undefined;
  quantityLabel: string;
  priorityText: string;
  priorityError: string | undefined;
  assignmentLabel: string;
  validationLabel: string;
  validationTone: ChipStatus;
}

export const toWorkOrderListRow = (
  fact: WorkOrderFact,
  presentation: WorkOrderListPresentation,
): WorkOrderListRow => ({
  workOrderId: fact.workOrderId,
  workOrderNo: fact.workOrderNo,
  operationLabel: presentation.operationLabel,
  quantityLabel: presentation.quantityLabel,
  priorityText: presentation.priorityText,
  priorityError: presentation.priorityError,
  assignmentLabel: presentation.assignmentLabel,
  validationLabel: presentation.validationLabel,
  validationTone: presentation.validationTone,
});
