import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { DEFAULT_FILTERS } from './filters';
import { RuleFilterBar } from './rule-filter-bar';
import type { RuleFilters } from './types';

const t = messages.putawayRule;

/** 품목 칸(`ItemSelect`)은 펼칠 때 품목 목록을 쪽 단위로 부른다. */
const itemRows = [
  { itemId: 9101, itemCode: 'SYN-ITEM-01', itemName: '합성품목 가', isActive: true },
  { itemId: 9102, itemCode: 'SYN-ITEM-02', itemName: '합성품목 나', isActive: true },
];
const fetch = createStubFetch([
  {
    match: (request) => new URL(request.url).pathname === '/mdm/items',
    respond: () =>
      jsonResponse({ items: itemRows, page: { page: 1, size: 50, total: itemRows.length } }),
  },
]);

const renderBar = (
  appliedFilters: RuleFilters = DEFAULT_FILTERS,
  overrides: Partial<Parameters<typeof RuleFilterBar>[0]> = {},
) => {
  const onApply = vi.fn();
  const onReset = vi.fn();

  renderWithProviders(
    <RuleFilterBar
      appliedFilters={appliedFilters}
      onApply={onApply}
      onReset={onReset}
      {...overrides}
    />,
    { fetch, session: null },
  );

  return { onApply, onReset, user: userEvent.setup() };
};

const selectOption = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  optionLabel: string,
): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: optionLabel }));
};

describe('RuleFilterBar', () => {
  it('조건 칩 줄이 없다 — 걸린 조건은 칸에 보인다(입고 관리 짜임)', () => {
    renderBar({ ...DEFAULT_FILTERS, warehouseId: '9201' });

    expect(screen.queryByRole('button', { name: /조건 제거|해제/u })).not.toBeInTheDocument();
  });

  it('받은 화면 단추를 줄 끝에 둔다', () => {
    renderBar(DEFAULT_FILTERS, { actions: <button type="button">합성 단추</button> });

    expect(screen.getByRole('button', { name: '합성 단추' })).toBeInTheDocument();
  });

  /** 창고 상세의 탭이라 창고는 고르지 않는다 — 품목 · 사용 중만 두 조건만 둔다. */
  it('품목·사용 중만 두 조건이 서고 창고 칸은 없다', () => {
    renderBar({ ...DEFAULT_FILTERS, warehouseId: '9201' });

    expect(screen.queryByRole('combobox', { name: t.fields.warehouse })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.item })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: t.filters.activeOnly })).toBeInTheDocument();
  });

  it('품목 칸은 잠기지 않는다', () => {
    renderBar({ warehouseId: '9201', itemId: '', activeOnly: false });

    expect(screen.getByRole('combobox', { name: t.fields.item })).toBeEnabled();
    expect(screen.queryByText(t.filters.itemNeedsWarehouse)).not.toBeInTheDocument();
  });

  /** 한 번 고른 품목을 해제할 방법이 칸 안에 있어야 한다. */
  it('품목 선택지에 「전체」가 함께 선다', async () => {
    const { user } = renderBar({ warehouseId: '9201', itemId: '', activeOnly: false });

    await user.click(screen.getByRole('combobox', { name: t.fields.item }));

    expect(await screen.findByRole('option', { name: t.filters.all })).toBeInTheDocument();
  });

  it('품목을 고르면 곧바로 적용한다', async () => {
    const { onApply, user } = renderBar({
      warehouseId: '9201',
      itemId: '',
      activeOnly: false,
    });

    await selectOption(user, t.fields.item, 'SYN-ITEM-01 · 합성품목 가');

    expect(onApply).toHaveBeenCalledWith({
      warehouseId: '9201',
      itemId: '9101',
      activeOnly: false,
    });
  });

  /** 해제 축이라 변경 즉시 적용한다 — 「조회」를 기다리게 하면 켠 것이 반영되지 않은 채 남는다. */
  it('사용 중만을 켜면 곧바로 적용한다', async () => {
    const { onApply, user } = renderBar({
      warehouseId: '9201',
      itemId: '',
      activeOnly: false,
    });

    await user.click(screen.getByRole('checkbox', { name: t.filters.activeOnly }));

    expect(onApply).toHaveBeenCalledWith({
      warehouseId: '9201',
      itemId: '',
      activeOnly: true,
    });
  });

  it('초기화가 조건 전부를 되돌린다', async () => {
    const { onReset, user } = renderBar({
      warehouseId: '9201',
      itemId: '9101',
      activeOnly: true,
    });

    await user.click(screen.getByRole('button', { name: messages.common.reset }));

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
