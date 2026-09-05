import { describe, expect, it } from 'vitest';

import {
  EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT,
  setWorkOrderCloseRemainderDisposition,
  setWorkOrderCloseRemarks,
  setWorkOrderCloseVarianceReasonCode,
  workOrderCloseReadinessInputFrom,
  type WorkOrderCloseInputDraft,
  type WorkOrderCloseRemainderDisposition,
} from './close-input-draft';
import { workOrderCloseBlockers, type WorkOrderCloseCompletionJudgment } from './close-readiness';

const draft = (overrides: Partial<WorkOrderCloseInputDraft> = {}): WorkOrderCloseInputDraft => ({
  remainderDisposition: null,
  varianceReasonCode: '',
  remarks: '',
  ...overrides,
});

describe('WorkOrderCloseInputDraft', () => {
  it('has the exact empty shape without request fields', () => {
    expect(EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT).toEqual({
      remainderDisposition: null,
      varianceReasonCode: '',
      remarks: '',
    });
    expect(Object.keys(EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT)).toEqual([
      'remainderDisposition',
      'varianceReasonCode',
      'remarks',
    ]);
  });

  it.each(['CARRY_OVER', 'WRITE_OFF', null] as const)(
    'replaces only the remainder disposition with %s immutably',
    (remainderDisposition: WorkOrderCloseRemainderDisposition | null) => {
      const source = draft({
        remainderDisposition: 'CARRY_OVER',
        varianceReasonCode: ' raw value ',
        remarks: '메모',
      });
      const result = setWorkOrderCloseRemainderDisposition(source, remainderDisposition);

      expect(result).not.toBe(source);
      expect(result).toEqual({ ...source, remainderDisposition });
      expect(source).toEqual(
        draft({
          remainderDisposition: 'CARRY_OVER',
          varianceReasonCode: ' raw value ',
          remarks: '메모',
        }),
      );
    },
  );

  it.each(['', '   ', ' raw value '] as const)(
    'preserves variance reason value %j and the other fields immutably',
    (varianceReasonCode: string) => {
      const source = draft({ remainderDisposition: 'WRITE_OFF', varianceReasonCode: 'unchanged' });
      const result = setWorkOrderCloseVarianceReasonCode(source, varianceReasonCode);

      expect(result).not.toBe(source);
      expect(result).toEqual({ ...source, varianceReasonCode });
      expect(source.varianceReasonCode).toBe('unchanged');
    },
  );

  /* 소멸 비고는 다듬지 않고 그대로 든다 — 다듬는 것은 본문을 만들 때 한 번이다. */
  it('replaces only the remarks immutably without trimming', () => {
    const source = draft({ remainderDisposition: 'WRITE_OFF', varianceReasonCode: 'SYN' });
    const result = setWorkOrderCloseRemarks(source, '  규격 변경  ');

    expect(result).not.toBe(source);
    expect(result).toEqual({ ...source, remarks: '  규격 변경  ' });
    expect(source.remarks).toBe('');
  });

  it.each([
    [
      'UNDER',
      draft(),
      true,
      ['OPEN_SESSION', 'REMAINDER_DISPOSITION_REQUIRED', 'VARIANCE_REASON_REQUIRED'],
    ],
    ['UNDER', draft({ remainderDisposition: 'WRITE_OFF', varianceReasonCode: ' x ' }), false, []],
    ['OVER', draft({ varianceReasonCode: '   ' }), false, ['VARIANCE_REASON_REQUIRED']],
    ['NORMAL', draft(), false, []],
  ] as const)(
    'derives readiness input for %s from the draft and the open session fact',
    (completionJudgment: WorkOrderCloseCompletionJudgment, source, hasOpenSession, blockers) => {
      const input = workOrderCloseReadinessInputFrom(source, completionJudgment, hasOpenSession);

      expect(input).toEqual({
        completionJudgment,
        hasOpenSession,
        hasRemainderDisposition: source.remainderDisposition !== null,
        hasVarianceReason: source.varianceReasonCode.trim() !== '',
      });
      expect(workOrderCloseBlockers(input)).toEqual(blockers);
    },
  );
});
