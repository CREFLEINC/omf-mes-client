import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkOrderReleaseActions } from './work-order-release-actions';

const t = messages.workOrderRelease.actions;

const renderActions = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderReleaseActions>> = {},
) => {
  const onCancel = vi.fn();
  const onRelease = vi.fn();
  const props = {
    hasSelection: true,
    isSubmitting: false,
    releaseDisabledReason: null,
    onCancel,
    onRelease,
    ...overrides,
  };
  const result = render(<WorkOrderReleaseActions {...props} />);

  return { ...result, props, onCancel, onRelease, user: userEvent.setup() };
};

describe('WorkOrderReleaseActions', () => {
  it('renders cancel then release with the exact variants and group label', () => {
    renderActions();
    const buttons = screen.getAllByRole('button');

    expect(screen.getByRole('group', { name: t.label })).toHaveClass('form-actions');
    expect(buttons.map((button) => button.textContent)).toEqual([t.cancel, t.release]);
    expect(buttons[0]?.className).toContain('_outlined_');
    expect(buttons[1]?.className).toContain('_filled_');
  });

  it('gives no-selection priority to both disabled actions and their visible descriptions', () => {
    renderActions({
      hasSelection: false,
      isSubmitting: true,
      releaseDisabledReason: 'SYNTHETIC CALLER REASON',
    });
    const cancel = screen.getByRole('button', { name: t.cancel });
    const release = screen.getByRole('button', { name: t.release });
    const cancelReason = t.reasons.noSelection(t.cancel);
    const releaseReason = t.reasons.noSelection(t.release);

    expect(cancel).toBeDisabled();
    expect(release).toBeDisabled();
    expect(cancel).toHaveAccessibleDescription(cancelReason);
    expect(release).toHaveAccessibleDescription(releaseReason);
    expect(screen.getByText(cancelReason)).toBeVisible();
    expect(screen.getByText(releaseReason)).toBeVisible();
    expect(screen.queryByText(t.reasons.submitting(t.cancel))).toBeNull();
    expect(screen.queryByText(t.reasons.release('SYNTHETIC CALLER REASON'))).toBeNull();
  });

  it('gives submitting priority to both actions while loading only release', () => {
    renderActions({ isSubmitting: true, releaseDisabledReason: 'SYNTHETIC CALLER REASON' });
    const cancel = screen.getByRole('button', { name: t.cancel });
    const release = screen.getByRole('button', { name: t.release });

    expect(cancel).toBeDisabled();
    expect(release).toBeDisabled();
    expect(cancel).toHaveAccessibleDescription(t.reasons.submitting(t.cancel));
    expect(release).toHaveAccessibleDescription(t.reasons.submitting(t.release));
    expect(cancel).not.toHaveAttribute('aria-busy');
    expect(release).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText(t.reasons.release('SYNTHETIC CALLER REASON'))).toBeNull();
  });

  it('keeps cancel enabled and prefixes a caller release reason while idle', () => {
    const callerReason = 'SYNTHETIC CALLER REASON';
    renderActions({ releaseDisabledReason: callerReason });
    const cancel = screen.getByRole('button', { name: t.cancel });
    const release = screen.getByRole('button', { name: t.release });
    const reason = t.reasons.release(callerReason);

    expect(cancel).toBeEnabled();
    expect(cancel).not.toHaveAttribute('aria-describedby');
    expect(release).toBeDisabled();
    expect(release).toHaveAccessibleDescription(reason);
    expect(screen.getByText(reason)).toBeVisible();
  });

  it('keeps disabled release descriptions and reason IDs unique across instances', () => {
    const firstReason = 'SYNTHETIC FIRST REASON';
    const secondReason = 'SYNTHETIC SECOND REASON';
    const { container } = render(
      <>
        <WorkOrderReleaseActions
          hasSelection
          isSubmitting={false}
          releaseDisabledReason={firstReason}
          onCancel={vi.fn()}
          onRelease={vi.fn()}
        />
        <WorkOrderReleaseActions
          hasSelection
          isSubmitting={false}
          releaseDisabledReason={secondReason}
          onCancel={vi.fn()}
          onRelease={vi.fn()}
        />
      </>,
    );
    const releases = screen.getAllByRole('button', { name: t.release });
    const reasonIds = Array.from(container.querySelectorAll('.field-note')).map(
      (reason) => reason.id,
    );

    expect(releases[0]).toHaveAccessibleDescription(t.reasons.release(firstReason));
    expect(releases[1]).toHaveAccessibleDescription(t.reasons.release(secondReason));
    expect(new Set(reasonIds).size).toBe(reasonIds.length);
  });

  it('enables both idle actions without reason nodes or descriptions', () => {
    const { container } = renderActions();
    const buttons = screen.getAllByRole('button');

    buttons.forEach((button) => {
      expect(button).toBeEnabled();
      expect(button).not.toHaveAttribute('aria-describedby');
    });
    expect(container.querySelector('.field-note')).toBeNull();
    expect(screen.queryByText('901')).toBeNull();
  });

  it('calls only the matching callback for each enabled action', async () => {
    const { onCancel, onRelease, user } = renderActions();

    await user.click(screen.getByRole('button', { name: t.cancel }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRelease).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: t.release }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRelease).toHaveBeenCalledTimes(1);
  });
});
