import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';

const t = messages.disposalIssue;

const view = (overrides: Partial<PageView> = {}): PageView => ({
  page: 2,
  totalPages: 3,
  rangeLabel: t.pageNav.range(51, 100, 120),
  canPrev: true,
  canNext: true,
  isBeyondLast: false,
  ...overrides,
});

describe('PageNav', () => {
  it('지금 보고 있는 범위를 밝힌다', () => {
    render(<PageNav view={view()} onChange={vi.fn()} />);

    expect(screen.getByText(t.pageNav.range(51, 100, 120))).toBeInTheDocument();
  });

  it('이전·다음이 옮길 쪽을 알린다', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<PageNav view={view()} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(onChange.mock.calls).toEqual([[1], [3]]);
  });

  it('갈 곳이 없으면 잠긴다', () => {
    render(<PageNav view={view({ canPrev: false, canNext: false })} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
  });

  it('쪽 이동 묶음에 이름이 있다', () => {
    render(<PageNav view={view()} onChange={vi.fn()} />);

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });
});
