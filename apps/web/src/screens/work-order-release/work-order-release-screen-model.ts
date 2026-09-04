import type { WorkOrderReleaseFilterValues } from './work-order-release-filter-bar';
import { EMPTY_WORK_ORDER_RELEASE_FILTERS } from './work-order-release-filter-bar';
import type { WorkOrderReleaseFilters } from './queries';

export interface WorkOrderReleaseScreenState {
  appliedFilters: WorkOrderReleaseFilterValues;
  page: number;
  selectedWorkOrderId: number | null;
}

export type WorkOrderReleaseCandidateSnapshot =
  | { kind: 'PENDING' }
  | { kind: 'FAILED' }
  | { kind: 'ABSENT' }
  | { kind: 'SETTLED'; candidateIds: readonly number[] };

export type WorkOrderReleaseScreenAction =
  | { type: 'SEARCH'; filters: WorkOrderReleaseFilterValues }
  | { type: 'RESET' }
  | { type: 'CHANGE_PAGE'; page: number }
  | { type: 'SELECT'; workOrderId: number }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'CLEAR_MISSING_SELECTION'; snapshot: WorkOrderReleaseCandidateSnapshot };

export const createWorkOrderReleaseScreenState = (): WorkOrderReleaseScreenState => ({
  appliedFilters: { ...EMPTY_WORK_ORDER_RELEASE_FILTERS },
  page: 1,
  selectedWorkOrderId: null,
});

const isPositiveInteger = (value: number): boolean => Number.isSafeInteger(value) && value > 0;

export const reduceWorkOrderReleaseScreen = (
  state: WorkOrderReleaseScreenState,
  action: WorkOrderReleaseScreenAction,
): WorkOrderReleaseScreenState => {
  switch (action.type) {
    case 'SEARCH':
      return {
        appliedFilters: { ...action.filters },
        page: 1,
        selectedWorkOrderId: null,
      };
    case 'RESET':
      return createWorkOrderReleaseScreenState();
    case 'CHANGE_PAGE':
      return isPositiveInteger(action.page)
        ? { ...state, page: action.page, selectedWorkOrderId: null }
        : state;
    case 'SELECT':
      return isPositiveInteger(action.workOrderId)
        ? { ...state, selectedWorkOrderId: action.workOrderId }
        : state;
    case 'CLEAR_SELECTION':
      return state.selectedWorkOrderId === null ? state : { ...state, selectedWorkOrderId: null };
    case 'CLEAR_MISSING_SELECTION':
      if (
        action.snapshot.kind !== 'SETTLED' ||
        state.selectedWorkOrderId === null ||
        action.snapshot.candidateIds.includes(state.selectedWorkOrderId)
      ) {
        return state;
      }
      return { ...state, selectedWorkOrderId: null };
  }
};

const positiveId = (value: string): number | null | undefined => {
  const normalized = value.trim();
  if (normalized === '') return null;
  if (!/^[1-9]\d*$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return isPositiveInteger(parsed) ? parsed : undefined;
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const optionalDate = (value: string): string | null | undefined => {
  const normalized = value.trim();
  if (normalized === '') return null;
  if (!datePattern.test(normalized)) return undefined;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : undefined;
};

const pad = (value: number): string => String(value).padStart(2, '0');

/** `Date#getTimezoneOffset`의 반대 부호인 UTC 기준 분 차이를 RFC 3339 오프셋으로 만든다. */
const zoneOf = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(offsetMinutes);

  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
};

/** 달·해·윤년 경계는 UTC 달력 연산에 맡긴다. 입력은 `optionalDate`를 통과한 날짜다. */
const nextDay = (value: string): string => {
  const date = new Date(`${value}T00:00:00Z`);

  date.setUTCDate(date.getUTCDate() + 1);

  return date.toISOString().slice(0, 10);
};

/** 계약의 반열림 date-time 범위: 시작일 00:00 이상, 종료일 다음 날 00:00 미만. */
const toDateTimeBounds = (
  from: string | null | undefined,
  to: string | null | undefined,
  offsetMinutes: number,
): Pick<WorkOrderReleaseFilters, 'plannedStartFrom' | 'plannedStartTo'> => {
  const zone = zoneOf(offsetMinutes);

  return {
    plannedStartFrom: typeof from === 'string' ? `${from}T00:00:00${zone}` : null,
    plannedStartTo: typeof to === 'string' ? `${nextDay(to)}T00:00:00${zone}` : null,
  };
};

export const toWorkOrderReleaseFilters = (
  state: WorkOrderReleaseScreenState,
  offsetMinutes: number,
): WorkOrderReleaseFilters => {
  const productionLineId = positiveId(state.appliedFilters.productionLineId);
  const plannedStartFrom = optionalDate(state.appliedFilters.plannedStartFrom);
  const plannedStartTo = optionalDate(state.appliedFilters.plannedStartTo);
  const statusCode = state.appliedFilters.statusCode.trim();
  const pageIsValid = isPositiveInteger(state.page);
  const datesAreOrdered =
    plannedStartFrom === undefined ||
    plannedStartTo === undefined ||
    plannedStartFrom === null ||
    plannedStartTo === null ||
    plannedStartFrom <= plannedStartTo;
  const canLoad =
    statusCode !== '' &&
    productionLineId !== undefined &&
    plannedStartFrom !== undefined &&
    plannedStartTo !== undefined &&
    datesAreOrdered &&
    pageIsValid;
  const bounds = toDateTimeBounds(plannedStartFrom, plannedStartTo, offsetMinutes);

  return {
    statusCode: canLoad ? statusCode : null,
    productionLineId: productionLineId ?? null,
    plannedStartFrom: bounds.plannedStartFrom,
    plannedStartTo: bounds.plannedStartTo,
    page: pageIsValid ? state.page : 1,
  };
};
