import { describe, expect, it } from 'vitest';

import type { WorkOrderFact } from './queries';
import {
  isWorkOrderAssignmentSaveEnabled,
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
    expect(isWorkOrderAssignmentSaveEnabled(validDraft({ [field]: '910' }))).toBe(true);
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
});
