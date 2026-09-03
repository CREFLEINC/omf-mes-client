import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WorkOrderCloseOutboundItemSetting } from './queries';
import { WorkOrderCloseOutboundItemsPane } from './outbound-items-pane';
import type { WorkOrderCloseOutboundSelection } from './outbound-selection';

const t = messages.workOrderClose.outboundItems;

const setting = (
  overrides: Partial<WorkOrderCloseOutboundItemSetting> = {},
): WorkOrderCloseOutboundItemSetting => ({
  outboundItemCode: 'RETURN',
  outboundItemName: 'Synthetic first item',
  enabled: false,
  locked: false,
  lockReason: null,
  sendTimingNote: null,
  ...overrides,
});

const renderPane = ({
  settings = [setting()],
  selection = {},
  isLoading = false,
  loadError = null,
  onToggle = vi.fn(),
}: Partial<React.ComponentProps<typeof WorkOrderCloseOutboundItemsPane>> = {}) => {
  render(
    <WorkOrderCloseOutboundItemsPane
      settings={settings}
      selection={selection}
      isLoading={isLoading}
      loadError={loadError}
      onToggle={onToggle}
    />,
  );
  return { onToggle };
};

describe('WorkOrderCloseOutboundItemsPane', () => {
  it('shows only the supplied error before loading or stale content', () => {
    renderPane({
      isLoading: true,
      loadError: <p>Synthetic load error</p>,
    });

    expect(screen.getByRole('region', { name: t.pane })).toHaveClass('pane');
    expect(screen.getByText('Synthetic load error')).toBeVisible();
    expect(screen.queryByRole('status', { name: t.loading })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t.heading })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.title)).not.toBeInTheDocument();
  });

  it('shows named loading before stale content', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('region', { name: t.pane })).toHaveClass('pane');
    expect(screen.getByRole('status', { name: t.loading })).toBeVisible();
    expect(screen.queryByRole('heading', { name: t.heading })).not.toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.title)).not.toBeInTheDocument();
  });

  it('treats an undefined load error as absent for loading and content', () => {
    const props = {
      settings: [setting()],
      selection: {},
      loadError: undefined,
      onToggle: vi.fn(),
    };
    const { rerender } = render(<WorkOrderCloseOutboundItemsPane {...props} isLoading />);

    expect(screen.getByRole('status', { name: t.loading })).toBeVisible();

    rerender(<WorkOrderCloseOutboundItemsPane {...props} isLoading={false} />);

    expect(screen.getByRole('heading', { name: t.heading })).toBeVisible();
    expect(screen.getByRole('switch', { name: props.settings[0]!.outboundItemName })).toBeVisible();
  });

  it('shows the content heading and live empty state without a switch group', () => {
    renderPane({ settings: [] });

    expect(screen.getByRole('region', { name: t.pane })).toHaveClass(
      'pane',
      'work-order-close-outbound-pane',
    );
    expect(screen.getByRole('heading', { name: t.heading })).toBeVisible();
    expect(screen.getByText(t.empty.title)).toBeVisible();
    expect(screen.getByText(t.empty.description)).toBeVisible();
    expect(screen.queryByRole('group', { name: t.group })).not.toBeInTheDocument();
  });

  it('keeps server order, does not show codes, and reads checked state from selection', () => {
    const settings = [
      setting({ outboundItemCode: 'RETURN', outboundItemName: 'Synthetic first item' }),
      setting({
        outboundItemCode: 'PRODUCTION_RESULT',
        outboundItemName: 'Synthetic second item',
        enabled: true,
      }),
    ];
    const selection: WorkOrderCloseOutboundSelection = {
      RETURN: true,
      PRODUCTION_RESULT: false,
    };

    renderPane({ settings, selection });

    const switches = screen.getAllByRole('switch');
    expect(switches).toHaveLength(2);
    expect(switches[0]!).toHaveAccessibleName(settings[0]!.outboundItemName);
    expect(switches[1]!).toHaveAccessibleName(settings[1]!.outboundItemName);
    expect(switches[0]!).toBeChecked();
    expect(switches[1]!).not.toBeChecked();
    expect(screen.queryByText('RETURN')).not.toBeInTheDocument();
    expect(screen.queryByText('PRODUCTION_RESULT')).not.toBeInTheDocument();
  });

  it('delegates an unlocked setting exactly once without owning its checked state', async () => {
    const user = userEvent.setup();
    const first = setting({ enabled: true });
    const { onToggle } = renderPane({ selection: { RETURN: false }, settings: [first] });
    const input = screen.getByRole('switch', { name: first.outboundItemName });

    await user.click(input);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(first);
    expect(input).not.toBeChecked();
  });

  it('renders timing and lock descriptions and blocks locked callbacks', async () => {
    const user = userEvent.setup();
    const lockedWithReason = setting({
      enabled: true,
      locked: true,
      lockReason: 'Synthetic lock reason',
      sendTimingNote: 'Synthetic timing note',
    });
    const lockedWithFallback = setting({
      outboundItemCode: 'GOODS_RECEIPT',
      outboundItemName: 'Synthetic fallback item',
      enabled: false,
      locked: true,
    });
    const timingOnly = setting({
      outboundItemCode: 'PRODUCTION_RESULT',
      outboundItemName: 'Synthetic timing item',
      sendTimingNote: 'Synthetic timing only',
    });
    const noDescription = setting({
      outboundItemCode: 'STOCK_ADJUSTMENT',
      outboundItemName: 'Synthetic plain item',
    });
    const { onToggle } = renderPane({
      settings: [lockedWithReason, lockedWithFallback, timingOnly, noDescription],
    });

    const locked = screen.getByRole('switch', { name: lockedWithReason.outboundItemName });
    expect(locked).toBeDisabled();
    expect(screen.getByText(t.sendTiming(lockedWithReason.sendTimingNote!))).toBeVisible();
    expect(screen.getByText(lockedWithReason.lockReason!)).toBeVisible();
    expect(locked).toHaveAttribute(
      'aria-describedby',
      'work-order-close-outbound-RETURN-timing work-order-close-outbound-RETURN-lock',
    );
    expect(locked).toHaveAccessibleDescription(
      `${t.sendTiming(lockedWithReason.sendTimingNote!)} ${lockedWithReason.lockReason}`,
    );

    const fallback = screen.getByRole('switch', { name: lockedWithFallback.outboundItemName });
    expect(fallback).toBeDisabled();
    expect(screen.getByText(t.lockedFallback)).toBeVisible();
    expect(fallback).toHaveAttribute(
      'aria-describedby',
      'work-order-close-outbound-GOODS_RECEIPT-lock',
    );
    expect(fallback).toHaveAccessibleDescription(t.lockedFallback);

    const timing = screen.getByRole('switch', { name: timingOnly.outboundItemName });
    expect(timing).toHaveAttribute(
      'aria-describedby',
      'work-order-close-outbound-PRODUCTION_RESULT-timing',
    );
    expect(
      screen.getByRole('switch', { name: noDescription.outboundItemName }),
    ).not.toHaveAttribute('aria-describedby');

    await user.click(locked);
    await user.click(fallback);
    expect(onToggle).not.toHaveBeenCalled();
  });
});
