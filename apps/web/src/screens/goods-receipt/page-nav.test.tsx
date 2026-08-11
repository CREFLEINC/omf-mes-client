import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';

const t = messages.goodsReceipt;

const view = (overrides: Partial<PageView> = {}): PageView => ({
  page: 2,
  totalPages: 3,
  rangeLabel: t.pageNav.range(51, 100, 120),
  canPrev: true,
  canNext: true,
  isBeyondLast: false,
  ...overrides,
});

const renderNav = (overrides: Partial<PageView> = {}, isLocked = false) => {
  const onChange = vi.fn();

  render(<PageNav view={view(overrides)} isLocked={isLocked} onChange={onChange} />);

  return { onChange, user: userEvent.setup() };
};

describe('PageNav', () => {
  it('지금 위치를 문구로 보인다', () => {
    renderNav();

    expect(screen.getByText(t.pageNav.range(51, 100, 120))).toBeInTheDocument();
  });

  it('이전·다음을 누르면 옮길 쪽을 알린다', async () => {
    const { onChange, user } = renderNav();

    await user.click(screen.getByRole('button', { name: t.actions.prevPage }));
    await user.click(screen.getByRole('button', { name: t.actions.nextPage }));

    expect(onChange).toHaveBeenNthCalledWith(1, 1);
    expect(onChange).toHaveBeenNthCalledWith(2, 3);
  });

  it('갈 수 없는 쪽의 버튼은 잠긴다', () => {
    renderNav({ canPrev: false, canNext: false });

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
  });

  /*
   * **M34의 한 겹** — 전송 중에 쪽을 옮기면 고른 전표가 풀려, 앞 전표의 처리 결과가
   * 지금 보는 맥락에 나타난다.
   */
  it('전송 중에는 갈 수 있는 쪽도 잠긴다', () => {
    renderNav({}, true);

    expect(screen.getByRole('button', { name: t.actions.prevPage })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).toBeDisabled();
  });

  /* 짝 방향 — 전송 중이 아니면 갈 수 있는 쪽은 열려 있다. */
  it('전송 중이 아니면 갈 수 있는 쪽이 열려 있다', () => {
    renderNav();

    expect(screen.getByRole('button', { name: t.actions.prevPage })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: t.actions.nextPage })).not.toBeDisabled();
  });

  /* 이름 없는 탐색 영역이 여럿이면 스크린리더가 어느 것이 무엇인지 말할 수 없다. */
  it('탐색 영역에 이름이 있다', () => {
    renderNav();

    expect(screen.getByRole('navigation', { name: t.pageNav.label })).toBeInTheDocument();
  });
});
