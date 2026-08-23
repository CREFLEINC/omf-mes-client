import { describe, expect, it } from 'vitest';

import {
  classifyWorkOrderCloseQuantity,
  isWorkOrderCloseReady,
  workOrderCloseBlockers,
  workOrderCloseInputRequirements,
  type WorkOrderCloseReadinessInput,
} from './close-readiness';

describe('classifyWorkOrderCloseQuantity', () => {
  it.each([
    [8, 7, 'SHORTFALL'],
    [0, 0, 'EXACT'],
    [0, 0.25, 'OVERAGE'],
    [0.75, 0.5, 'SHORTFALL'],
    [0.75, 0.75, 'EXACT'],
    [0.75, 1, 'OVERAGE'],
    [1, 1 - Number.EPSILON / 2, 'SHORTFALL'],
    [1, 1 + Number.EPSILON, 'OVERAGE'],
  ] as const)(
    'classifies order %s and good %s as %s without tolerance',
    (orderQty, goodQty, expected) => {
      expect(classifyWorkOrderCloseQuantity(orderQty, goodQty)).toBe(expected);
    },
  );
});

describe('workOrderCloseInputRequirements', () => {
  it.each([
    ['SHORTFALL', { requiresRemainderDisposition: true, requiresVarianceReason: true }],
    ['EXACT', { requiresRemainderDisposition: false, requiresVarianceReason: false }],
    ['OVERAGE', { requiresRemainderDisposition: false, requiresVarianceReason: true }],
  ] as const)('maps %s to the exact input requirements', (classification, expected) => {
    expect(workOrderCloseInputRequirements(classification)).toEqual(expected);
  });
});

const input = (
  overrides: Partial<WorkOrderCloseReadinessInput> = {},
): WorkOrderCloseReadinessInput => ({
  classification: 'EXACT',
  hasOpenSession: false,
  hasRemainderDisposition: true,
  hasVarianceReason: true,
  ...overrides,
});

describe('workOrderCloseBlockers', () => {
  it.each([
    ['SHORTFALL', true, true, []],
    ['SHORTFALL', false, true, ['REMAINDER_DISPOSITION_REQUIRED']],
    ['SHORTFALL', true, false, ['VARIANCE_REASON_REQUIRED']],
    ['SHORTFALL', false, false, ['REMAINDER_DISPOSITION_REQUIRED', 'VARIANCE_REASON_REQUIRED']],
    ['EXACT', false, false, []],
    ['OVERAGE', false, false, ['VARIANCE_REASON_REQUIRED']],
    ['OVERAGE', true, false, ['VARIANCE_REASON_REQUIRED']],
    ['OVERAGE', false, true, []],
  ] as const)(
    'uses only relevant missing inputs for %s',
    (classification, hasRemainderDisposition, hasVarianceReason, expected) => {
      expect(
        workOrderCloseBlockers(
          input({ classification, hasRemainderDisposition, hasVarianceReason }),
        ),
      ).toEqual(expected);
    },
  );

  it('places an open session before every required-input blocker', () => {
    expect(
      workOrderCloseBlockers(
        input({
          classification: 'SHORTFALL',
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
    [input({ classification: 'SHORTFALL', hasRemainderDisposition: false }), false],
    [input({ classification: 'OVERAGE', hasVarianceReason: false }), false],
  ])('matches whether the blocker list is empty', (value, expected) => {
    const blockers = workOrderCloseBlockers(value);

    expect(isWorkOrderCloseReady(value)).toBe(blockers.length === 0);
    expect(isWorkOrderCloseReady(value)).toBe(expected);
  });
});
