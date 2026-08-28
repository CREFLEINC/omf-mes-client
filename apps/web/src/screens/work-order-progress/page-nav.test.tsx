import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { type PageMeta, toPageView } from './pagination';

const t = messages.workOrderProgress.page;

const renderNav = (meta: Partial<PageMeta> = {}, shown = 50) => {
  const onChange = vi.fn();
  const view = toPageView({ page: 1, size: 50, total: 128, ...meta }, shown);

  render(<PageNav view={view} onChange={onChange} />);

  return {
    onChange,
    user: userEvent.setup(),
    nav: screen.getByRole('navigation', { name: t.label }),
  };
};

describe('PageNav', () => {
  it('지금 보는 자리를 적는다', () => {
    const { nav } = renderNav();

    expect(within(nav).getByText(t.range(1, 50, 128))).toBeInTheDocument();
  });

  it('다음 쪽으로 간다', async () => {
    const { onChange, user, nav } = renderNav();

    await user.click(within(nav).getByRole('button', { name: t.next }));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('이전 쪽으로 간다', async () => {
    const { onChange, user, nav } = renderNav({ page: 2 });

    await user.click(within(nav).getByRole('button', { name: t.prev }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  /* ⛔ 경계에서 버튼을 없애지 않고 «잠근다» — 사라지면 자리가 흔들려 옆 버튼을 잘못 누른다. */
  it('⛔ 첫 쪽에서 이전이 잠긴다 — 사라지지 않는다', () => {
    const { nav } = renderNav();
    const prev = within(nav).getByRole('button', { name: t.prev });

    expect(prev).toBeInTheDocument();
    expect(prev).toBeDisabled();
  });

  it('⛔ 마지막 쪽에서 다음이 잠긴다', () => {
    const { nav } = renderNav({ page: 3 }, 28);

    expect(within(nav).getByRole('button', { name: t.next })).toBeDisabled();
  });

  it('결과가 0건이면 양쪽이 잠긴다', () => {
    const { nav } = renderNav({ total: 0 }, 0);

    expect(within(nav).getByRole('button', { name: t.prev })).toBeDisabled();
    expect(within(nav).getByRole('button', { name: t.next })).toBeDisabled();
  });

  /* 버튼과 안내가 같은 계산을 본다 — 「다음」이 눌리는데 없는 자리를 가리키지 않는다. */
  it('⛔ 잠긴 버튼을 눌러도 아무 일이 없다', async () => {
    const { onChange, user, nav } = renderNav();

    await user.click(within(nav).getByRole('button', { name: t.prev }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
