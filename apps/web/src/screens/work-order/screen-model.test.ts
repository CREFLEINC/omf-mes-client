import { describe, expect, it } from 'vitest';

import type { WorkOrderAssignmentDraft } from './assignment-model';
import type { WorkOrderFact, WorkOrderValidationReport } from './queries';
import {
  readWorkOrderProductionPlanId,
  toWorkOrderScreenRow,
  workOrderDraftEquals,
  workOrderFieldErrorMessage,
} from './screen-model';

const fact = (overrides: Partial<WorkOrderFact> = {}): WorkOrderFact => ({
  workOrderId: 701,
  workOrderNo: 'SYN-WO-701',
  productionPlanId: 501,
  routingOperationId: 601,
  itemId: 801,
  orderQty: 1234.56789,
  uomId: 901,
  workOrderTypeCode: 'SYN_NORMAL',
  priorityNo: 2,
  statusCode: 'SYN_DRAFT',
  productionLineId: 101,
  responsibleWorkerId: 201,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: 301,
  plannedMoldId: null,
  plannedShiftId: 501,
  remarks: null,
  ...overrides,
});

const draft = (priorityNo = '2'): WorkOrderAssignmentDraft => ({
  productionLineId: '101',
  responsibleWorkerId: '201',
  plannedEquipmentId: '301',
  plannedMoldId: '',
  plannedShiftId: '501',
  plannedStartAtLocal: '',
  plannedEndAtLocal: '',
  priorityNo,
});

const report = (passed: boolean, severity?: 'BLOCK' | 'WARN'): WorkOrderValidationReport => ({
  passed,
  findings:
    severity === undefined
      ? []
      : [{ severity, field: null, code: 'SYN', message: 'Synthetic finding' }],
});

describe('work-order screen model', () => {
  it.each([
    ['', null],
    ['?productionPlanId=', null],
    ['?productionPlanId=0', null],
    ['?productionPlanId=1.5', null],
    ['?productionPlanId=9007199254740992', null],
    ['?productionPlanId=501', 501],
  ])('reads an exact positive safe productionPlanId from %s', (search, expected) => {
    expect(readWorkOrderProductionPlanId(new URLSearchParams(search))).toBe(expected);
  });

  it('compares every owned draft field without object identity', () => {
    expect(workOrderDraftEquals(draft(), { ...draft() })).toBe(true);
    expect(workOrderDraftEquals(draft(), draft('3'))).toBe(false);
  });

  it.each([
    ['REQUIRED', '필수 입력입니다.'],
    ['INVALID_SELECTION', '선택값을 확인하세요.'],
    ['INVALID_INTEGER', '정수를 입력하세요.'],
    ['INVALID_DATE_TIME', '날짜와 시각을 확인하세요.'],
    ['END_BEFORE_START', '계획 종료는 시작보다 빠를 수 없습니다.'],
  ] as const)('maps %s to a user-facing field error', (code, expected) => {
    expect(workOrderFieldErrorMessage(code)).toBe(expected);
  });

  it('prepares exact list display facts without leaking internal reference IDs', () => {
    expect(
      toWorkOrderScreenRow(fact(), {
        operationLabel: '10. 절단',
        uomLabel: 'EA',
        priorityText: '7',
        priorityError: undefined,
      }),
    ).toEqual({
      workOrderId: 701,
      workOrderNo: 'SYN-WO-701',
      operationLabel: '10. 절단',
      quantityLabel: '1,234.56789 EA',
      priorityText: '7',
      priorityError: undefined,
      assignmentLabel: '4/5',
      validationLabel: '선택 후 확인',
      validationTone: 'idle',
    });
  });

  it.each([
    ['failed query', report(true), true, '검증 조회 실패', 'error'],
    ['passed=false', report(false), false, '검증 차단', 'error'],
    ['BLOCK', report(true, 'BLOCK'), false, '검증 차단', 'error'],
    ['WARN', report(true, 'WARN'), false, '검증 경고', 'warning'],
    ['passed', report(true), false, '검증 통과', 'success'],
  ] as const)(
    'uses defensive selected validation presentation for %s',
    (_name, value, failed, label, tone) => {
      expect(
        toWorkOrderScreenRow(fact(), {
          operationLabel: null,
          uomLabel: 'EA',
          priorityText: '2',
          priorityError: 'Synthetic priority error',
          validationFailed: failed,
          validationReport: value,
        }),
      ).toMatchObject({ validationLabel: label, validationTone: tone });
    },
  );
});
