import type { WorkOrderCloseCandidateRow } from './candidate-list-pane';
import {
  describeWorkOrderCloseItemReference,
  resolveWorkOrderCloseUomReference,
  toWorkOrderCloseQuantityLabel,
  type WorkOrderCloseItemReference,
  type WorkOrderCloseUomReferenceSource,
} from './candidate-references';
import type { WorkOrderCloseFilterValues } from './filter-bar';
import type { WorkOrderCloseFilterInitialization } from './filter-initialization';
import type { WorkOrderCloseFact, WorkOrderCloseFilters } from './queries';

export interface WorkOrderCloseCandidateScreenState {
  initializationKind: WorkOrderCloseFilterInitialization['kind'];
  appliedFilters: WorkOrderCloseFilterValues;
  page: number;
  selectedWorkOrderId: number | null;
}

export type WorkOrderCloseCandidateSnapshot =
  | { kind: 'PENDING' }
  | { kind: 'FAILED' }
  | { kind: 'ABSENT' }
  | { kind: 'SETTLED'; candidateIds: readonly number[] };

export type WorkOrderCloseCandidateScreenAction =
  | {
      type: 'SYNCHRONIZE_INITIALIZATION';
      initialization: WorkOrderCloseFilterInitialization;
    }
  | { type: 'SEARCH'; filters: WorkOrderCloseFilterValues }
  | { type: 'RESET' }
  | { type: 'CHANGE_PAGE'; page: number }
  | { type: 'SELECT'; workOrderId: number }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'CLEAR_MISSING_SELECTION'; snapshot: WorkOrderCloseCandidateSnapshot };

const initialFilters = (statusCode = ''): WorkOrderCloseFilterValues => ({
  productionOrderId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode,
});

const stateForInitialization = (
  initialization: WorkOrderCloseFilterInitialization,
): WorkOrderCloseCandidateScreenState => ({
  initializationKind: initialization.kind,
  appliedFilters: { ...initialization.initialFilters },
  page: 1,
  selectedWorkOrderId: null,
});

export const createWorkOrderCloseCandidateScreenState = (
  initialization: WorkOrderCloseFilterInitialization,
): WorkOrderCloseCandidateScreenState => stateForInitialization(initialization);

export const reduceWorkOrderCloseCandidateScreen = (
  state: WorkOrderCloseCandidateScreenState,
  action: WorkOrderCloseCandidateScreenAction,
): WorkOrderCloseCandidateScreenState => {
  switch (action.type) {
    case 'SYNCHRONIZE_INITIALIZATION':
      if (action.initialization.kind === 'READY' && state.initializationKind === 'READY') {
        return state;
      }
      return stateForInitialization(action.initialization);
    case 'SEARCH':
      if (state.initializationKind !== 'READY') return state;
      return {
        ...state,
        appliedFilters: { ...action.filters },
        page: 1,
        selectedWorkOrderId: null,
      };
    case 'RESET':
      return {
        ...state,
        appliedFilters: initialFilters(state.initializationKind === 'READY' ? 'COMPLETED' : ''),
        page: 1,
        selectedWorkOrderId: null,
      };
    case 'CHANGE_PAGE':
      if (state.initializationKind !== 'READY') return state;
      return { ...state, page: action.page, selectedWorkOrderId: null };
    case 'SELECT':
      if (state.initializationKind !== 'READY') return state;
      return { ...state, selectedWorkOrderId: action.workOrderId };
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

const optionalFilter = (value: string): string | null => (value === '' ? null : value);

export const toWorkOrderCloseCandidateFilters = (
  state: WorkOrderCloseCandidateScreenState,
): WorkOrderCloseFilters => {
  const productionOrderText = state.appliedFilters.productionOrderId.trim();
  const productionOrderId = productionOrderText === '' ? null : Number(productionOrderText);
  const isValidProductionOrder =
    productionOrderId === null ||
    (/^[1-9]\d*$/.test(productionOrderText) &&
      Number.isSafeInteger(productionOrderId) &&
      productionOrderId > 0);
  const isValidPage = Number.isSafeInteger(state.page) && state.page > 0;
  const canLoadCandidates =
    state.initializationKind === 'READY' &&
    state.appliedFilters.statusCode.trim() !== '' &&
    isValidProductionOrder &&
    isValidPage;

  return {
    statusCode: canLoadCandidates ? state.appliedFilters.statusCode : null,
    productionOrderId: canLoadCandidates ? productionOrderId : null,
    plannedStartFrom: optionalFilter(state.appliedFilters.plannedStartFrom),
    plannedStartTo: optionalFilter(state.appliedFilters.plannedStartTo),
    page: isValidPage ? state.page : 1,
  };
};

export const toWorkOrderCloseCandidateRows = (
  candidates: readonly WorkOrderCloseFact[],
  itemReferences: readonly WorkOrderCloseItemReference[],
  uomSource: WorkOrderCloseUomReferenceSource,
): WorkOrderCloseCandidateRow[] =>
  candidates.map((candidate) => {
    const itemReference = itemReferences.find((reference) => reference.itemId === candidate.itemId);
    const itemLabel = describeWorkOrderCloseItemReference(
      itemReference ?? { itemId: candidate.itemId, status: 'unknown', label: null },
    );
    const uom = resolveWorkOrderCloseUomReference(uomSource, candidate.uomId);

    return {
      workOrderId: candidate.workOrderId,
      workOrderNo: candidate.workOrderNo,
      itemLabel,
      quantityLabel: toWorkOrderCloseQuantityLabel(candidate.orderQty, uom),
    };
  });
