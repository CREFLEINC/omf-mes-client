import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkOrderCloseOutboundItemsPane } from './outbound-items-pane';
import type { WorkOrderCloseOutboundItemSetting } from './queries';

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
  isLoading = false,
  loadError = null,
}: Partial<React.ComponentProps<typeof WorkOrderCloseOutboundItemsPane>> = {}) =>
  render(
    <WorkOrderCloseOutboundItemsPane
      settings={settings}
      isLoading={isLoading}
      loadError={loadError}
    />,
  );

describe('WorkOrderCloseOutboundItemsPane', () => {
  it('shows only the supplied error before loading or stale content', () => {
    renderPane({ isLoading: true, loadError: <p>Synthetic load error</p> });

    expect(screen.getByRole('region', { name: t.pane })).toHaveClass('pane');
    expect(screen.getByText('Synthetic load error')).toBeVisible();
    expect(screen.queryByRole('status', { name: t.loading })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: t.heading })).not.toBeInTheDocument();
  });

  it('shows named loading before stale content', () => {
    renderPane({ isLoading: true });

    expect(screen.getByRole('status', { name: t.loading })).toBeVisible();
    expect(screen.queryByRole('heading', { name: t.heading })).not.toBeInTheDocument();
  });

  it('shows the content heading, the global-setting lead and a live empty state', () => {
    renderPane({ settings: [] });

    expect(screen.getByRole('region', { name: t.pane })).toHaveClass(
      'pane',
      'work-order-close-outbound-pane',
    );
    expect(screen.getByRole('heading', { name: t.heading })).toBeVisible();
    expect(screen.getByText(t.lead)).toBeVisible();
    expect(screen.getByText(t.empty.title)).toBeVisible();
    expect(screen.getByText(t.appendixPending)).toBeVisible();
  });

  /* 전역 설정은 마감 한 건이 바꾸지 않는다 — 토글이 없고 상태만 읽힌다. */
  it('renders each setting read-only with its send state, keeps server order and hides codes', () => {
    const settings = [
      setting({ outboundItemCode: 'RETURN', outboundItemName: 'Synthetic first item' }),
      setting({
        outboundItemCode: 'PRODUCTION_RESULT',
        outboundItemName: 'Synthetic second item',
        enabled: true,
        locked: true,
        lockReason: 'Synthetic lock reason',
        sendTimingNote: 'Synthetic timing note',
      }),
    ];

    renderPane({ settings });

    const group = screen.getByRole('group', { name: t.group });
    const terms = within(group).getAllByRole('term');
    expect(terms.map((term) => term.textContent)).toEqual([
      'Synthetic first item',
      'Synthetic second item',
    ]);
    expect(within(group).getByText(t.state.off)).toBeVisible();
    expect(within(group).getByText(t.state.on)).toBeVisible();
    expect(within(group).getByText('Synthetic lock reason')).toBeVisible();
    expect(within(group).getByText(t.sendTiming('Synthetic timing note'))).toBeVisible();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText('RETURN')).not.toBeInTheDocument();
    expect(screen.queryByText('PRODUCTION_RESULT')).not.toBeInTheDocument();
  });

  it('falls back to the generic lock note when the server gives no reason', () => {
    renderPane({ settings: [setting({ locked: true })] });

    expect(screen.getByText(t.lockedFallback)).toBeVisible();
  });
});
