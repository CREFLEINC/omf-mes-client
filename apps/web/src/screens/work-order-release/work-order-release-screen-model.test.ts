import { describe, expect, it } from 'vitest';

import type { WorkOrderReleaseFilterValues } from './work-order-release-filter-bar';
import {
  createWorkOrderReleaseScreenState,
  reduceWorkOrderReleaseScreen,
  toWorkOrderReleaseFilters,
  type WorkOrderReleaseCandidateSnapshot,
  type WorkOrderReleaseScreenState,
} from './work-order-release-screen-model';

const searchedFilters: WorkOrderReleaseFilterValues = {
  productionLineId: '501',
  plannedStartFrom: '2026-08-26',
  plannedStartTo: '2026-08-28',
  statusCode: 'CONFIRMED',
};

const selectedState = (): WorkOrderReleaseScreenState => ({
  appliedFilters: { ...searchedFilters },
  page: 3,
  selectedWorkOrderId: 701,
});

const clearMissing = (
  state: WorkOrderReleaseScreenState,
  snapshot: WorkOrderReleaseCandidateSnapshot,
): WorkOrderReleaseScreenState =>
  reduceWorkOrderReleaseScreen(state, { type: 'CLEAR_MISSING_SELECTION', snapshot });

describe('work-order release screen state', () => {
  it('starts fail-closed without a guessed status code', () => {
    const state = createWorkOrderReleaseScreenState();

    expect(state).toEqual({
      appliedFilters: {
        productionLineId: '',
        plannedStartFrom: '',
        plannedStartTo: '',
        statusCode: '',
      },
      page: 1,
      selectedWorkOrderId: null,
    });
    expect(toWorkOrderReleaseFilters(state).statusCode).toBeNull();
  });

  it('owns search, page, selection, and reset lifetimes without mutating inputs', () => {
    const filters = { ...searchedFilters };
    let state = reduceWorkOrderReleaseScreen(createWorkOrderReleaseScreenState(), {
      type: 'SEARCH',
      filters,
    });
    expect(state).toMatchObject({ appliedFilters: filters, page: 1, selectedWorkOrderId: null });
    state = reduceWorkOrderReleaseScreen(state, { type: 'SELECT', workOrderId: 701 });
    expect(state.selectedWorkOrderId).toBe(701);
    state = reduceWorkOrderReleaseScreen(state, { type: 'CHANGE_PAGE', page: 4 });
    expect(state).toMatchObject({ appliedFilters: filters, page: 4, selectedWorkOrderId: null });
    expect(reduceWorkOrderReleaseScreen(state, { type: 'RESET' })).toEqual(
      createWorkOrderReleaseScreenState(),
    );
    expect(filters).toEqual(searchedFilters);
  });

  it('rejects invalid page and selection transitions', () => {
    const state = selectedState();

    expect(reduceWorkOrderReleaseScreen(state, { type: 'CHANGE_PAGE', page: 0 })).toBe(state);
    expect(reduceWorkOrderReleaseScreen(state, { type: 'CHANGE_PAGE', page: 1.5 })).toBe(state);
    expect(reduceWorkOrderReleaseScreen(state, { type: 'SELECT', workOrderId: -1 })).toBe(state);
  });

  it('clears only settled selections absent from the current page', () => {
    const state = selectedState();
    (['PENDING', 'FAILED', 'ABSENT'] as const).forEach((kind) =>
      expect(clearMissing(state, { kind })).toBe(state),
    );
    expect(clearMissing(state, { kind: 'SETTLED', candidateIds: [701, 702] })).toBe(state);
    expect(clearMissing(state, { kind: 'SETTLED', candidateIds: [702] })).toEqual({
      ...state,
      selectedWorkOrderId: null,
    });
  });

  it('clears only selection while preserving filter and page identities', () => {
    const state = selectedState();
    const cleared = reduceWorkOrderReleaseScreen(state, { type: 'CLEAR_SELECTION' });

    expect(cleared).toEqual({ ...state, selectedWorkOrderId: null });
    expect(cleared.appliedFilters).toBe(state.appliedFilters);
    expect(reduceWorkOrderReleaseScreen(cleared, { type: 'CLEAR_SELECTION' })).toBe(cleared);
  });
});

describe('work-order release filter projection', () => {
  it('normalizes valid filters and preserves blank optionals as null', () => {
    const state = selectedState();
    const snapshot = structuredClone(state);

    expect(toWorkOrderReleaseFilters(state)).toEqual({
      statusCode: 'CONFIRMED',
      productionLineId: 501,
      plannedStartFrom: '2026-08-26',
      plannedStartTo: '2026-08-28',
      page: 3,
    });
    expect(
      toWorkOrderReleaseFilters({
        ...state,
        appliedFilters: { ...searchedFilters, productionLineId: '', plannedStartFrom: '' },
      }),
    ).toMatchObject({ productionLineId: null, plannedStartFrom: null });
    expect(state).toEqual(snapshot);
  });

  it.each([
    ['blank status', { appliedFilters: { ...searchedFilters, statusCode: '   ' } }],
    ['non-numeric line', { appliedFilters: { ...searchedFilters, productionLineId: 'LINE-A' } }],
    ['fractional line', { appliedFilters: { ...searchedFilters, productionLineId: '1.5' } }],
    ['invalid date', { appliedFilters: { ...searchedFilters, plannedStartFrom: '2026-02-30' } }],
    [
      'reversed dates',
      {
        appliedFilters: {
          ...searchedFilters,
          plannedStartFrom: '2026-08-29',
          plannedStartTo: '2026-08-28',
        },
      },
    ],
    ['unsafe page', { page: Number.MAX_SAFE_INTEGER + 1 }],
  ] as const)('fails closed for %s', (_name, overrides) => {
    const state = { ...selectedState(), ...overrides } as WorkOrderReleaseScreenState;

    expect(toWorkOrderReleaseFilters(state).statusCode).toBeNull();
  });
});
