import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DowntimeFilterBar, type DowntimeFilterBarProps } from './downtime-filter-bar';
import { EMPTY_FILTERS } from './filters';

const t = messages.downtimeSummary;
const more = messages.common.filterMore;

const PERIOD = { from: '2026-10-22', to: '2026-11-20' };

const renderBar = (overrides: Partial<DowntimeFilterBarProps> = {}) => {
  const props: DowntimeFilterBarProps = {
    appliedPeriod: PERIOD,
    appliedFilters: EMPTY_FILTERS,
    defaultPeriod: PERIOD,
    plantOptions: [{ value: '11', label: '제1공장' }],
    equipmentGroupOptions: [{ value: '21', label: '사출' }],
    equipmentOptions: [],
    onSearch: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };
  const result = render(<DowntimeFilterBar {...props} />);

  return { ...result, ...props, user: userEvent.setup() };
};

describe('DowntimeFilterBar — 조건 더보기(C-6)', () => {
  it('공장은 조건 더보기 안에 접혀 있다', async () => {
    const { user } = renderBar();

    expect(screen.queryByRole('combobox', { name: t.filters.plant })).toBeNull();
    expect(screen.getByRole('combobox', { name: t.filters.equipmentGroup })).toBeVisible();

    await user.click(screen.getByRole('button', { name: more.open }));

    expect(screen.getByRole('combobox', { name: t.filters.plant })).toBeVisible();
  });

  it('접힌 공장에 걸린 조건만 칩이 되고 × 가 공장만 풀어 다시 조회한다', async () => {
    const applied = { plant: '11', equipmentGroup: '21', equipment: '' };
    const { onSearch, user } = renderBar({ appliedFilters: applied });

    expect(screen.getByText(t.filters.chipPlant('제1공장'))).toBeVisible();
    /* 설비 그룹은 보이는 칸이라 칩으로 겹쳐 적지 않는다. */
    expect(screen.getAllByRole('button', { name: /조건 제거$/ })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: more.remove(t.filters.plant) }));

    expect(onSearch).toHaveBeenCalledWith(PERIOD, { ...applied, plant: '' });
  });

  it('펼치면 칸에 값이 보이므로 칩을 거둔다', async () => {
    const { user } = renderBar({ appliedFilters: { ...EMPTY_FILTERS, plant: '11' } });

    await user.click(screen.getByRole('button', { name: more.open }));

    expect(screen.queryByText(t.filters.chipPlant('제1공장'))).toBeNull();
  });

  it('초기화는 기간이나 조건이 처음 값과 다를 때만 보인다', () => {
    const { unmount } = renderBar();

    expect(screen.queryByRole('button', { name: t.filters.reset })).toBeNull();
    unmount();

    renderBar({ appliedPeriod: { from: '2026-11-01', to: '2026-11-20' } });

    expect(screen.getByRole('button', { name: t.filters.reset })).toBeVisible();
  });
});
