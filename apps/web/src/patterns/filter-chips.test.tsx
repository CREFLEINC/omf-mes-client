import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FilterChips } from './filter-chips';

/* 표 위 거르기 칩 — 「전체」 없이 「이름 N건」, 0건 감춤, 다시 누르면 전체(사용자 지시 2026-11-24 · #358). */
describe('FilterChips', () => {
  const COUNTS: Record<string, number> = { ACCEPTED: 3, REJECTED: 0 };

  const renderChips = (value: string | null) => {
    const onChange = vi.fn();
    render(
      <FilterChips
        label="판정 거르기"
        options={[
          { value: 'ACCEPTED', label: '합격' },
          { value: 'REJECTED', label: '불합격' },
        ]}
        value={value}
        countOf={(code) => COUNTS[code] ?? 0}
        onChange={onChange}
      />,
    );
    return { onChange, user: userEvent.setup() };
  };

  it('「전체」 없이 칩마다 「이름 N건」을 붙이고, 0건 칩은 감춘다', () => {
    renderChips(null);

    expect(screen.getByRole('button', { name: '합격 3' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: /불합격/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /전체/ })).not.toBeInTheDocument();
  });

  it('고른 칩은 0건이어도 남긴다', () => {
    renderChips('REJECTED');

    expect(screen.getByRole('button', { name: '불합격 0' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('칩을 누르면 그 값으로 거른다', async () => {
    const { onChange, user } = renderChips(null);
    await user.click(screen.getByRole('button', { name: '합격 3' }));
    expect(onChange).toHaveBeenLastCalledWith('ACCEPTED');
  });

  it('고른 칩을 다시 누르면 전체(null)로 돌아간다', async () => {
    const { onChange, user } = renderChips('ACCEPTED');
    await user.click(screen.getByRole('button', { name: '합격 3' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
