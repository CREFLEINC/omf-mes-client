import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { WorkOrderPageView } from '../work-order/pagination';
import { PageNav } from './page-nav';

const t = messages.workOrderRelease.candidateList.page;

const view = (overrides: Partial<WorkOrderPageView> = {}): WorkOrderPageView => ({
  page: 4,
  rangeLabel: '61–80 / 전체 100건',
  canFirst: true,
  canPrev: true,
  canNext: true,
  isBeyondLast: false,
  ...overrides,
});

describe('work-order-release PageNav', () => {
  it('keeps the range and moves to the exact previous and next pages', async () => {
    const onChange = vi.fn();
    render(<PageNav view={view()} onChange={onChange} />);
    const user = userEvent.setup();

    expect(screen.getByRole('navigation', { name: t.label })).toBeInTheDocument();
    expect(screen.getByText('61–80 / 전체 100건')).toBeVisible();
    await user.click(screen.getByRole('button', { name: t.prev }));
    await user.click(screen.getByRole('button', { name: t.next }));
    expect(onChange.mock.calls).toEqual([[3], [5]]);
  });

  it('shows a single page as two disabled buttons without explanations', () => {
    render(
      <PageNav
        view={view({
          page: 1,
          rangeLabel: '1–2 / 전체 2건',
          canFirst: false,
          canPrev: false,
          canNext: false,
        })}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('1–2 / 전체 2건')).toBeVisible();
    expect(screen.getAllByRole('button')).toHaveLength(2);
    expect(screen.getByRole('button', { name: t.prev })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.next })).toBeDisabled();
    for (const reason of Object.values(messages.workOrder.pageNav.disabled)) {
      expect(screen.queryByText(reason)).toBeNull();
    }
  });
});
