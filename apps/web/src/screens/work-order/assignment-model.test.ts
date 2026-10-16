import { describe, expect, it } from 'vitest';

import type { WorkOrderFact } from './queries';
import type { WorkOrderShiftFact } from './resource-queries';
import {
  isWorkOrderAssignmentSaveEnabled,
  plannedWindowLocal,
  REQUIRED_ASSIGNMENT_FIELDS,
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
  plannedStartAt: '2026-08-23T09:45:00+07:00',
  plannedEndAt: '2026-08-23T10:45:00+07:00',
  plannedEquipmentId: 903,
  plannedMoldId: 904,
  plannedShiftId: 905,
  defaultWipLocationId: 906,
  defaultFgLocationId: 907,
  defaultScrapLocationId: 908,
  remarks: 'Synthetic remarks',
  ...overrides,
});

const validDraft = (
  overrides: Partial<WorkOrderAssignmentDraft> = {},
): WorkOrderAssignmentDraft => ({
  /* 생산 라인과 기본 위치 셋은 저장 필수다 — 유효한 초안은 넷을 모두 채운다. */
  productionLineId: '901',
  responsibleWorkerId: '',
  plannedEquipmentId: '',
  plannedMoldId: '',
  plannedShiftId: '',
  defaultWipLocationId: '911',
  defaultFgLocationId: '912',
  defaultScrapLocationId: '913',
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
      defaultWipLocationId: '906',
      defaultFgLocationId: '907',
      defaultScrapLocationId: '908',
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
          defaultWipLocationId: null,
          defaultFgLocationId: null,
          defaultScrapLocationId: null,
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
      defaultWipLocationId: '',
      defaultFgLocationId: '',
      defaultScrapLocationId: '',
      plannedStartAtLocal: '',
      plannedEndAtLocal: '',
      priorityNo: '0',
    });
  });

  it('names every required field and the priority for an empty draft', () => {
    expect(
      validateWorkOrderAssignmentDraft({
        productionLineId: ' ',
        responsibleWorkerId: '',
        plannedEquipmentId: '\t',
        plannedMoldId: '',
        plannedShiftId: '',
        defaultWipLocationId: '',
        defaultFgLocationId: '',
        defaultScrapLocationId: '',
        plannedStartAtLocal: '',
        plannedEndAtLocal: '',
        priorityNo: '',
      }),
    ).toEqual({
      fieldErrors: {
        productionLineId: 'REQUIRED',
        defaultWipLocationId: 'REQUIRED',
        defaultFgLocationId: 'REQUIRED',
        defaultScrapLocationId: 'REQUIRED',
        priorityNo: 'REQUIRED',
      },
      formError: 'ASSIGNMENT_REQUIRED',
    });
  });

  it('hydrates a UTC response into plant-time input values whatever the browser time zone is', () => {
    expect(
      workOrderAssignmentDraftFrom(workOrderFact({ plannedStartAt: '2026-09-12T01:00:00Z' }))
        .plannedStartAtLocal,
    ).toBe('2026-09-12T08:00');
  });

  it('sends plant-time inputs with the plant offset so a location-only save preserves the instant', () => {
    const draft = workOrderAssignmentDraftFrom(
      workOrderFact({
        plannedStartAt: '2026-09-12T01:00:00Z',
        plannedEndAt: '2026-09-13T01:00:00Z',
      }),
    );
    const body = toWorkOrderAssignmentUpdate({ ...validDraft(), ...draft, priorityNo: '2' });

    expect(body).toMatchObject({
      plannedStartAt: '2026-09-12T08:00:00+07:00',
      plannedEndAt: '2026-09-13T08:00:00+07:00',
    });
  });

  it.each([
    'productionLineId',
    'responsibleWorkerId',
    'plannedEquipmentId',
    'plannedMoldId',
    'plannedShiftId',
    'defaultWipLocationId',
    'defaultFgLocationId',
    'defaultScrapLocationId',
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
  ] as const)('enables save once the required four are set: %s', (field) => {
    const draft = validDraft({
      responsibleWorkerId: '',
      plannedEquipmentId: '',
      plannedMoldId: '',
      plannedShiftId: '',
      [field]: '910',
    });

    expect(isWorkOrderAssignmentSaveEnabled(draft)).toBe(true);
  });

  it.each(REQUIRED_ASSIGNMENT_FIELDS)('disables save while %s is empty', (field) => {
    expect(isWorkOrderAssignmentSaveEnabled(validDraft({ [field]: '' }))).toBe(false);
    expect(validateWorkOrderAssignmentDraft(validDraft({ [field]: ' ' })).fieldErrors).toEqual({
      [field]: 'REQUIRED',
    });
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

  it('makes the exact generated update body with explicit nullable assignments and plant offset', () => {
    expect(
      toWorkOrderAssignmentUpdate(
        validDraft({
          productionLineId: ' 901 ',
          responsibleWorkerId: '902',
          plannedEquipmentId: '903',
          plannedMoldId: '904',
          plannedShiftId: '905',
          defaultWipLocationId: ' 906 ',
          defaultFgLocationId: '907',
          defaultScrapLocationId: '908',
          priorityNo: ' 7 ',
        }),
      ),
    ).toEqual({
      productionLineId: 901,
      responsibleWorkerId: 902,
      plannedEquipmentId: 903,
      plannedMoldId: 904,
      plannedShiftId: 905,
      defaultWipLocationId: 906,
      defaultFgLocationId: 907,
      defaultScrapLocationId: 908,
      plannedStartAt: '2026-08-23T09:45:00+07:00',
      plannedEndAt: '2026-08-23T10:45:00+07:00',
      priorityNo: 7,
    });
  });

  it('sends every cleared owned field as null and omits fields this screen does not own', () => {
    const body = toWorkOrderAssignmentUpdate(
      validDraft({
        responsibleWorkerId: '',
        plannedEquipmentId: '903',
        plannedMoldId: '',
        plannedShiftId: '',
        plannedStartAtLocal: '',
        plannedEndAtLocal: '',
      }),
    );

    expect(body).toEqual({
      productionLineId: 901,
      responsibleWorkerId: null,
      plannedEquipmentId: 903,
      plannedMoldId: null,
      plannedShiftId: null,
      defaultWipLocationId: 911,
      defaultFgLocationId: 912,
      defaultScrapLocationId: 913,
      plannedStartAt: null,
      plannedEndAt: null,
      priorityNo: 2,
    });
    expect(body).not.toHaveProperty('remarks');
    expect(body).not.toHaveProperty('orderQty');
  });

  it('fails closed instead of making a request body from an invalid draft', () => {
    expect(toWorkOrderAssignmentUpdate(validDraft({ priorityNo: '1.5' }))).toBeNull();
    expect(
      toWorkOrderAssignmentUpdate(
        validDraft({
          productionLineId: '',
          responsibleWorkerId: '',
          plannedEquipmentId: '',
          plannedMoldId: '',
          plannedShiftId: '',
        }),
      ),
    ).toBeNull();
  });

  describe('plannedWindowLocal — 계획일 + 교대 → 계획 시각(공장 시각)', () => {
    const shift = (
      shiftId: number,
      startTime: string,
      endTime: string,
      crossesMidnight = false,
      isActive = true,
    ): WorkOrderShiftFact => ({
      shiftId,
      plantId: 3,
      shiftCode: `S${String(shiftId)}`,
      shiftName: `교대${String(shiftId)}`,
      startTime,
      endTime,
      crossesMidnight,
      isActive,
    });
    const shifts = [
      shift(1, '07:00:00', '19:00:00'),
      shift(2, '19:00:00', '07:00:00', true),
      shift(9, '05:00:00', '13:00:00', false, false),
    ];

    it('주간을 고르면 그날 교대 시각이다', () => {
      expect(plannedWindowLocal('2026-10-20', '1', shifts)).toEqual({
        plannedStartAtLocal: '2026-10-20T07:00',
        plannedEndAtLocal: '2026-10-20T19:00',
      });
    });

    it('자정을 넘기는 야간은 다음 날 끝난다', () => {
      expect(plannedWindowLocal('2026-10-20', '2', shifts)).toEqual({
        plannedStartAtLocal: '2026-10-20T19:00',
        plannedEndAtLocal: '2026-10-21T07:00',
      });
    });

    it('교대를 비우면 근무일 하루 — 가장 이른 «활성» 교대 시작부터 24시간이다', () => {
      expect(plannedWindowLocal('2026-10-31', '', shifts)).toEqual({
        plannedStartAtLocal: '2026-10-31T07:00',
        plannedEndAtLocal: '2026-11-01T07:00',
      });
    });

    it('교대가 하나도 없으면 08:00 부터 24시간이다', () => {
      expect(plannedWindowLocal('2026-12-31', '', [])).toEqual({
        plannedStartAtLocal: '2026-12-31T08:00',
        plannedEndAtLocal: '2027-01-01T08:00',
      });
    });
  });
});
