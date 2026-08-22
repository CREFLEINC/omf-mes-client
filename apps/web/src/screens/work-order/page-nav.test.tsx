import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import type { WorkOrderPageView } from './pagination';

const t = messages.workOrder.pageNav;

const view = (overrides: Partial<WorkOrderPageView> = {}): WorkOrderPageView => ({
  page: 4,
  rangeLabel: '61–80 / 전체 100건',
  canFirst: true,
  canPrev: true,
  canNext: true,
  isBeyondLast: false,
  ...overrides,
});

const renderNav = (overrides: Partial<WorkOrderPageView> = {}) => {
  const onChange = vi.fn();
  render(<PageNav view={view(overrides)} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

describe('work-order PageNav', () => {
  it('renders the supplied range and emits exact middle-page targets in order', async () => {
    const { onChange, user } = renderNav();

    expect(screen.getByRole('navigation', { name: t.label })).toHaveClass('form-actions');
    expect(screen.getByText('61–80 / 전체 100건')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.first }));
    await user.click(screen.getByRole('button', { name: t.previous }));
    await user.click(screen.getByRole('button', { name: t.next }));
    expect(onChange.mock.calls).toEqual([[1], [3], [5]]);
  });

  it('keeps first and previous buttons visible with visible accessible reasons on first page', () => {
    renderNav({ page: 1, rangeLabel: '1–20 / 전체 45건', canFirst: false, canPrev: false });
    const first = screen.getByRole('button', { name: t.first });
    const previous = screen.getByRole('button', { name: t.previous });

    expect(first).toBeDisabled();
    expect(previous).toBeDisabled();
    expect(screen.getByText(t.disabled.first)).toBeVisible();
    expect(screen.getByText(t.disabled.previous)).toBeVisible();
    expect(first).toHaveAccessibleDescription(t.disabled.first);
    expect(previous).toHaveAccessibleDescription(t.disabled.previous);
    expect(screen.getByRole('button', { name: t.next })).toBeEnabled();
  });

  it('keeps next visible with a visible accessible reason on last page', () => {
    renderNav({ page: 3, rangeLabel: '41–45 / 전체 45건', canNext: false });
    const next = screen.getByRole('button', { name: t.next });

    expect(next).toBeDisabled();
    expect(screen.getByText(t.disabled.next)).toBeVisible();
    expect(next).toHaveAccessibleDescription(t.disabled.next);
    expect(screen.getByRole('button', { name: t.first })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.previous })).toBeEnabled();
  });

  it.each([
    ['beyond last', view({ page: 4, rangeLabel: '전체 45건', canNext: false, isBeyondLast: true })],
    ['zero-result positive page', view({ page: 7, rangeLabel: '전체 0건', canNext: false })],
  ])(
    'uses supplied recovery state for a %s view without reinterpreting it',
    async (_name, suppliedView) => {
      const onChange = vi.fn();
      const user = userEvent.setup();
      render(<PageNav view={suppliedView} onChange={onChange} />);

      expect(screen.getByText(suppliedView.rangeLabel)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: t.first })).toBeEnabled();
      expect(screen.getByRole('button', { name: t.previous })).toBeEnabled();
      expect(screen.getByRole('button', { name: t.next })).toBeDisabled();
      await user.click(screen.getByRole('button', { name: t.first }));
      await user.click(screen.getByRole('button', { name: t.previous }));
      expect(onChange.mock.calls).toEqual([[1], [suppliedView.page - 1]]);
    },
  );
});
