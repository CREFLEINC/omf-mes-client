import type { WorkOrderFact } from './queries';

const RESOURCE_FIELDS = [
  'productionLineId',
  'responsibleWorkerId',
  'plannedEquipmentId',
  'plannedMoldId',
  'plannedShiftId',
] as const;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export interface WorkOrderAssignmentDraft {
  productionLineId: string;
  responsibleWorkerId: string;
  plannedEquipmentId: string;
  plannedMoldId: string;
  plannedShiftId: string;
  plannedStartAtLocal: string;
  plannedEndAtLocal: string;
  priorityNo: string;
}

export type WorkOrderAssignmentDraftField = keyof WorkOrderAssignmentDraft;
export type WorkOrderAssignmentFieldError =
  'REQUIRED' | 'INVALID_SELECTION' | 'INVALID_INTEGER' | 'INVALID_DATE_TIME' | 'END_BEFORE_START';
export type WorkOrderAssignmentFieldErrors = Partial<
  Record<WorkOrderAssignmentDraftField, WorkOrderAssignmentFieldError>
>;
export type WorkOrderAssignmentFormError = 'ASSIGNMENT_REQUIRED' | null;

export interface WorkOrderAssignmentDraftValidation {
  fieldErrors: WorkOrderAssignmentFieldErrors;
  formError: WorkOrderAssignmentFormError;
}

const isPositiveSafeInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const isValidLocalDateTime = (value: string): boolean => {
  const match = DATE_TIME_PATTERN.exec(value);
  if (match === null) return false;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth[month - 1]! &&
    hour <= 23 &&
    minute <= 59
  );
};

export const workOrderAssignmentDraftFrom = (fact: WorkOrderFact): WorkOrderAssignmentDraft => ({
  productionLineId: fact.productionLineId?.toString() ?? '',
  responsibleWorkerId: fact.responsibleWorkerId?.toString() ?? '',
  plannedEquipmentId: fact.plannedEquipmentId?.toString() ?? '',
  plannedMoldId: fact.plannedMoldId?.toString() ?? '',
  plannedShiftId: fact.plannedShiftId?.toString() ?? '',
  plannedStartAtLocal: fact.plannedStartAt?.slice(0, 16) ?? '',
  plannedEndAtLocal: fact.plannedEndAt?.slice(0, 16) ?? '',
  priorityNo: fact.priorityNo.toString(),
});

export const validateWorkOrderAssignmentDraft = (
  draft: WorkOrderAssignmentDraft,
): WorkOrderAssignmentDraftValidation => {
  const fieldErrors: WorkOrderAssignmentFieldErrors = {};

  for (const field of RESOURCE_FIELDS) {
    const value = draft[field].trim();
    if (value !== '' && !isPositiveSafeInteger(Number(value))) {
      fieldErrors[field] = 'INVALID_SELECTION';
    }
  }

  const priorityNo = draft.priorityNo.trim();
  if (priorityNo === '') {
    fieldErrors.priorityNo = 'REQUIRED';
  } else if (!Number.isSafeInteger(Number(priorityNo))) {
    fieldErrors.priorityNo = 'INVALID_INTEGER';
  }

  const hasStart = draft.plannedStartAtLocal !== '';
  const hasEnd = draft.plannedEndAtLocal !== '';
  const isStartValid = !hasStart || isValidLocalDateTime(draft.plannedStartAtLocal);
  const isEndValid = !hasEnd || isValidLocalDateTime(draft.plannedEndAtLocal);

  if (!isStartValid) fieldErrors.plannedStartAtLocal = 'INVALID_DATE_TIME';
  if (!isEndValid) fieldErrors.plannedEndAtLocal = 'INVALID_DATE_TIME';
  if (
    hasStart &&
    hasEnd &&
    isStartValid &&
    isEndValid &&
    draft.plannedEndAtLocal < draft.plannedStartAtLocal
  ) {
    fieldErrors.plannedEndAtLocal = 'END_BEFORE_START';
  }

  return {
    fieldErrors,
    formError: RESOURCE_FIELDS.every((field) => draft[field].trim() === '')
      ? 'ASSIGNMENT_REQUIRED'
      : null,
  };
};

export const isWorkOrderAssignmentSaveEnabled = (draft: WorkOrderAssignmentDraft): boolean => {
  const { fieldErrors, formError } = validateWorkOrderAssignmentDraft(draft);
  return formError === null && Object.keys(fieldErrors).length === 0;
};
