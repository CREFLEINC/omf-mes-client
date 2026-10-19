import type { components } from '@omf-mes/api-client';

import { PLANT_UTC_OFFSET, toPlantDateTimeParts } from '../../patterns/plant-time';
import type { WorkOrderFact } from './queries';
import type { WorkOrderShiftFact } from './resource-queries';

type WorkOrderUpdate = components['schemas']['WorkOrderUpdate'];

const RESOURCE_FIELDS = [
  'productionLineId',
  'responsibleWorkerId',
  'plannedEquipmentId',
  'plannedMoldId',
  'plannedShiftId',
] as const;
const LOCATION_FIELDS = [
  'defaultWipLocationId',
  'defaultFgLocationId',
  'defaultScrapLocationId',
] as const;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export interface WorkOrderAssignmentDraft {
  productionLineId: string;
  responsibleWorkerId: string;
  plannedEquipmentId: string;
  plannedMoldId: string;
  plannedShiftId: string;
  defaultWipLocationId: string;
  defaultFgLocationId: string;
  defaultScrapLocationId: string;
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

/*
 * 계획 시각 칸은 «공장 시각»이다 — 브라우저 시간대로 읽으면 한국에서 연 화면이 두 시간 늦게 보이고,
 * 교대 시각(공장 벽시계)과도 어긋난다.
 */
const toOffsetDateTime = (local: string): string => `${local}:00${PLANT_UTC_OFFSET}`;

const toLocalDateTime = (value: string | null): string => {
  const parts = toPlantDateTimeParts(value);
  return parts === null ? '' : `${parts.date}T${parts.time}`;
};

const addDays = (date: string, days: number): string => {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

/** 교대가 없는 공장의 근무일 시작 — 서버 전개와 같은 값이다. */
const DEFAULT_DAY_START = '08:00';

/**
 * 계획일과 교대로 계획 시작·종료(공장 시각)를 낸다.
 *
 * - 교대를 고르면 그 교대 시각. 자정을 넘기는 교대는 다음 날 끝난다.
 * - 고르지 않으면 근무일 하루 — 가장 이른 활성 교대 시작부터 24시간(서버가 W/O 를 만들 때와 같다).
 *   근무일은 그 생산(주간 + 야간)이 시작한 날이다.
 */
export const plannedWindowLocal = (
  planDate: string,
  shiftId: string,
  shifts: readonly WorkOrderShiftFact[],
): Pick<WorkOrderAssignmentDraft, 'plannedStartAtLocal' | 'plannedEndAtLocal'> => {
  const hhmm = (time: string): string => time.slice(0, 5);
  const shift = shifts.find((item) => String(item.shiftId) === shiftId);
  if (shift !== undefined) {
    return {
      plannedStartAtLocal: `${planDate}T${hhmm(shift.startTime)}`,
      plannedEndAtLocal: `${shift.crossesMidnight ? addDays(planDate, 1) : planDate}T${hhmm(shift.endTime)}`,
    };
  }
  const starts = shifts
    .filter((item) => item.isActive)
    .map((item) => hhmm(item.startTime))
    .sort();
  const dayStart = starts[0] ?? DEFAULT_DAY_START;
  return {
    plannedStartAtLocal: `${planDate}T${dayStart}`,
    plannedEndAtLocal: `${addDays(planDate, 1)}T${dayStart}`,
  };
};

const toNullableId = (value: string): number | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
};

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
  defaultWipLocationId: fact.defaultWipLocationId?.toString() ?? '',
  defaultFgLocationId: fact.defaultFgLocationId?.toString() ?? '',
  defaultScrapLocationId: fact.defaultScrapLocationId?.toString() ?? '',
  plannedStartAtLocal: toLocalDateTime(fact.plannedStartAt),
  plannedEndAtLocal: toLocalDateTime(fact.plannedEndAt),
  priorityNo: fact.priorityNo.toString(),
});

/** 저장 전에 반드시 골라야 하는 칸 — 화면의 필수 표시와 같은 목록이다. */
export const REQUIRED_ASSIGNMENT_FIELDS = [
  'productionLineId',
  'defaultWipLocationId',
  'defaultFgLocationId',
  'defaultScrapLocationId',
] as const;

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
  for (const field of LOCATION_FIELDS) {
    const value = draft[field].trim();
    if (value !== '' && !isPositiveSafeInteger(Number(value))) {
      fieldErrors[field] = 'INVALID_SELECTION';
    }
  }

  /*
   * 생산 라인과 기본 위치 셋은 반드시 골라야 저장할 수 있다(사용자 지시 2026-09-20).
   * 세 위치가 비면 배포(W-02-04)가 서버에서 막히고, 라인은 작업지시 검증이 본다 —
   * 그 막힘을 배포 화면까지 가서 만나지 않도록 이 화면에서 먼저 잡는다.
   */
  for (const field of REQUIRED_ASSIGNMENT_FIELDS) {
    if (draft[field].trim() === '') fieldErrors[field] = 'REQUIRED';
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

export const toWorkOrderAssignmentUpdate = (
  draft: WorkOrderAssignmentDraft,
): WorkOrderUpdate | null => {
  if (!isWorkOrderAssignmentSaveEnabled(draft)) return null;

  return {
    productionLineId: toNullableId(draft.productionLineId),
    responsibleWorkerId: toNullableId(draft.responsibleWorkerId),
    plannedEquipmentId: toNullableId(draft.plannedEquipmentId),
    plannedMoldId: toNullableId(draft.plannedMoldId),
    plannedShiftId: toNullableId(draft.plannedShiftId),
    defaultWipLocationId: toNullableId(draft.defaultWipLocationId),
    defaultFgLocationId: toNullableId(draft.defaultFgLocationId),
    defaultScrapLocationId: toNullableId(draft.defaultScrapLocationId),
    plannedStartAt:
      draft.plannedStartAtLocal === '' ? null : toOffsetDateTime(draft.plannedStartAtLocal),
    plannedEndAt: draft.plannedEndAtLocal === '' ? null : toOffsetDateTime(draft.plannedEndAtLocal),
    priorityNo: Number(draft.priorityNo.trim()),
  };
};
