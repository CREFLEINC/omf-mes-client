import { renderHook } from '@testing-library/react';
import { messages } from '@omf-mes/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkOrderReleaseFact } from './queries';
import { useWorkOrderReleaseSummary } from './use-work-order-release-summary';

const mocks = vi.hoisted(() => ({
  itemNames: vi.fn(),
  uoms: vi.fn(),
  plan: vi.fn(),
  productionOrder: vi.fn(),
  routing: vi.fn(),
  operations: vi.fn(),
  lines: vi.fn(),
  equipments: vi.fn(),
  molds: vi.fn(),
  shifts: vi.fn(),
}));

vi.mock('../production-order/item-lookups', () => ({
  useProductionOrderItemNames: mocks.itemNames,
}));
vi.mock('../production-order/queries', () => ({ useProductionOrderDetail: mocks.productionOrder }));
vi.mock('../production-order/reference-lookups', () => ({
  useUomReferenceLookup: mocks.uoms,
  resolveReference: (source: { entries: { value: string; label: string }[] }, id: number) => ({
    kind: 'named',
    label: source.entries.find((entry) => entry.value === String(id))?.label ?? 'UNKNOWN',
  }),
  describeReference: (reference: { label: string }) => reference.label,
}));
vi.mock('../production-order/screen-model', () => ({
  describeItem: (_id: number, names: Map<number, { label: string | null }>) =>
    names.values().next().value?.label ?? 'UNKNOWN',
}));
vi.mock('../production-plan/queries', () => ({ useProductionPlanDetail: mocks.plan }));
vi.mock('../routing/queries', () => ({
  useRoutingDetail: mocks.routing,
  useRoutingOperations: mocks.operations,
}));
vi.mock('../work-order/people-tool-queries', () => ({ useWorkOrderMolds: mocks.molds }));
vi.mock('../work-order/resource-queries', () => ({
  useWorkOrderProductionLines: mocks.lines,
  useWorkOrderEquipments: mocks.equipments,
  useWorkOrderShifts: mocks.shifts,
}));

const settled = <T>(data: T) => ({ data, isFetching: false, isError: false });
const list = <T>(items: T[]) =>
  settled({ items, truncated: false, page: { page: 1, size: 20, total: items.length } });
const detail = (): WorkOrderReleaseFact => ({
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
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: 401,
  plannedMoldId: 501,
  plannedShiftId: 601,
  remarks: null,
  defaultWipLocationId: 1,
  defaultFgLocationId: 2,
  defaultScrapLocationId: 3,
  operationSettingsSnapshot: null,
  releasedAt: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.itemNames.mockReturnValue({
    items: [{ itemId: 910001, status: 'named', label: 'ITEM-A · Item' }],
    isLoading: false,
  });
  mocks.uoms.mockReturnValue({
    entries: [{ value: '920001', label: 'EA · Each' }],
    isLoading: false,
    isError: false,
    truncated: false,
  });
  mocks.plan.mockReturnValue(
    settled({ productionPlanId: 501, productionOrderId: 201, routingId: 101 }),
  );
  mocks.productionOrder.mockReturnValue(settled({ productionOrderId: 201, plantId: 101 }));
  mocks.routing.mockReturnValue(
    settled({ routing: { routingId: 101, routingCode: 'RT-A', routingVersion: 3 } }),
  );
  mocks.operations.mockReturnValue(
    settled({ items: [{ routingOperationId: 601, operationName: 'Operation A' }] }),
  );
  mocks.lines.mockReturnValue(
    list([{ productionLineId: 301, lineCode: 'LINE-A', lineName: 'Line A' }]),
  );
  mocks.equipments.mockReturnValue(
    list([{ equipmentId: 401, equipmentCode: 'EQ-A', equipmentName: 'Equipment A' }]),
  );
  mocks.molds.mockReturnValue(list([{ moldId: 501, moldCode: 'MOLD-A', moldName: 'Mold A' }]));
  mocks.shifts.mockReturnValue(
    list([{ shiftId: 601, shiftCode: 'SHIFT-A', shiftName: 'Shift A' }]),
  );
});

describe('useWorkOrderReleaseSummary', () => {
  it('chains exact plan, P/O, routing, and plant lookups into the summary model', () => {
    const selected = detail();
    const { result } = renderHook(() => useWorkOrderReleaseSummary(selected));

    expect(mocks.itemNames).toHaveBeenCalledWith([910001]);
    expect(mocks.plan).toHaveBeenCalledWith(501);
    expect(mocks.productionOrder).toHaveBeenCalledWith(201);
    expect(mocks.routing).toHaveBeenCalledWith(101);
    expect(mocks.operations).toHaveBeenCalledWith(101);
    expect(mocks.lines).toHaveBeenCalledWith(101, 1);
    expect(mocks.equipments).toHaveBeenCalledWith(101, 301, 1);
    expect(mocks.molds).toHaveBeenCalledWith(101, 1);
    expect(mocks.shifts).toHaveBeenCalledWith(101, 1);
    expect(result.current).toMatchObject({
      itemLabel: 'ITEM-A · Item',
      routingRevisionLabel: 'RT-A · Rev 3',
      productionLineLabel: 'LINE-A · Line A',
    });
  });

  it('keeps every dependent hook idle without a selected detail', () => {
    const { result } = renderHook(() => useWorkOrderReleaseSummary(null));

    expect(result.current).toBeNull();
    expect(mocks.itemNames).toHaveBeenCalledWith([]);
    expect(mocks.plan).toHaveBeenCalledWith(null);
    expect(mocks.productionOrder).toHaveBeenCalledWith(null);
    expect(mocks.routing).toHaveBeenCalledWith(null);
    expect(mocks.operations).toHaveBeenCalledWith(null);
    expect(mocks.lines).toHaveBeenCalledWith(null, 1);
    expect(mocks.equipments).toHaveBeenCalledWith(null, null, 1);
  });

  it('does not cascade stale plan or P/O facts while they refetch or fail', () => {
    mocks.plan.mockReturnValue({
      ...settled({ productionPlanId: 501, productionOrderId: 201, routingId: 101 }),
      isFetching: true,
    });
    const { rerender } = renderHook(() => useWorkOrderReleaseSummary(detail()));

    expect(mocks.productionOrder).toHaveBeenLastCalledWith(null);
    expect(mocks.routing).toHaveBeenLastCalledWith(null);
    expect(mocks.lines).toHaveBeenLastCalledWith(null, 1);

    mocks.plan.mockReturnValue(
      settled({ productionPlanId: 501, productionOrderId: 201, routingId: 101 }),
    );
    mocks.productionOrder.mockReturnValue({
      ...settled({ productionOrderId: 201, plantId: 101 }),
      isError: true,
    });
    rerender();
    expect(mocks.routing).toHaveBeenLastCalledWith(101);
    expect(mocks.lines).toHaveBeenLastCalledWith(null, 1);
    expect(mocks.molds).toHaveBeenLastCalledWith(null, 1);

    mocks.productionOrder.mockReturnValue({
      ...settled({ productionOrderId: 201, plantId: 101 }),
      isError: false,
      isFetching: true,
    });
    rerender();
    expect(mocks.routing).toHaveBeenLastCalledWith(101);
    expect(mocks.lines).toHaveBeenLastCalledWith(null, 1);

    mocks.plan.mockReturnValue({
      ...settled({ productionPlanId: 501, productionOrderId: 201, routingId: 101 }),
      isError: true,
    });
    mocks.productionOrder.mockReturnValue(settled({ productionOrderId: 201, plantId: 101 }));
    rerender();
    expect(mocks.productionOrder).toHaveBeenLastCalledWith(null);
    expect(mocks.routing).toHaveBeenLastCalledWith(null);
    expect(mocks.lines).toHaveBeenLastCalledWith(null, 1);
  });

  it('does not cascade settled facts that belong to another plan or P/O', () => {
    mocks.plan.mockReturnValue(
      settled({ productionPlanId: 999, productionOrderId: 202, routingId: 102 }),
    );
    const { rerender } = renderHook(() => useWorkOrderReleaseSummary(detail()));

    expect(mocks.productionOrder).toHaveBeenLastCalledWith(null);
    expect(mocks.routing).toHaveBeenLastCalledWith(null);
    expect(mocks.lines).toHaveBeenLastCalledWith(null, 1);

    mocks.plan.mockReturnValue(
      settled({ productionPlanId: 501, productionOrderId: 201, routingId: 101 }),
    );
    mocks.productionOrder.mockReturnValue(settled({ productionOrderId: 999, plantId: 102 }));
    rerender();

    expect(mocks.routing).toHaveBeenLastCalledWith(101);
    expect(mocks.lines).toHaveBeenLastCalledWith(null, 1);
    expect(mocks.equipments).toHaveBeenLastCalledWith(null, 301, 1);
  });

  it('preserves loading and failure states from every downstream lookup', () => {
    mocks.routing.mockReturnValue({ ...mocks.routing(), isFetching: true });
    mocks.operations.mockReturnValue({ ...mocks.operations(), isError: true });
    mocks.lines.mockReturnValue({ ...mocks.lines(), isFetching: true });
    mocks.equipments.mockReturnValue({ ...mocks.equipments(), isError: true });
    mocks.molds.mockReturnValue({ ...mocks.molds(), isFetching: true });
    mocks.shifts.mockReturnValue({ ...mocks.shifts(), isError: true });

    const { result } = renderHook(() => useWorkOrderReleaseSummary(detail()));
    const values = messages.productionOrder.values;

    expect(result.current).toMatchObject({
      routingRevisionLabel: values.referenceLoading,
      operationLabel: values.referenceFailed,
      productionLineLabel: values.referenceLoading,
      equipmentLabel: values.referenceFailed,
      moldLabel: values.referenceLoading,
      shiftLabel: values.referenceFailed,
    });
  });
});
