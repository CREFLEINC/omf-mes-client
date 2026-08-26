import { describe, expect, it, vi } from 'vitest';

import type { WorkOrderFact } from './queries';
import {
  isWorkOrderAssignmentSaveEnabled,
  toWorkOrderAssignmentUpdate,
  validateWorkOrderAssignmentDraft,
  workOrderAssignmentDraftFrom,
  type WorkOrderAssignmentDraft,
} from './assignment-model';

const workOrderFact = (overrides: Partial<WorkOrderFact> = {}): WorkOrderFact => ({
  workOrderId: 702,
  workOrderNo: 'SYN-WO-702',
  productionPlanId: 501,
  routingOperationId: 601,
  itemId: 701,
  orderQty: 12.5,
  uomId: 801,
  workOrderTypeCode: 'SYN_NORMAL',
  priorityNo: 2,
  statusCode: 'SYN_RELEASED',
  productionLineId: 901,
  responsibleWorkerId: 902,
  plannedStartAt: '2026-08-23T09:45:00+09:00',
  plannedEndAt: '2026-08-23T10:45:00+09:00',
  plannedEquipmentId: 903,
  plannedMoldId: 904,
  plannedShiftId: 905,
  remarks: 'Synthetic remarks',
  ...overrides,
});

const validDraft = (
  overrides: Partial<WorkOrderAssignmentDraft> = {},
): WorkOrderAssignmentDraft => ({
  productionLineId: '901',
  responsibleWorkerId: '',
  plannedEquipmentId: '',
  plannedMoldId: '',
  plannedShiftId: '',
  plannedStartAtLocal: '2026-08-23T09:45',
  plannedEndAtLocal: '2026-08-23T10:45',
  priorityNo: '2',
  ...overrides,
});

describe('work-order assignment model', () => {
  it('moves complete and null facts to the exact owned draft shape', () => {
    expect(workOrderAssignmentDraftFrom(workOrderFact())).toEqual({
      productionLineId: '901',
      responsibleWorkerId: '902',
      plannedEquipmentId: '903',
      plannedMoldId: '904',
      plannedShiftId: '905',
      plannedStartAtLocal: '2026-08-23T09:45',
      plannedEndAtLocal: '2026-08-23T10:45',
      priorityNo: '2',
    });
    expect(
      workOrderAssignmentDraftFrom(
        workOrderFact({
          productionLineId: null,
          responsibleWorkerId: null,
          plannedEquipmentId: null,
          plannedMoldId: null,
          plannedShiftId: null,
          plannedStartAt: null,
          plannedEndAt: null,
          priorityNo: 0,
        }),
      ),
    ).toEqual({
      productionLineId: '',
      responsibleWorkerId: '',
      plannedEquipmentId: '',
      plannedMoldId: '',
      plannedShiftId: '',
      plannedStartAtLocal: '',
      plannedEndAtLocal: '',
      priorityNo: '0',
    });
  });

  it('reports priority and assignment independently for an empty draft without requiring resources', () => {
    expect(
      validateWorkOrderAssignmentDraft({
        productionLineId: ' ',
        responsibleWorkerId: '',
        plannedEquipmentId: '\t',
        plannedMoldId: '',
        plannedShiftId: '',
        plannedStartAtLocal: '',
        plannedEndAtLocal: '',
        priorityNo: '',
      }),
    ).toEqual({ fieldErrors: { priorityNo: 'REQUIRED' }, formError: 'ASSIGNMENT_REQUIRED' });
  });

  it.each([
    'productionLineId',
    'responsibleWorkerId',
    'plannedEquipmentId',
    'plannedMoldId',
    'plannedShiftId',
  ] as const)(
    'rejects each invalid resource selection and accepts a trimmed positive ID: %s',
    (field) => {
      for (const value of ['0', '-1', '1.5', '9007199254740992', 'not-a-number']) {
        expect(validateWorkOrderAssignmentDraft(validDraft({ [field]: value }))).toEqual({
          fieldErrors: { [field]: 'INVALID_SELECTION' },
          formError: null,
        });
      }

      expect(validateWorkOrderAssignmentDraft(validDraft({ [field]: ' 910 ' }))).toEqual({
        fieldErrors: {},
        formError: null,
      });
    },
  );

  it('requires a finite safe integer priority without inventing positive or range rules', () => {
    expect(validateWorkOrderAssignmentDraft(validDraft({ priorityNo: ' ' }))).toEqual({
      fieldErrors: { priorityNo: 'REQUIRED' },
      formError: null,
    });
    for (const value of ['1.5', 'Infinity', '9007199254740992']) {
      expect(validateWorkOrderAssignmentDraft(validDraft({ priorityNo: value }))).toEqual({
        fieldErrors: { priorityNo: 'INVALID_INTEGER' },
        formError: null,
      });
    }
    expect(validateWorkOrderAssignmentDraft(validDraft({ priorityNo: '0' }))).toEqual({
      fieldErrors: {},
      formError: null,
    });
    expect(validateWorkOrderAssignmentDraft(validDraft({ priorityNo: '-2' }))).toEqual({
      fieldErrors: {},
      formError: null,
    });
  });

  it.each(['2026-8-23T09:45', '2026-02-30T09:45', '2026-08-23T24:00', '2026-08-23T09:60'])(
    'rejects an invalid planned local date-time: %s',
    (value) => {
      expect(validateWorkOrderAssignmentDraft(validDraft({ plannedStartAtLocal: value }))).toEqual({
        fieldErrors: { plannedStartAtLocal: 'INVALID_DATE_TIME' },
        formError: null,
      });
    },
  );

  it('rejects an end before start, accepts equal time, and leaves one-side time optional', () => {
    expect(
      validateWorkOrderAssignmentDraft(
        validDraft({
          plannedStartAtLocal: '2026-08-23T10:45',
          plannedEndAtLocal: '2026-08-23T09:45',
        }),
      ),
    ).toEqual({ fieldErrors: { plannedEndAtLocal: 'END_BEFORE_START' }, formError: null });
    expect(
      validateWorkOrderAssignmentDraft(
        validDraft({
          plannedStartAtLocal: '2026-08-23T09:45',
          plannedEndAtLocal: '2026-08-23T09:45',
        }),
      ),
    ).toEqual({ fieldErrors: {}, formError: null });
    expect(
      validateWorkOrderAssignmentDraft(
        validDraft({ plannedStartAtLocal: '', plannedEndAtLocal: '2026-08-23T09:45' }),
      ),
    ).toEqual({ fieldErrors: {}, formError: null });
    expect(
      validateWorkOrderAssignmentDraft(
        validDraft({ plannedStartAtLocal: '2026-08-23T09:45', plannedEndAtLocal: '' }),
      ),
    ).toEqual({ fieldErrors: {}, formError: null });
  });

  it.each([
    'productionLineId',
    'responsibleWorkerId',
    'plannedEquipmentId',
    'plannedMoldId',
    'plannedShiftId',
  ] as const)('enables save for one valid resource and priority: %s', (field) => {
    const resourceOnlyDraft = validDraft({
      productionLineId: '',
      responsibleWorkerId: '',
      plannedEquipmentId: '',
      plannedMoldId: '',
      plannedShiftId: '',
      [field]: '910',
    });

    expect(isWorkOrderAssignmentSaveEnabled(resourceOnlyDraft)).toBe(true);
  });

  it('disables save for field or assignment errors', () => {
    expect(isWorkOrderAssignmentSaveEnabled(validDraft({ priorityNo: '1.5' }))).toBe(false);
    expect(
      isWorkOrderAssignmentSaveEnabled(
        validDraft({
          productionLineId: '',
          responsibleWorkerId: '',
          plannedEquipmentId: '',
          plannedMoldId: '',
          plannedShiftId: '',
        }),
      ),
    ).toBe(false);
  });

  it('makes the exact generated update body with explicit nullable assignments and local offset', () => {
    const at = new Date('2026-08-26T12:00:00Z');
    vi.spyOn(at, 'getTimezoneOffset').mockReturnValue(-540);

    expect(
      toWorkOrderAssignmentUpdate(
        validDraft({
          productionLineId: ' 901 ',
          responsibleWorkerId: '902',
          plannedEquipmentId: '903',
          plannedMoldId: '904',
          plannedShiftId: '905',
          priorityNo: ' 7 ',
        }),
        at,
      ),
    ).toEqual({
      productionLineId: 901,
      responsibleWorkerId: 902,
      plannedEquipmentId: 903,
      plannedMoldId: 904,
      plannedShiftId: 905,
      plannedStartAt: '2026-08-23T09:45:00+09:00',
      plannedEndAt: '2026-08-23T10:45:00+09:00',
      priorityNo: 7,
    });
  });

  it('sends every cleared owned field as null and omits fields this screen does not own', () => {
    const at = new Date('2026-08-26T12:00:00Z');
    vi.spyOn(at, 'getTimezoneOffset').mockReturnValue(330);

    const body = toWorkOrderAssignmentUpdate(
      validDraft({
        productionLineId: '',
        responsibleWorkerId: '',
        plannedEquipmentId: '903',
        plannedMoldId: '',
        plannedShiftId: '',
        plannedStartAtLocal: '',
        plannedEndAtLocal: '',
      }),
      at,
    );

    expect(body).toEqual({
      productionLineId: null,
      responsibleWorkerId: null,
      plannedEquipmentId: 903,
      plannedMoldId: null,
      plannedShiftId: null,
      plannedStartAt: null,
      plannedEndAt: null,
      priorityNo: 2,
    });
    expect(body).not.toHaveProperty('remarks');
    expect(body).not.toHaveProperty('orderQty');
  });

  it('fails closed instead of making a request body from an invalid draft', () => {
    const at = new Date('2026-08-26T12:00:00Z');

    expect(toWorkOrderAssignmentUpdate(validDraft({ priorityNo: '1.5' }), at)).toBeNull();
    expect(
      toWorkOrderAssignmentUpdate(
        validDraft({
          productionLineId: '',
          responsibleWorkerId: '',
          plannedEquipmentId: '',
          plannedMoldId: '',
          plannedShiftId: '',
        }),
        at,
      ),
    ).toBeNull();
  });
});
