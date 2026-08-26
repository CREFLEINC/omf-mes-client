import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { WorkOrderReleaseScreen } from './screen';

const clearSelection = vi.hoisted(() => vi.fn());

type SelectionRenderer = (context: {
  selectedWorkOrderId: number | null;
  clearSelection: () => void;
}) => ReactNode;

vi.mock('./work-order-release-candidate-browser', () => ({
  WorkOrderReleaseCandidateBrowser: ({
    renderSelection,
  }: {
    renderSelection?: SelectionRenderer;
  }) => (
    <section aria-label="SYN-CANDIDATES">
      {renderSelection?.({ selectedWorkOrderId: 704, clearSelection })}
    </section>
  ),
}));
vi.mock('./work-order-release-execution', () => ({
  WorkOrderReleaseExecution: ({
    selectedWorkOrderId,
    onClearSelection,
  }: {
    selectedWorkOrderId: number | null;
    onClearSelection: () => void;
  }) => <button onClick={onClearSelection}>SYN-EXECUTION-{String(selectedWorkOrderId)}</button>,
}));

describe('WorkOrderReleaseScreen', () => {
  it('renders the production breadcrumb and owns candidate-to-execution selection wiring', async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkOrderReleaseScreen />);

    expect(
      screen.getByRole('heading', { level: 1, name: messages.workOrderRelease.title }),
    ).toBeVisible();
    const breadcrumb = screen.getByRole('navigation', { name: '탐색 경로' });
    expect(within(breadcrumb).getByText(messages.workOrderRelease.breadcrumbRoot)).toBeVisible();
    expect(within(breadcrumb).getByText(messages.workOrderRelease.title)).toBeVisible();
    expect(screen.getByRole('region', { name: 'SYN-CANDIDATES' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'SYN-EXECUTION-704' }));
    expect(clearSelection).toHaveBeenCalledTimes(1);
  });
});
