import { messages } from '@omf-mes/i18n';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  toWorkOrderCloseFilterInitialization,
  type WorkOrderCloseFilterInitialization,
  type WorkOrderCloseStatusLookupSnapshot,
} from './filter-initialization';

const t = messages.workOrderClose.filter;
const completed = {
  code: 'IN_PROGRESS',
  codeName: 'Completed',
  displayOrder: 20,
  isActive: true,
};
const snapshot = (
  overrides: Partial<WorkOrderCloseStatusLookupSnapshot> = {},
): WorkOrderCloseStatusLookupSnapshot => ({
  data: { items: [completed], truncated: false },
  isError: false,
  isPending: false,
  ...overrides,
});
const emptyFilters = {
  productionOrderId: '',
  plannedStartFrom: '',
  plannedStartTo: '',
  statusCode: '',
};

describe('toWorkOrderCloseFilterInitialization', () => {
  it('narrows the initial status code together with its discriminant', () => {
    type Checking = Extract<WorkOrderCloseFilterInitialization, { kind: 'CHECKING' }>;
    type Unavailable = Extract<WorkOrderCloseFilterInitialization, { kind: 'UNAVAILABLE' }>;
    type Ready = Extract<WorkOrderCloseFilterInitialization, { kind: 'READY' }>;

    expectTypeOf<Checking['initialFilters']['statusCode']>().toEqualTypeOf<''>();
    expectTypeOf<Unavailable['initialFilters']['statusCode']>().toEqualTypeOf<''>();
    expectTypeOf<Ready['initialFilters']['statusCode']>().toEqualTypeOf<'IN_PROGRESS'>();
  });

  it('prioritizes an error over loading and stale, truncated IN_PROGRESS data', () => {
    expect(
      toWorkOrderCloseFilterInitialization(
        snapshot({
          data: { items: [completed], truncated: true },
          isError: true,
          isPending: true,
        }),
      ),
    ).toEqual({
      kind: 'UNAVAILABLE',
      initialFilters: emptyFilters,
      canLoadCandidates: false,
      statusUnavailableReason: t.statusLookupFailed,
    });
  });

  it('keeps checking while loading even when stale IN_PROGRESS data exists', () => {
    expect(toWorkOrderCloseFilterInitialization(snapshot({ isPending: true }))).toEqual({
      kind: 'CHECKING',
      initialFilters: emptyFilters,
      canLoadCandidates: false,
      statusUnavailableReason: t.statusLookupLoading,
    });
  });

  it.each([
    ['missing data', undefined, t.statusLookupEmpty],
    ['empty values', { items: [], truncated: false }, t.statusLookupEmpty],
    [
      'inactive values only',
      { items: [{ ...completed, isActive: false }], truncated: false },
      t.statusLookupEmpty,
    ],
    [
      'truncated values containing IN_PROGRESS',
      { items: [completed], truncated: true },
      t.statusLookupTruncated,
    ],
    [
      'another active value',
      { items: [{ ...completed, code: 'READY' }], truncated: false },
      t.inProgressStatusMissing,
    ],
    [
      'lowercase IN_PROGRESS',
      { items: [{ ...completed, code: 'in_progress' }], truncated: false },
      t.inProgressStatusMissing,
    ],
    [
      'space-padded IN_PROGRESS',
      { items: [{ ...completed, code: ' IN_PROGRESS ' }], truncated: false },
      t.inProgressStatusMissing,
    ],
  ] as const)('blocks candidates for %s', (_case, data, statusUnavailableReason) => {
    expect(toWorkOrderCloseFilterInitialization(snapshot({ data }))).toEqual({
      kind: 'UNAVAILABLE',
      initialFilters: emptyFilters,
      canLoadCandidates: false,
      statusUnavailableReason,
    });
  });

  it('returns READY only for an exact active IN_PROGRESS value in a complete list', () => {
    expect(
      toWorkOrderCloseFilterInitialization(
        snapshot({
          data: {
            items: [{ ...completed, code: 'READY' }, completed],
            truncated: false,
          },
        }),
      ),
    ).toEqual({
      kind: 'READY',
      initialFilters: { ...emptyFilters, statusCode: 'IN_PROGRESS' },
      canLoadCandidates: true,
      statusUnavailableReason: null,
    });
  });
});
