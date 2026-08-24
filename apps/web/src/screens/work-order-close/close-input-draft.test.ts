import { describe, expect, it } from 'vitest';

import {
  EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT,
  setWorkOrderCloseRemainderDisposition,
  setWorkOrderCloseVarianceReasonCode,
  workOrderCloseReadinessInputFrom,
  type WorkOrderCloseInputDraft,
  type WorkOrderCloseRemainderDisposition,
} from './close-input-draft';
import { workOrderCloseBlockers, type WorkOrderCloseCompletionJudgment } from './close-readiness';

const draft = (overrides: Partial<WorkOrderCloseInputDraft> = {}): WorkOrderCloseInputDraft => ({
  remainderDisposition: null,
  varianceReasonCode: '',
  ...overrides,
});

describe('WorkOrderCloseInputDraft', () => {
  it('has the exact empty shape without request fields', () => {
    expect(EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT).toEqual({
      remainderDisposition: null,
      varianceReasonCode: '',
    });
    expect(Object.keys(EMPTY_WORK_ORDER_CLOSE_INPUT_DRAFT)).toEqual([
      'remainderDisposition',
      'varianceReasonCode',
    ]);
  });

  it.each(['CARRY_OVER', 'WRITE_OFF', null] as const)(
    'replaces only the remainder disposition with %s immutably',
    (remainderDisposition: WorkOrderCloseRemainderDisposition | null) => {
      const source = draft({
        remainderDisposition: 'CARRY_OVER',
        varianceReasonCode: ' raw value ',
      });
      const result = setWorkOrderCloseRemainderDisposition(source, remainderDisposition);

      expect(result).not.toBe(source);
      expect(result).toEqual({
        remainderDisposition,
        varianceReasonCode: source.varianceReasonCode,
      });
      expect(source).toEqual({
        remainderDisposition: 'CARRY_OVER',
        varianceReasonCode: ' raw value ',
      });
    },
  );

  it.each(['', '   ', ' raw value '] as const)(
    'preserves variance reason value %j and the other field immutably',
    (varianceReasonCode: string) => {
      const source = draft({ remainderDisposition: 'WRITE_OFF', varianceReasonCode: 'unchanged' });
      const result = setWorkOrderCloseVarianceReasonCode(source, varianceReasonCode);

      expect(result).not.toBe(source);
      expect(result).toEqual({ remainderDisposition: 'WRITE_OFF', varianceReasonCode });
      expect(source).toEqual({
        remainderDisposition: 'WRITE_OFF',
        varianceReasonCode: 'unchanged',
      });
    },
  );
});

const readinessCases = (['UNDER', 'NORMAL', 'OVER'] as const).flatMap((completionJudgment) =>
  [false, true].flatMap((hasOpenSession) =>
    [null, 'CARRY_OVER' as const].flatMap((remainderDisposition) =>
      ['', '   ', 'synthetic reason'].map((varianceReasonCode) => ({
        completionJudgment,
        hasOpenSession,
        remainderDisposition,
        varianceReasonCode,
      })),
    ),
  ),
);

describe('workOrderCloseReadinessInputFrom', () => {
  it.each(readinessCases)(
    'maps %s without changing its retained draft values',
    ({ completionJudgment, hasOpenSession, remainderDisposition, varianceReasonCode }) => {
      expect(
        workOrderCloseReadinessInputFrom(
          draft({ remainderDisposition, varianceReasonCode }),
          completionJudgment,
          hasOpenSession,
        ),
      ).toEqual({
        completionJudgment,
        hasOpenSession,
        hasRemainderDisposition: remainderDisposition !== null,
        hasVarianceReason: varianceReasonCode.trim() !== '',
      });
    },
  );
});

describe('workOrderCloseBlockers with input drafts', () => {
  it.each([
    [
      'under empty',
      draft(),
      'UNDER',
      false,
      ['REMAINDER_DISPOSITION_REQUIRED', 'VARIANCE_REASON_REQUIRED'],
    ],
    ['normal empty', draft(), 'NORMAL', false, []],
    ['over empty', draft(), 'OVER', false, ['VARIANCE_REASON_REQUIRED']],
    [
      'open session first',
      draft(),
      'UNDER',
      true,
      ['OPEN_SESSION', 'REMAINDER_DISPOSITION_REQUIRED', 'VARIANCE_REASON_REQUIRED'],
    ],
    [
      'irrelevant retained values',
      draft({ remainderDisposition: 'WRITE_OFF', varianceReasonCode: 'synthetic reason' }),
      'NORMAL',
      false,
      [],
    ],
  ] as const)(
    '%s keeps relevance rules in the blocker model',
    (
      _,
      inputDraft,
      completionJudgment: WorkOrderCloseCompletionJudgment,
      hasOpenSession,
      expected,
    ) => {
      expect(
        workOrderCloseBlockers(
          workOrderCloseReadinessInputFrom(inputDraft, completionJudgment, hasOpenSession),
        ),
      ).toEqual(expected);
    },
  );
});
