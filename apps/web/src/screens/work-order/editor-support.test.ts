import { describe, expect, it } from 'vitest';

import type { WorkOrderFact } from './queries';
import {
  canApplyWorkOrderReload,
  isExactWorkOrderDetail,
  mergeWorkOrderAssignmentFieldErrors,
  toOwnedResourceLookup,
} from './editor-support';

const workOrder = (workOrderId: number): WorkOrderFact => ({ workOrderId }) as WorkOrderFact;

describe('work-order editor support', () => {
  it('maps only owned server fields and gives current client validation priority', () => {
    expect(
      mergeWorkOrderAssignmentFieldErrors(
        { productionLineId: 'client line', priorityNo: 'client priority' },
        {
          productionLineId: 'server line',
          plannedStartAt: 'server start',
          plannedEndAt: 'server end',
          priorityNo: 'server priority',
          orderQty: 'not owned',
        },
      ),
    ).toEqual({
      productionLineId: 'client line',
      plannedStartAtLocal: 'server start',
      plannedEndAtLocal: 'server end',
      priorityNo: 'client priority',
    });
  });

  it('maps exact-plant resources and preserves caller entry facts', () => {
    expect(
      toOwnedResourceLookup(
        {
          items: [{ plantId: 501, id: 701, name: 'Synthetic resource' }],
          plantId: 501,
          isPending: false,
          isError: false,
        },
        (item) => ({ value: String(item.id), label: item.name, isActive: false }),
      ),
    ).toEqual({
      entries: [{ value: '701', label: 'Synthetic resource', isActive: false }],
      isLoading: false,
      isError: false,
    });
  });

  it.each([
    ['mixed owner', [{ plantId: 501 }, { plantId: 999 }], false],
    ['HTTP failure with stale data', [{ plantId: 501 }], true],
  ] as const)('fails closed for %s', (_name, items, isError) => {
    expect(
      toOwnedResourceLookup({ items, plantId: 501, isPending: false, isError }, (_item) => ({
        value: '701',
        label: 'must not escape',
        isActive: true,
      })),
    ).toEqual({ entries: [], isLoading: false, isError: true });
  });

  it('keeps a null-plant lookup idle without treating it as an owner error', () => {
    expect(
      toOwnedResourceLookup(
        { items: [], plantId: null, isPending: true, isError: false },
        (_item) => ({ value: '', label: '', isActive: true }),
      ),
    ).toEqual({ entries: [], isLoading: false, isError: false });
  });

  it('accepts only exact details and only a successful exact conflict reload', () => {
    expect(isExactWorkOrderDetail(701, workOrder(701))).toBe(true);
    expect(isExactWorkOrderDetail(701, workOrder(999))).toBe(false);
    expect(isExactWorkOrderDetail(701, undefined)).toBe(false);
    expect(canApplyWorkOrderReload(701, { isSuccess: true, data: workOrder(701) })).toBe(true);
    expect(canApplyWorkOrderReload(701, { isSuccess: false, data: workOrder(701) })).toBe(false);
    expect(canApplyWorkOrderReload(701, { isSuccess: true, data: workOrder(999) })).toBe(false);
  });
});
