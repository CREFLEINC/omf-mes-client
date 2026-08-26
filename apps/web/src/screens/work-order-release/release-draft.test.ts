import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_WORK_ORDER_RELEASE_DRAFT,
  evaluateWorkOrderReleaseDraft,
  type WorkOrderReleaseDraft,
} from './release-draft';

const t = messages.workOrderRelease.input;

const draft = (overrides: Partial<WorkOrderReleaseDraft> = {}): WorkOrderReleaseDraft => ({
  ...EMPTY_WORK_ORDER_RELEASE_DRAFT,
  ...overrides,
});

describe('evaluateWorkOrderReleaseDraft', () => {
  it.each(['', '   '])('requires a LOT size for %j', (lotSizeText) => {
    expect(evaluateWorkOrderReleaseDraft(draft({ lotSizeText }), 5_000)).toEqual({
      body: null,
      lotSizeError: t.errors.lotSizeRequired,
      preview: null,
    });
  });

  it.each(['LOT', '12개', 'Infinity', 'NaN'])(
    'rejects non-finite or non-numeric LOT size %j',
    (lotSizeText) => {
      expect(evaluateWorkOrderReleaseDraft(draft({ lotSizeText }), 5_000)).toEqual({
        body: null,
        lotSizeError: t.errors.lotSizeNotNumber,
        preview: null,
      });
    },
  );

  it.each(['0', '0.0', '-1'])('rejects LOT size that is not positive: %j', (lotSizeText) => {
    expect(evaluateWorkOrderReleaseDraft(draft({ lotSizeText }), 5_000)).toEqual({
      body: null,
      lotSizeError: t.errors.lotSizeNotPositive,
      preview: null,
    });
  });

  it('derives the exact ceiling slot count and trims a supplied handover note', () => {
    expect(
      evaluateWorkOrderReleaseDraft(
        draft({ lotSizeText: ' 25 ', handoverNote: '  교대 전달사항  ' }),
        120,
      ),
    ).toEqual({
      body: { lotSize: 25, handoverNote: '교대 전달사항' },
      lotSizeError: null,
      preview: { slotCount: 5, isSingleSlotWarning: false },
    });
  });

  it('omits a blank optional handover note', () => {
    expect(
      evaluateWorkOrderReleaseDraft(draft({ lotSizeText: '500', handoverNote: '\n  ' }), 5_000)
        .body,
    ).toEqual({ lotSize: 500 });
  });

  it('does not add a phantom slot for a decimal division rounding overshoot', () => {
    expect(evaluateWorkOrderReleaseDraft(draft({ lotSizeText: '0.01' }), 0.07).preview).toEqual({
      slotCount: 7,
      isSingleSlotWarning: false,
    });
  });

  it('keeps the one-slot boundary when the positive ratio is smaller than Number.EPSILON', () => {
    expect(
      evaluateWorkOrderReleaseDraft(draft({ lotSizeText: '10000000000' }), 0.000001),
    ).toMatchObject({
      body: { lotSize: 10_000_000_000 },
      lotSizeError: null,
      preview: { slotCount: 1, isSingleSlotWarning: true },
    });
  });

  it('keeps a real remainder slot at a large but safe decimal ratio', () => {
    expect(
      evaluateWorkOrderReleaseDraft(draft({ lotSizeText: '0.01' }), 10_000_000_000_000.002).preview,
    ).toEqual({ slotCount: 1_000_000_000_000_001, isSingleSlotWarning: false });
  });

  it.each([
    ['equal', '120', true],
    ['greater', '200', true],
    ['less', '119', false],
  ] as const)(
    'marks the one-slot warning boundary for %s LOT size',
    (_name, lotSizeText, warning) => {
      expect(evaluateWorkOrderReleaseDraft(draft({ lotSizeText }), 120).preview).toMatchObject({
        isSingleSlotWarning: warning,
      });
    },
  );

  it('fails closed when the calculated slot count is not a safe integer', () => {
    expect(evaluateWorkOrderReleaseDraft(draft({ lotSizeText: '5e-324' }), 5_000)).toEqual({
      body: null,
      lotSizeError: t.errors.slotCountUnsafe,
      preview: null,
    });
  });

  it.each([null, 0, -1, Number.POSITIVE_INFINITY])(
    'does not claim readiness without a valid selected order quantity: %j',
    (orderQty) => {
      expect(evaluateWorkOrderReleaseDraft(draft({ lotSizeText: '25' }), orderQty)).toEqual({
        body: null,
        lotSizeError: null,
        preview: null,
      });
    },
  );

  it('does not mutate the draft', () => {
    const source = draft({ lotSizeText: ' 25 ', handoverNote: ' note ' });
    const before = structuredClone(source);

    evaluateWorkOrderReleaseDraft(source, 120);

    expect(source).toEqual(before);
  });
});
