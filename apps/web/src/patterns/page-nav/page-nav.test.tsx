import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toPageView } from './page-view';

const t = messages.common.pageNav;

const renderNav = (page = 2, disabled = false) => {
  const onChange = vi.fn();

  render(
    <PageNav
      view={toPageView({ page, size: 50, total: 120 })}
      disabled={disabled}
      onChange={onChange}
    />,
  );

  return { onChange, user: userEvent.setup() };
};

describe('PageNav (C-8)', () => {
  it('왼쪽에 총 건수와 페이지 크기, 가운데에 n/N을 보인다', () => {
    renderNav();

    expect(screen.getByText(t.total(120))).toBeInTheDocument();
    expect(screen.getByText(t.size(50))).toBeInTheDocument();
    expect(screen.getByText(t.position(2, 3))).toBeInTheDocument();
  });

  it('처음·이전·다음·마지막이 옮길 쪽을 알린다', async () => {
    const { onChange, user } = renderNav();

    await user.click(screen.getByRole('button', { name: t.first }));
    await user.click(screen.getByRole('button', { name: t.prev }));
    await user.click(screen.getByRole('button', { name: t.next }));
    await user.click(screen.getByRole('button', { name: t.last }));

    expect(onChange.mock.calls).toEqual([[1], [1], [3], [3]]);
  });

  it('갈 수 없는 쪽의 버튼은 잠긴다', () => {
    renderNav(1);

    expect(screen.getByRole('button', { name: t.first })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.prev })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.next })).not.toBeDisabled();
  });

  it('전송 중에는 갈 수 있는 쪽도 잠긴다', () => {
    renderNav(2, true);

    expect(screen.getByRole('button', { name: t.prev })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.next })).toBeDisabled();
  });

  it('탐색 영역에 이름이 있다', () => {
    renderNav();

    expect(screen.getByRole('navigation', { name: t.label })).toBeInTheDocument();
  });
});
