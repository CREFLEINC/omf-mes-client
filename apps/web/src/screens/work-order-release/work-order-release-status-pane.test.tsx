import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
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
      const pane = screen.getByRole('region', { name: t.pane });

      expect(pane).toHaveClass('work-order-release-status-pane');
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

  it('names the missing locations in order inside the one status banner', () => {
    const { container } = renderPane({
      preconditions: preconditions({
        passesStaticGate: false,
        blockReason: 'missingDefaultLocations',
        missingDefaultLocations: ['scrap', 'wip', 'finishedGoods'],
      }),
    });

    const [banner, ...others] = screen.getAllByRole('alert');
    expect(others).toHaveLength(0);
    expect(banner).toHaveTextContent(t.status.missingDefaultLocations);
    expect(banner).toHaveTextContent(
      t.locations.missingList(
        `${t.locations.scrap}, ${t.locations.wip}, ${t.locations.finishedGoods}`,
      ),
    );
    expect(container.querySelector('.banner-slot')).toBeNull();
    expect(screen.queryByText('911')).toBeNull();
  });

  it('suppresses missing-location warning when none are supplied and has no controls', () => {
    const { container } = renderPane();

    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.querySelector('.banner-slot')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  describe('fix button to the 4M screen', () => {
    const target = { productionPlanId: 501, workOrderId: 701 };
    const Landing = () => {
      const location = useLocation();
      return <p data-testid="landed">{`${location.pathname}${location.search}`}</p>;
    };
    const renderRouted = (result: WorkOrderReleasePreconditions) =>
      render(
        <MemoryRouter initialEntries={['/production/work-order-release']}>
          <Routes>
            <Route
              path="/production/work-order-release"
              element={
                <WorkOrderReleaseStatusPane
                  selectedWorkOrderNo="SYN-WO-ALPHA"
                  preconditions={result}
                  assignmentTarget={target}
                />
              }
            />
            <Route path="/production/work-order-assignments" element={<Landing />} />
          </Routes>
        </MemoryRouter>,
      );

    it.each([
      preconditions({
        passesStaticGate: false,
        blockReason: 'missingDefaultLocations',
        missingDefaultLocations: ['wip', 'scrap'],
      }),
      preconditions({ passesStaticGate: false, blockReason: 'validationBlocked' }),
    ])('opens the 4M screen on the blocked W/O for $blockReason', async (result) => {
      renderRouted(result);

      await userEvent.click(screen.getByRole('button', { name: t.status.openAssignment }));

      expect(screen.getByTestId('landed')).toHaveTextContent(
        '/production/work-order-assignments?productionPlanId=501&workOrderId=701',
      );
    });

    it.each([
      preconditions(),
      preconditions({ passesStaticGate: false, blockReason: 'alreadyReleased' }),
      preconditions({ passesStaticGate: false, blockReason: 'validationUnavailable' }),
    ])('offers no fix button when 4M cannot fix it ($blockReason)', (result) => {
      renderRouted(result);

      expect(screen.queryByRole('button', { name: t.status.openAssignment })).toBeNull();
    });

    it('offers no fix button before the W/O detail is known', () => {
      renderPane({
        preconditions: preconditions({
          passesStaticGate: false,
          blockReason: 'missingDefaultLocations',
          missingDefaultLocations: ['wip'],
        }),
        assignmentTarget: null,
      });

      expect(screen.queryByRole('button', { name: t.status.openAssignment })).toBeNull();
    });
  });
});
