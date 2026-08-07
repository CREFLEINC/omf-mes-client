import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import type { PageView } from './pagination';

const view = (overrides: Partial<PageView> = {}): PageView => ({
  page: 2,
  totalPages: 3,
  rangeLabel: '51–100 / 전체 120건',
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

/* 받은 값을 그대로 그리는 표현 전용 부품이라 렌더 단언만 둔다. */
describe('PageNav', () => {
  it('지금 위치를 밝힌다', () => {
    renderNav();

    expect(screen.getByText('51–100 / 전체 120건')).toBeInTheDocument();
  });

  it('탐색 영역에 이름이 붙는다', () => {
    renderNav();

    expect(screen.getByRole('navigation', { name: '쪽 이동' })).toBeInTheDocument();
  });

  it('이전을 누르면 한 쪽 앞으로 간다', async () => {
    const { onChange, user } = renderNav();

    await user.click(screen.getByRole('button', { name: '이전' }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('다음을 누르면 한 쪽 뒤로 간다', async () => {
    const { onChange, user } = renderNav();

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('갈 수 없는 쪽의 버튼은 잠긴다', () => {
    renderNav({ canPrev: false, canNext: false });

    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('쪽 번호 목록을 만들지 않는다 — 버튼은 이전·다음 둘뿐이다', () => {
    renderNav();

    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});
