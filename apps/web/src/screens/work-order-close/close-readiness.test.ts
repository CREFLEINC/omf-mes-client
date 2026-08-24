import { describe, expect, it } from 'vitest';

import {
  isWorkOrderCloseReady,
  workOrderCloseBlockers,
  workOrderCloseInputRequirements,
  type WorkOrderCloseReadinessInput,
} from './close-readiness';

describe('workOrderCloseInputRequirements', () => {
  it.each([
    ['UNDER', { requiresRemainderDisposition: true, requiresVarianceReason: true }],
    ['NORMAL', { requiresRemainderDisposition: false, requiresVarianceReason: false }],
    ['OVER', { requiresRemainderDisposition: false, requiresVarianceReason: true }],
  ] as const)('maps server judgment %s to the exact input requirements', (judgment, expected) => {
    expect(workOrderCloseInputRequirements(judgment)).toEqual(expected);
  });
});

const input = (
  overrides: Partial<WorkOrderCloseReadinessInput> = {},
): WorkOrderCloseReadinessInput => ({
  completionJudgment: 'NORMAL',
  hasOpenSession: false,
  hasRemainderDisposition: true,
  hasVarianceReason: true,
  ...overrides,
});

describe('workOrderCloseBlockers', () => {
  it.each([
    ['UNDER', true, true, []],
    ['UNDER', false, true, ['REMAINDER_DISPOSITION_REQUIRED']],
    ['UNDER', true, false, ['VARIANCE_REASON_REQUIRED']],
    ['UNDER', false, false, ['REMAINDER_DISPOSITION_REQUIRED', 'VARIANCE_REASON_REQUIRED']],
    ['NORMAL', false, false, []],
    ['OVER', false, false, ['VARIANCE_REASON_REQUIRED']],
    ['OVER', true, false, ['VARIANCE_REASON_REQUIRED']],
    ['OVER', false, true, []],
  ] as const)(
    'uses only relevant missing inputs for %s',
    (completionJudgment, hasRemainderDisposition, hasVarianceReason, expected) => {
      expect(
        workOrderCloseBlockers(
          input({ completionJudgment, hasRemainderDisposition, hasVarianceReason }),
        ),
      ).toEqual(expected);
    },
  );

  it('places an open session before every required-input blocker', () => {
    expect(
      workOrderCloseBlockers(
        input({
          completionJudgment: 'UNDER',
          hasOpenSession: true,
          hasRemainderDisposition: false,
          hasVarianceReason: false,
        }),
      ),
    ).toEqual(['OPEN_SESSION', 'REMAINDER_DISPOSITION_REQUIRED', 'VARIANCE_REASON_REQUIRED']);
  });
});

describe('isWorkOrderCloseReady', () => {
  it.each([
    [input(), true],
    [input({ hasOpenSession: true }), false],
    [input({ completionJudgment: 'UNDER', hasRemainderDisposition: false }), false],
    [input({ completionJudgment: 'OVER', hasVarianceReason: false }), false],
  ])('matches whether the blocker list is empty', (value, expected) => {
    const blockers = workOrderCloseBlockers(value);

    expect(isWorkOrderCloseReady(value)).toBe(blockers.length === 0);
    expect(isWorkOrderCloseReady(value)).toBe(expected);
  });
});
