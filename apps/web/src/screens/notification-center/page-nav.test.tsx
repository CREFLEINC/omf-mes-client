import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toPageView } from './pagination';

const t = messages.notificationCenter;

const renderNav = (page: number, total: number, shown: number, size = 50) => {
  const onChange = vi.fn();
  render(<PageNav view={toPageView({ page, size, total }, shown)} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

describe('PageNav', () => {
  it('지금 위치를 범위로 밝힌다', () => {
    renderNav(3, 137, 37);

    expect(screen.getByText(t.pageNav.range(101, 137, 137))).toBeInTheDocument();
  });

  it('이전·다음 둘뿐이다 — 쪽 번호 목록을 만들지 않는다', () => {
    renderNav(2, 137, 50);

    /* 번호 목록은 자기만의 생략 규칙·현재 위치 표시·키보드 규약을 갖는 별도 부품이 된다. */
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('다음을 누르면 다음 쪽을 알린다', async () => {
    const { onChange, user } = renderNav(2, 137, 50);

    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('이전을 누르면 앞 쪽을 알린다', async () => {
    const { onChange, user } = renderNav(2, 137, 50);

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('첫 쪽에서는 이전이 잠긴다', () => {
    renderNav(1, 137, 50);

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeEnabled();
  });

  it('마지막 쪽에서는 다음이 잠긴다', () => {
    renderNav(3, 137, 37);

    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeEnabled();
  });

  it('잠긴 버튼을 눌러도 아무 일이 없다', async () => {
    const { onChange, user } = renderNav(1, 137, 50);

    /* 짝 양성 — 잠기지 않은 쪽은 실제로 동작한다. */
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));
    expect(onChange).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('쪽 이동 구획이 이름을 갖는다', () => {
    renderNav(1, 137, 50);

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });
});
