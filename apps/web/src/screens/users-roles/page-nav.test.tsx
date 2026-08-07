import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageNav } from './page-nav';
import { toPageView } from './pagination';

/** 표현 전용 부품이라 렌더 단언만 둔다 — 규칙은 `pagination.ts`가 갖는다. */
const renderNav = (page: number, total: number, shown: number, label?: string) => {
  const onChange = vi.fn<(page: number) => void>();

  render(
    <PageNav view={toPageView({ page, size: 50, total }, shown)} onChange={onChange} label={label} />,
  );

  return { onChange, user: userEvent.setup() };
};

describe('PageNav', () => {
  it('지금 위치를 범위로 알린다', () => {
    renderNav(2, 240, 50);

    expect(screen.getByText('51–100 / 전체 240건')).toBeInTheDocument();
  });

  it('첫 쪽에서는 이전이 비활성이다', () => {
    renderNav(1, 240, 50);

    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
  });

  it('마지막 쪽에서는 다음이 비활성이다', () => {
    renderNav(5, 240, 40);

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '이전' })).toBeEnabled();
  });

  /* 경계 — 전체 건수가 쪽 크기의 배수면 마지막 쪽이 딱 떨어진다. 여기서 열리면 빈 쪽으로 간다. */
  it('전체 건수가 쪽 크기의 배수여도 마지막 쪽에서 다음이 비활성이다', () => {
    renderNav(4, 200, 50);

    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('다음을 누르면 다음 쪽 번호를 알린다', async () => {
    const { onChange, user } = renderNav(2, 240, 50);

    await user.click(screen.getByRole('button', { name: '다음' }));

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('이전을 누르면 앞 쪽 번호를 알린다', async () => {
    const { onChange, user } = renderNav(2, 240, 50);

    await user.click(screen.getByRole('button', { name: '이전' }));

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('결과가 0건이면 범위를 지어내지 않고 양쪽이 모두 비활성이다', () => {
    renderNav(1, 0, 0);

    expect(screen.getByText('전체 0건')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
  });

  it('탐색 묶음에 접근 이름이 있다', () => {
    renderNav(1, 240, 50);

    expect(screen.getByRole('navigation', { name: '쪽 이동' })).toBeInTheDocument();
  });

  /* 목록이 늘면 이름이 같은 쪽 이동이 둘이 되어 어느 목록의 것인지 가릴 수 없다. */
  it('접근 이름을 바꿔 붙일 수 있다', () => {
    renderNav(1, 240, 50, '역할 쪽 이동');

    expect(screen.getByRole('navigation', { name: '역할 쪽 이동' })).toBeInTheDocument();
  });
});
