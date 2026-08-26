import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import type { WorkOrderReleaseFact } from './queries';
import {
  toWorkOrderReleaseSummaryView,
  type ReleaseSummaryList,
  type ReleaseSummaryQuery,
  type WorkOrderReleaseSummarySources,
} from './work-order-release-summary-view';

const values = messages.productionOrder.values;
const query = <T>(data: T | undefined): ReleaseSummaryQuery<T> => ({
  data,
  isError: false,
  isPending: false,
});
const list = <T>(items: T[], truncated = false): ReleaseSummaryList<T> =>
  query({ items, truncated });
const detail = (overrides: Partial<WorkOrderReleaseFact> = {}): WorkOrderReleaseFact => ({
  workOrderId: 701,
  workOrderNo: 'SYN-WO-701',
  productionPlanId: 501,
  routingOperationId: 601,
  itemId: 910001,
  orderQty: 12.5,
  uomId: 920001,
  workOrderTypeCode: 'SYN-NORMAL',
  priorityNo: 2,
  statusCode: 'SYN-READY',
  productionLineId: 301,
  responsibleWorkerId: null,
  plannedStartAt: '2026-08-26T09:00:00+09:00',
  plannedEndAt: '2026-08-26T18:00:00+09:00',
  plannedEquipmentId: 401,
  plannedMoldId: 501,
  plannedShiftId: 601,
  remarks: null,
  defaultWipLocationId: 1,
  defaultFgLocationId: 2,
  defaultScrapLocationId: 3,
  operationSettingsSnapshot: null,
  releasedAt: null,
  ...overrides,
});
const sources = (): WorkOrderReleaseSummarySources => ({
  itemNames: [{ itemId: 910001, status: 'named', label: 'ITEM-A · Synthetic Item' }],
  uoms: {
    entries: [{ value: '920001', label: 'EA · Each' }],
    isLoading: false,
    isError: false,
    truncated: false,
  },
  plan: query({ productionPlanId: 501, productionOrderId: 201, routingId: 101 }),
  productionOrder: query({ productionOrderId: 201, plantId: 101 }),
  routing: query({ routing: { routingId: 101, routingCode: 'RT-A', routingVersion: 3 } }),
  operations: query({
    items: [
      { routingOperationId: 999, operationName: 'Foreign Operation' },
      { routingOperationId: 601, operationName: 'Synthetic Operation' },
    ],
  }),
  productionLines: list([
    { productionLineId: 301, lineCode: 'LINE-A', lineName: 'Synthetic Line' },
  ]),
  equipments: list([
    { equipmentId: 401, equipmentCode: 'EQ-A', equipmentName: 'Synthetic Equipment' },
  ]),
  molds: list([{ moldId: 501, moldCode: 'MOLD-A', moldName: 'Synthetic Mold' }]),
  shifts: list([{ shiftId: 601, shiftCode: 'SHIFT-A', shiftName: 'Synthetic Shift' }]),
});

describe('work-order release summary view', () => {
  it('projects all nine display pairs with exact reference labels without mutation', () => {
    const selected = detail();
    const refs = sources();
    const snapshot = structuredClone({ selected, refs });

    expect(toWorkOrderReleaseSummaryView(selected, refs)).toEqual({
      workOrderNo: 'SYN-WO-701',
      itemLabel: 'ITEM-A · Synthetic Item',
      quantityLabel: '12.5 EA · Each',
      operationLabel: 'Synthetic Operation',
      routingRevisionLabel: 'RT-A · Rev 3',
      productionLineLabel: 'LINE-A · Synthetic Line',
      equipmentLabel: 'EQ-A · Synthetic Equipment',
      moldLabel: 'MOLD-A · Synthetic Mold',
      shiftLabel: 'SHIFT-A · Synthetic Shift',
      plannedPeriodLabel: '2026-08-26T09:00:00+09:00 ~ 2026-08-26T18:00:00+09:00',
    });
    expect({ selected, refs }).toEqual(snapshot);
  });

  it('gives parent error priority and never falls back to raw reference IDs', () => {
    const refs = sources();
    refs.itemNames = [{ itemId: 910001, status: 'failed', label: null }];
    refs.uoms = { ...refs.uoms, entries: [], truncated: true };
    refs.plan = { ...refs.plan, isError: true };
    refs.productionOrder = { ...refs.productionOrder, isPending: true };

    const view = toWorkOrderReleaseSummaryView(detail(), refs);

    expect(view.itemLabel).toBe(values.itemFailed);
    expect(view.quantityLabel).toBe(`12.5 ${values.referenceTruncated}`);
    expect(view.operationLabel).toBe(values.referenceFailed);
    expect(view.routingRevisionLabel).toBe(values.referenceFailed);
    expect(view.productionLineLabel).toBe(values.referenceFailed);
    expect(view.equipmentLabel).toBe(values.referenceFailed);
    expect(view.moldLabel).toBe(values.referenceFailed);
    expect(view.shiftLabel).toBe(values.referenceFailed);
    expect(JSON.stringify(view)).not.toMatch(/910001|920001|301|401|501|601/);
  });

  it('distinguishes list loading, failure, truncation, and complete unknown states', () => {
    const refs = sources();
    refs.productionLines = { ...refs.productionLines, isPending: true };
    refs.equipments = { ...refs.equipments, isError: true };
    refs.molds = list([], true);
    refs.shifts = list([]);

    expect(toWorkOrderReleaseSummaryView(detail(), refs)).toMatchObject({
      productionLineLabel: values.referenceLoading,
      equipmentLabel: values.referenceFailed,
      moldLabel: values.referenceTruncated,
      shiftLabel: values.referenceUnknown,
    });
  });

  it('rejects a mismatched plan without cross-selection labels', () => {
    const refs = sources();
    refs.plan = query({ productionPlanId: 999, productionOrderId: 999, routingId: 999 });

    const view = toWorkOrderReleaseSummaryView(detail(), refs);

    expect(view.operationLabel).toBe(values.referenceUnknown);
    expect(view.routingRevisionLabel).toBe(values.referenceUnknown);
    expect(view.productionLineLabel).toBe(values.referenceUnknown);
    expect(view.equipmentLabel).toBe(values.referenceUnknown);
  });

  it('rejects a foreign P/O while the selected plan remains exact', () => {
    const refs = sources();
    refs.productionOrder = query({ productionOrderId: 999, plantId: 999 });

    const view = toWorkOrderReleaseSummaryView(detail(), refs);

    expect(view.productionLineLabel).toBe(values.referenceUnknown);
    expect(view.equipmentLabel).toBe(values.referenceUnknown);
    expect(view.moldLabel).toBe(values.referenceUnknown);
    expect(view.shiftLabel).toBe(values.referenceUnknown);
  });

  it('rejects a foreign routing header while preserving the exact operation lookup', () => {
    const refs = sources();
    refs.routing = query({
      routing: { routingId: 999, routingCode: 'FOREIGN', routingVersion: 99 },
    });

    const view = toWorkOrderReleaseSummaryView(detail(), refs);

    expect(view.routingRevisionLabel).toBe(values.referenceUnknown);
    expect(view.operationLabel).toBe('Synthetic Operation');
    expect(JSON.stringify(view)).not.toContain('Foreign Operation');
  });

  it('does not fall back to a foreign operation when the exact operation is absent', () => {
    const refs = sources();
    refs.operations = query({
      items: [{ routingOperationId: 999, operationName: 'Foreign Operation' }],
    });

    const view = toWorkOrderReleaseSummaryView(detail(), refs);

    expect(view.operationLabel).toBe(values.referenceUnknown);
    expect(JSON.stringify(view)).not.toContain('Foreign Operation');
  });

  it('keeps absent optional resource IDs null ahead of parent and list failures', () => {
    const refs = sources();
    refs.plan = { ...refs.plan, isError: true };
    refs.productionLines = { data: undefined, isError: true, isPending: true };

    expect(
      toWorkOrderReleaseSummaryView(
        detail({
          productionLineId: null,
          plannedEquipmentId: null,
          plannedMoldId: null,
          plannedShiftId: null,
        }),
        refs,
      ),
    ).toMatchObject({
      productionLineLabel: null,
      equipmentLabel: null,
      moldLabel: null,
      shiftLabel: null,
    });
  });

  it.each([
    [null, null, null],
    ['2026-08-26', null, '2026-08-26'],
    [null, '2026-08-27', '2026-08-27'],
  ])('projects partial planned period %s to %s', (from, to, expected) => {
    expect(
      toWorkOrderReleaseSummaryView(detail({ plannedStartAt: from, plannedEndAt: to }), sources())
        .plannedPeriodLabel,
    ).toBe(expected);
  });
});
