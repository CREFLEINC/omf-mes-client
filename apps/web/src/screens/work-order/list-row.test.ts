import { describe, expect, it } from 'vitest';

import { toWorkOrderListRow, type WorkOrderListPresentation } from './list-row';
import type { WorkOrderFact } from './queries';

const fact = (overrides: Partial<WorkOrderFact> = {}): WorkOrderFact => ({
  workOrderId: 901,
  workOrderNo: 'SYN-WO-ALPHA',
  productionPlanId: 110,
  routingOperationId: 120,
  itemId: 130,
  orderQty: 12.5,
  uomId: 140,
  workOrderTypeCode: 'SYN-TYPE',
  priorityNo: 2,
  statusCode: 'SYN-STATUS',
  productionLineId: 150,
  responsibleWorkerId: 160,
  plannedStartAt: '2026-08-20T09:00:00Z',
  plannedEndAt: '2026-08-20T10:00:00Z',
  plannedEquipmentId: 170,
  plannedMoldId: 180,
  plannedShiftId: 190,
  remarks: 'SYN-REMARKS',
  ...overrides,
});

const presentation = (
  overrides: Partial<WorkOrderListPresentation> = {},
): WorkOrderListPresentation => ({
  operationLabel: 'SYN-OP-01 · 합성 공정',
  quantityLabel: '12.5 SYN-EA',
  priorityText: '2',
  priorityError: undefined,
  assignmentLabel: 'SYN-ASSIGNED',
  validationLabel: 'SYN-READY',
  validationTone: 'success',
  ...overrides,
});

describe('toWorkOrderListRow', () => {
  it('copies only stable W/O identity and caller-prepared presentation fields', () => {
    const row = toWorkOrderListRow(fact(), presentation());

    expect(row).toEqual({
      workOrderId: 901,
      workOrderNo: 'SYN-WO-ALPHA',
      operationLabel: 'SYN-OP-01 · 합성 공정',
      quantityLabel: '12.5 SYN-EA',
      priorityText: '2',
      priorityError: undefined,
      assignmentLabel: 'SYN-ASSIGNED',
      validationLabel: 'SYN-READY',
      validationTone: 'success',
    });
  });

  it('does not leak internal contract facts into the Table row', () => {
    const row = toWorkOrderListRow(fact(), presentation());

    expect(Object.keys(row).sort()).toEqual([
      'assignmentLabel',
      'operationLabel',
      'priorityError',
      'priorityText',
      'quantityLabel',
      'validationLabel',
      'validationTone',
      'workOrderId',
      'workOrderNo',
    ]);
    expect(row).not.toHaveProperty('routingOperationId');
    expect(row).not.toHaveProperty('itemId');
    expect(row).not.toHaveProperty('orderQty');
    expect(row).not.toHaveProperty('uomId');
    expect(row).not.toHaveProperty('productionPlanId');
    expect(row).not.toHaveProperty('priorityNo');
    expect(row).not.toHaveProperty('productionLineId');
    expect(row).not.toHaveProperty('responsibleWorkerId');
    expect(row).not.toHaveProperty('plannedEquipmentId');
    expect(row).not.toHaveProperty('plannedMoldId');
    expect(row).not.toHaveProperty('plannedShiftId');
    expect(row).not.toHaveProperty('remarks');
    expect(row).not.toHaveProperty('statusCode');
    expect(row).not.toHaveProperty('workOrderTypeCode');
    expect(row).not.toHaveProperty('plannedStartAt');
    expect(row).not.toHaveProperty('plannedEndAt');
  });

  it('ignores runtime excess presentation fields and preserves fact identity', () => {
    const prepared = {
      ...presentation(),
      routingOperationId: 777,
      workOrderId: 778,
      workOrderNo: 'SYN-WO-OVERRIDE',
    };
    const row = toWorkOrderListRow(fact(), prepared);

    expect(Object.keys(row).sort()).toEqual([
      'assignmentLabel',
      'operationLabel',
      'priorityError',
      'priorityText',
      'quantityLabel',
      'validationLabel',
      'validationTone',
      'workOrderId',
      'workOrderNo',
    ]);
    expect(row.workOrderId).toBe(901);
    expect(row.workOrderNo).toBe('SYN-WO-ALPHA');
    expect(row).not.toHaveProperty('routingOperationId');
  });

  it.each([null, ''])(
    'preserves a %p operation and raw caller presentation without derivation',
    (operationLabel) => {
      const prepared = presentation({
        operationLabel,
        priorityText: '-',
        priorityError: 'SYN-PRIORITY-ERROR',
        assignmentLabel: 'SYN-ASSIGNMENT-PREPARED',
        validationLabel: 'SYN-VALIDATION-PREPARED',
        validationTone: 'warning',
      });

      expect(toWorkOrderListRow(fact(), prepared)).toMatchObject(prepared);
    },
  );
});
