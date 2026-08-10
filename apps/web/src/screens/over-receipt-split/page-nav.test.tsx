import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';

const t = messages.overReceiptSplit;

const view = (overrides: Partial<PageView> = {}): PageView => ({
  page: 2,
  totalPages: 5,
  rangeLabel: t.pageNav.range(51, 100, 240),
  canPrev: true,
  canNext: true,
  isBeyondLast: false,
  ...overrides,
});

const renderNav = (overrides: Partial<PageView> = {}) => {
  const onChange = vi.fn<(page: number) => void>();

  render(<PageNav view={view(overrides)} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

describe('PageNav — 쪽 이동', () => {
  it('지금 보고 있는 범위를 밝힌다', () => {
    renderNav();

    expect(screen.getByText(t.pageNav.range(51, 100, 240))).toBeInTheDocument();
  });

  it('이전·다음이 옮길 쪽 번호를 넘긴다', async () => {
    const { onChange, user } = renderNav();

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));
    expect(onChange).toHaveBeenCalledWith(1);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('갈 수 없는 쪽의 버튼은 비활성이다', () => {
    renderNav({ canPrev: false, canNext: false });

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
  });

  /* 쪽 번호 목록을 만들지 않는다 — 이 화면에서 「7쪽으로 점프」는 정상 경로가 아니다. */
  it('쪽 번호 목록을 만들지 않는다 — 버튼은 둘뿐이다', () => {
    renderNav();

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('보조기술이 이 줄을 쪽 이동으로 읽는다', () => {
    renderNav();

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });
});
