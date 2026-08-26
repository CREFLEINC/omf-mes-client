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

export const toWorkOrderReleaseFilters = (
  state: WorkOrderReleaseScreenState,
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

  return {
    statusCode: canLoad ? statusCode : null,
    productionLineId: productionLineId ?? null,
    plannedStartFrom: plannedStartFrom ?? null,
    plannedStartTo: plannedStartTo ?? null,
    page: pageIsValid ? state.page : 1,
  };
};
