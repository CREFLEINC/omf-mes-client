import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FailureFilterBar, type FailureFilterBarProps } from './failure-filter-bar';
import { DEFAULT_FILTERS } from './filters';

const t = messages.equipmentFailure;
const more = messages.common.filterMore;

const renderBar = (overrides: Partial<FailureFilterBarProps> = {}) => {
  const props: FailureFilterBarProps = {
    appliedFilters: DEFAULT_FILTERS,
    equipmentOptions: [],
    onSearch: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  const result = render(<FailureFilterBar {...props} />);

  return { ...result, ...props, user: userEvent.setup() };
};

describe('FailureFilterBar — 조건 더보기(C-6)', () => {
  it('체크칸 둘은 조건 더보기 안에 접혀 있다', async () => {
    const { user } = renderBar();

    expect(screen.queryByRole('checkbox', { name: t.filters.withoutOrder })).toBeNull();

    await user.click(screen.getByRole('button', { name: more.open }));

    expect(screen.getByRole('checkbox', { name: t.filters.openOnly })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: t.filters.withoutOrder })).toBeVisible();
  });

  /* 「미처리만」은 기본이 켜짐이다 — 접혀서도 완료된 건이 왜 안 보이는지 드러나야 한다. */
  it('접힌 체크칸에 걸린 조건만 칩이 되고 × 가 그 조건만 풀어 다시 조회한다', async () => {
    const { onSearch, user } = renderBar({
      appliedFilters: { ...DEFAULT_FILTERS, status: 'RECEIVED', withoutOrder: true },
    });

    expect(screen.getByRole('button', { name: more.remove(t.filters.openOnly) })).toBeVisible();
    /* 상태는 보이는 칸이라 칩으로 겹쳐 적지 않는다. */
    expect(screen.getAllByRole('button', { name: /조건 제거$/ })).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: more.remove(t.filters.withoutOrder) }));

    expect(onSearch).toHaveBeenCalledWith({
      ...DEFAULT_FILTERS,
      status: 'RECEIVED',
      withoutOrder: false,
    });
  });

  it('펼치면 칸에 값이 보이므로 칩을 거둔다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByRole('button', { name: more.open }));

    expect(screen.queryByRole('button', { name: more.remove(t.filters.openOnly) })).toBeNull();
  });

  it('초기화는 처음 값과 달라진 것이 있을 때만 보인다', async () => {
    const { user } = renderBar();

    expect(screen.queryByRole('button', { name: t.filters.reset })).toBeNull();

    await user.click(screen.getByRole('button', { name: more.open }));
    await user.click(screen.getByRole('checkbox', { name: t.filters.withoutOrder }));

    expect(screen.getByRole('button', { name: t.filters.reset })).toBeVisible();
  });

  it('조회에 쓰인 값이 처음 값과 다르면 초기화가 보인다', () => {
    renderBar({ appliedFilters: { ...DEFAULT_FILTERS, openOnly: false } });

    expect(screen.getByRole('button', { name: t.filters.reset })).toBeVisible();
  });
});
