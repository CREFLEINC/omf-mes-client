import { describe, expect, it } from 'vitest';

import {
  DEFAULT_PRODUCTION_ORDER_FILTERS,
  readFilters,
  readPage,
  readSelectedProductionOrderId,
  toFilterQuery,
  toSearchParams,
  toSelectionSearchParams,
  type ProductionOrderFilters,
} from './filters';

const filters = (overrides: Partial<ProductionOrderFilters> = {}): ProductionOrderFilters => ({
  ...DEFAULT_PRODUCTION_ORDER_FILTERS,
  ...overrides,
});

describe('production-order URL filter codec', () => {
  it('reads only valid canonical filter, page, and selection values', () => {
    const params = new URLSearchParams(
      'q=%20SYNTH%20&businessUnit=0021&plant=0012&item=20&status=%20RAW%20&dueFrom=2028-02-29&dueTo=2026-02-31&page=003&sel=0007',
    );

    expect(readFilters(params)).toEqual({
      q: 'SYNTH',
      businessUnit: '21',
      plant: '12',
      item: '20',
      status: 'RAW',
      dueFrom: '2028-02-29',
      dueTo: '',
      autoPlan: '',
    });
    expect(readPage(params)).toBe(3);
    expect(readSelectedProductionOrderId(params)).toBe(7);
  });

  it('drops invalid numeric IDs and non-calendar dates', () => {
    const params = new URLSearchParams(
      'businessUnit=-1&plant=0&item=9007199254740992&dueFrom=2026-13-01&dueTo=2026-02-29&page=0&sel=-2',
    );

    expect(readFilters(params)).toEqual(DEFAULT_PRODUCTION_ORDER_FILTERS);
    expect(readPage(params)).toBe(1);
    expect(readSelectedProductionOrderId(params)).toBeNull();
  });

  it('serializes contract query names and omits blank values and first page', () => {
    const current = filters({
      q: ' SYNTH ',
      businessUnit: '21',
      plant: '12',
      item: '20',
      status: ' RAW ',
      dueFrom: '2026-08-01',
      dueTo: '2026-08-31',
    });

    expect(toFilterQuery(current, 3)).toEqual({
      q: 'SYNTH',
      businessUnitId: 21,
      plantId: 12,
      itemId: 20,
      statusCode: 'RAW',
      dueDateFrom: '2026-08-01',
      dueDateTo: '2026-08-31',
      includeChildren: true,
      page: 3,
    });
    expect(toSearchParams(current, 1).toString()).toBe(
      'q=SYNTH&businessUnit=21&plant=12&item=20&status=RAW&dueFrom=2026-08-01&dueTo=2026-08-31',
    );
    expect(toSearchParams(filters(), 1).toString()).toBe('');
    expect(toFilterQuery(filters(), 1)).toEqual({ includeChildren: true });
  });

  it('자동 계획 상태는 두 값만 URL 과 질의로 옮긴다', () => {
    expect(readFilters(new URLSearchParams('autoPlan=NEEDS_REVIEW')).autoPlan).toBe('NEEDS_REVIEW');
    expect(readFilters(new URLSearchParams('autoPlan=needs_review')).autoPlan).toBe('');
    expect(toSearchParams(filters({ autoPlan: 'DONE' }), 1).toString()).toBe('autoPlan=DONE');
    expect(toFilterQuery(filters({ autoPlan: 'NEEDS_REVIEW' }), 1)).toEqual({
      autoPlanStatus: 'NEEDS_REVIEW',
      includeChildren: true,
    });
    expect(toSelectionSearchParams(new URLSearchParams('autoPlan=DONE&page=2'), 7).toString()).toBe(
      'autoPlan=DONE&page=2&sel=7',
    );
  });

  it('clears selection for filters and preserves canonical filters and page for selection only', () => {
    expect(toSearchParams(filters({ q: 'SYNTH' }), 2).has('sel')).toBe(false);
    expect(
      toSelectionSearchParams(
        new URLSearchParams('q=%20SYNTH%20&plant=0012&page=003&sel=bad'),
        7,
      ).toString(),
    ).toBe('q=SYNTH&plant=12&page=3&sel=7');
    expect(
      toSelectionSearchParams(new URLSearchParams('q=SYNTH&page=3&sel=7'), null).toString(),
    ).toBe('q=SYNTH&page=3');
  });
});
