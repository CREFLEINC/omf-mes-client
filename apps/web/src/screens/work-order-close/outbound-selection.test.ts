import { describe, expect, it } from 'vitest';

import {
  isWorkOrderCloseOutboundItemSelected,
  reconcileWorkOrderCloseOutboundSelection,
  selectedWorkOrderCloseOutboundItemCodes,
  toggleWorkOrderCloseOutboundItem,
  workOrderCloseOutboundSelectionFrom,
  type WorkOrderCloseOutboundSelection,
} from './outbound-selection';
import type { WorkOrderCloseOutboundItemSetting } from './queries';

const setting = (
  outboundItemCode: WorkOrderCloseOutboundItemSetting['outboundItemCode'],
  overrides: Partial<WorkOrderCloseOutboundItemSetting> = {},
): WorkOrderCloseOutboundItemSetting => ({
  outboundItemCode,
  outboundItemName: `SYNTHETIC ${outboundItemCode}`,
  enabled: false,
  locked: false,
  lockReason: null,
  sendTimingNote: null,
  ...overrides,
});

describe('workOrderCloseOutboundSelectionFrom', () => {
  it('copies each supplied server setting in order without appending known codes', () => {
    const settings = [
      setting('RETURN', { enabled: true }),
      setting('PRODUCTION_RESULT', { enabled: false }),
    ];

    expect(workOrderCloseOutboundSelectionFrom(settings)).toEqual({
      RETURN: true,
      PRODUCTION_RESULT: false,
    });
  });
});

describe('reconcileWorkOrderCloseOutboundSelection', () => {
  it('preserves unlocked choices, defaults new codes, forces locked values, and removes stale codes', () => {
    const previous: WorkOrderCloseOutboundSelection = {
      RETURN: false,
      GOODS_RECEIPT: true,
      STOCK_ADJUSTMENT: true,
    };
    const settings = [
      setting('RETURN', { enabled: true }),
      setting('PRODUCTION_RESULT', { enabled: true }),
      setting('GOODS_RECEIPT', { enabled: false, locked: true }),
    ];

    const reconciled = reconcileWorkOrderCloseOutboundSelection(settings, previous);

    expect(reconciled).toEqual({ RETURN: false, PRODUCTION_RESULT: true, GOODS_RECEIPT: false });
    expect(reconciled).not.toBe(previous);
    expect(previous).toEqual({ RETURN: false, GOODS_RECEIPT: true, STOCK_ADJUSTMENT: true });
  });

  it.each([
    [false, true],
    [true, false],
  ])('forces a locked previous=%s choice to the latest server enabled=%s', (previous, enabled) => {
    expect(
      reconcileWorkOrderCloseOutboundSelection([setting('RETURN', { enabled, locked: true })], {
        RETURN: previous,
      }),
    ).toEqual({ RETURN: enabled });
  });
});

describe('isWorkOrderCloseOutboundItemSelected', () => {
  it('reads stored booleans and treats an absent entry as false', () => {
    const selection: WorkOrderCloseOutboundSelection = { RETURN: true, GOODS_RECEIPT: false };

    expect(isWorkOrderCloseOutboundItemSelected(selection, 'RETURN')).toBe(true);
    expect(isWorkOrderCloseOutboundItemSelected(selection, 'GOODS_RECEIPT')).toBe(false);
    expect(isWorkOrderCloseOutboundItemSelected(selection, 'STOCK_ADJUSTMENT')).toBe(false);
  });
});

describe('toggleWorkOrderCloseOutboundItem', () => {
  it('inverts only an unlocked current value without mutating the source selection', () => {
    const selection: WorkOrderCloseOutboundSelection = { RETURN: false, GOODS_RECEIPT: true };
    const toggled = toggleWorkOrderCloseOutboundItem(selection, setting('RETURN'));

    expect(toggled).toEqual({ RETURN: true, GOODS_RECEIPT: true });
    expect(toggled).not.toBe(selection);
    expect(selection).toEqual({ RETURN: false, GOODS_RECEIPT: true });
    expect(toggleWorkOrderCloseOutboundItem(toggled, setting('RETURN'))).toEqual({
      RETURN: false,
      GOODS_RECEIPT: true,
    });
  });

  it('treats an absent unlocked entry as false before toggling it on', () => {
    expect(toggleWorkOrderCloseOutboundItem({ RETURN: true }, setting('STOCK_ADJUSTMENT'))).toEqual(
      { RETURN: true, STOCK_ADJUSTMENT: true },
    );
  });

  it.each([true, false])('keeps a locked enabled=%s setting as the same object', (enabled) => {
    const selection: WorkOrderCloseOutboundSelection = { RETURN: !enabled };

    expect(
      toggleWorkOrderCloseOutboundItem(selection, setting('RETURN', { enabled, locked: true })),
    ).toBe(selection);
  });
});

describe('selectedWorkOrderCloseOutboundItemCodes', () => {
  it('uses current selection in supplied server order without stale or enabled-derived codes', () => {
    const settings = [
      setting('RETURN', { enabled: false }),
      setting('PRODUCTION_RESULT', { enabled: true }),
      setting('GOODS_RECEIPT', { enabled: false }),
    ];
    const selection: WorkOrderCloseOutboundSelection = {
      RETURN: true,
      PRODUCTION_RESULT: false,
      GOODS_RECEIPT: true,
      STOCK_ADJUSTMENT: true,
    };

    expect(selectedWorkOrderCloseOutboundItemCodes(settings, selection)).toEqual([
      'RETURN',
      'GOODS_RECEIPT',
    ]);
  });
});
