import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { WorkOrderReleasePreconditions } from './release-preconditions';
import { WorkOrderReleaseStatusPane } from './work-order-release-status-pane';

const t = messages.workOrderRelease;

const preconditions = (
  overrides: Partial<WorkOrderReleasePreconditions> = {},
): WorkOrderReleasePreconditions => ({
  passesStaticGate: true,
  blockReason: null,
  missingDefaultLocations: [],
  ...overrides,
});

const renderPane = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderReleaseStatusPane>> = {},
) =>
  render(
    <WorkOrderReleaseStatusPane
      selectedWorkOrderNo="SYN-WO-ALPHA"
      preconditions={preconditions()}
      {...overrides}
    />,
  );

describe('WorkOrderReleaseStatusPane', () => {
  it.each<[string, Partial<React.ComponentProps<typeof WorkOrderReleaseStatusPane>>]>([
    ['null selection', { selectedWorkOrderNo: null }],
    ['no-selection result', { preconditions: preconditions({ blockReason: 'noSelection' }) }],
  ])('isolates stale status and location warnings for %s', (_name, overrides) => {
    renderPane({
      ...overrides,
      preconditions: preconditions({
        passesStaticGate: true,
        blockReason: null,
        missingDefaultLocations: ['wip', 'finishedGoods', 'scrap'],
        ...overrides.preconditions,
      }),
    });

    expect(screen.getByText(t.empty.notSelectedTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.status.staticPassed)).toBeNull();
    expect(screen.queryByText(t.locations.wip)).toBeNull();
    expect(screen.queryByText(t.locations.finishedGoods)).toBeNull();
    expect(screen.queryByText(t.locations.scrap)).toBeNull();
  });

  it.each([
    [preconditions(), t.status.staticPassed, 'status', 'success'],
    [
      preconditions({ passesStaticGate: false, blockReason: 'alreadyReleased' }),
      t.status.alreadyReleased,
      'status',
      'info',
    ],
    [
      preconditions({ passesStaticGate: false, blockReason: 'validationBlocked' }),
      t.status.validationBlocked,
      'alert',
      'error',
    ],
    [
      preconditions({ passesStaticGate: false, blockReason: 'validationUnavailable' }),
      t.status.validationUnavailable,
      'alert',
      'error',
    ],
    [
      preconditions({ passesStaticGate: false, blockReason: null }),
      t.status.validationUnavailable,
      'alert',
      'error',
    ],
  ] as const)(
    'maps selected result to the exact %s static banner',
    (result, copy, role, variant) => {
      renderPane({ preconditions: result });
      const banner = screen.getByRole(role);

      expect(
        screen.getByRole('heading', { level: 2, name: t.heading('SYN-WO-ALPHA') }),
      ).toBeVisible();
      expect(banner).toHaveTextContent(copy);
      expect(banner.className).toContain(variant);
      expect(screen.getAllByRole(role)).toHaveLength(1);
    },
  );

  it.each(['alreadyReleased', 'validationBlocked', 'validationUnavailable'] as const)(
    'fails closed for a static-pass contradiction with %s',
    (blockReason) => {
      renderPane({ preconditions: preconditions({ blockReason }) });

      const banner = screen.getByRole('alert');

      expect(banner).toHaveTextContent(t.status.validationUnavailable);
      expect(banner.className).toContain('error');
      expect(screen.queryByText(t.status.staticPassed)).toBeNull();
    },
  );

  it('keeps successful static status short of final release readiness language', () => {
    renderPane();

    expect(screen.getByText(t.status.staticPassed)).toBeVisible();
    expect(screen.queryByText(/최종.*준비|최종.*완료/)).toBeNull();
  });

  it('renders supplied missing locations in order without raw IDs', () => {
    const { container } = renderPane({
      preconditions: preconditions({ missingDefaultLocations: ['scrap', 'wip', 'finishedGoods'] }),
    });
    const warning = screen.getByRole('alert');
    const bannerSlot = container.querySelector('.banner-slot');

    expect(screen.getByText(t.locations.missingTitle)).toBeVisible();
    expect(screen.getByText(new RegExp(t.locations.missingDescription))).toBeVisible();
    expect(warning).toHaveTextContent(t.locations.missingTitle);
    expect(warning).toHaveTextContent(t.locations.missingDescription);
    expect(warning).toHaveTextContent(
      `${t.locations.scrap}, ${t.locations.wip}, ${t.locations.finishedGoods}`,
    );
    expect(warning.className).toContain('warning');
    expect(bannerSlot).not.toBeNull();
    expect(bannerSlot).toContainElement(screen.getByText(t.status.staticPassed));
    expect(screen.queryByText('911')).toBeNull();
    expect(screen.queryByText('912')).toBeNull();
    expect(screen.queryByText('913')).toBeNull();
  });

  it('suppresses missing-location warning when none are supplied and has no controls', () => {
    const { container } = renderPane();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('.banner-slot')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
