import { messages } from '@omf-mes/i18n';

import type { WorkOrderAssignmentDraft, WorkOrderAssignmentFieldError } from './assignment-model';
import { toWorkOrderListRow, type WorkOrderListRow } from './list-row';
import type { WorkOrderFact, WorkOrderValidationReport } from './queries';

const t = messages.workOrder.screen;
const ASSIGNMENT_FIELDS = [
  'productionLineId',
  'responsibleWorkerId',
  'plannedEquipmentId',
  'plannedMoldId',
  'plannedShiftId',
] as const;

const readPositiveId = (params: URLSearchParams, name: string): number | null => {
  const raw = params.get(name);
  if (raw === null || !/^[1-9]\d*$/.test(raw)) return null;

  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
};

export const readWorkOrderProductionPlanId = (params: URLSearchParams): number | null =>
  readPositiveId(params, 'productionPlanId');

/** 다른 화면이 특정 W/O 를 고친 채로 열라고 보낸 선택. 목록에 없으면 무시된다. */
export const readWorkOrderSelectedId = (params: URLSearchParams): number | null =>
  readPositiveId(params, 'workOrderId');

export const workOrderAssignmentPath = (productionPlanId: number, workOrderId: number): string =>
  `/production/work-order-assignments?productionPlanId=${String(productionPlanId)}&workOrderId=${String(workOrderId)}`;

export const workOrderDraftEquals = (
  left: WorkOrderAssignmentDraft,
  right: WorkOrderAssignmentDraft,
): boolean =>
  (Object.keys(left) as (keyof WorkOrderAssignmentDraft)[]).every(
    (field) => left[field] === right[field],
  );

export const workOrderFieldErrorMessage = (error: WorkOrderAssignmentFieldError): string =>
  t.errors[error];

const assignmentLabel = (fact: WorkOrderFact): string => {
  const assigned = ASSIGNMENT_FIELDS.filter((field) => fact[field] !== null).length;
  return t.assignmentCount(assigned, ASSIGNMENT_FIELDS.length);
};

const validationPresentation = (
  report: WorkOrderValidationReport | undefined,
  failed: boolean,
): Pick<WorkOrderListRow, 'validationLabel' | 'validationTone'> => {
  if (failed) return { validationLabel: t.validation.failed, validationTone: 'error' };
  if (report === undefined)
    return { validationLabel: t.validation.notChecked, validationTone: 'idle' };
  if (!report.passed || report.findings.some((finding) => finding.severity === 'BLOCK')) {
    return { validationLabel: t.validation.blocked, validationTone: 'error' };
  }
  if (report.findings.some((finding) => finding.severity === 'WARN')) {
    return { validationLabel: t.validation.warning, validationTone: 'warning' };
  }
  return { validationLabel: t.validation.passed, validationTone: 'success' };
};

export interface WorkOrderScreenRowInput {
  operationLabel: string | null | undefined;
  uomLabel: string;
  priorityText: string;
  priorityError: string | undefined;
  validationFailed?: boolean;
  validationReport?: WorkOrderValidationReport;
}

export const toWorkOrderScreenRow = (
  fact: WorkOrderFact,
  input: WorkOrderScreenRowInput,
): WorkOrderListRow =>
  toWorkOrderListRow(fact, {
    operationLabel: input.operationLabel,
    quantityLabel: `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(fact.orderQty)} ${input.uomLabel}`,
    priorityText: input.priorityText,
    priorityError: input.priorityError,
    assignmentLabel: assignmentLabel(fact),
    ...validationPresentation(input.validationReport, input.validationFailed === true),
  });
