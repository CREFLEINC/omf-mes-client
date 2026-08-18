import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_FILTERS } from './filters';
import { RuleFilterBar } from './rule-filter-bar';
import type { RuleFilters, SelectOption } from './types';

const t = messages.putawayRule;

/** 미사용 표식이 붙은 선택지의 이름. **한 파일 안에서 이 문자열을 짓는 자리는 여기 하나다.** */
const INACTIVE_WAREHOUSE_OPTION_LABEL = `SYN-WH-02 · 합성창고 나${t.values.inactiveSuffix}`;

const warehouseOptions: SelectOption[] = [
  { value: '9201', label: 'SYN-WH-01 · 합성창고 가' },
  { value: '9202', label: INACTIVE_WAREHOUSE_OPTION_LABEL },
];

const itemOptions: SelectOption[] = [
  { value: '9101', label: 'SYN-ITEM-01 · 합성품목 가' },
  { value: '9102', label: 'SYN-ITEM-02 · 합성품목 나' },
];

const renderBar = (
  appliedFilters: RuleFilters = DEFAULT_FILTERS,
  overrides: Partial<Parameters<typeof RuleFilterBar>[0]> = {},
) => {
  const onApply = vi.fn();
  const onRemoveFilter = vi.fn();
  const onReset = vi.fn();

  render(
    <RuleFilterBar
      appliedFilters={appliedFilters}
      warehouseOptions={warehouseOptions}
      itemOptions={itemOptions}
      warehouseLabel={(id) => `창고${id}`}
      itemLabel={(id) => `품목${id}`}
      onApply={onApply}
      onRemoveFilter={onRemoveFilter}
      onReset={onReset}
      {...overrides}
    />,
  );

  return { onApply, onRemoveFilter, onReset, user: userEvent.setup() };
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
  it('창고·품목·사용 중만 세 조건이 선다', () => {
    renderBar();

    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.item })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: t.filters.activeOnly })).toBeInTheDocument();
  });

  /**
   * 창고를 고르는 것은 이 화면이 서는 조건이므로 **즉시 적용한다** — 「조회」를 한 번 더 눌러야
   * 목록이 서면, 화면이 비어 있는 이유가 「창고를 안 골랐다」인지 「안 눌렀다」인지 갈린다.
   */
  it('창고를 고르면 곧바로 적용한다', async () => {
    const { onApply, user } = renderBar();

    await selectOption(user, t.fields.warehouse, 'SYN-WH-01 · 합성창고 가');

    expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, warehouseId: '9201' });
  });

  /** 창고를 바꾸면 앞 창고에서 고른 품목은 이 창고의 조건이 아니다 — 함께 비운다. */
  it('창고를 바꾸면 품목 조건이 함께 풀린다', async () => {
    const { onApply, user } = renderBar({
      warehouseId: '9201',
      itemId: '9101',
      activeOnly: false,
    });

    await selectOption(user, t.fields.warehouse, INACTIVE_WAREHOUSE_OPTION_LABEL);

    expect(onApply).toHaveBeenCalledWith({
      warehouseId: '9202',
      itemId: '',
      activeOnly: false,
    });
  });

  /**
   * **창고를 고르기 전에는 품목 칸이 잠긴다.** 좁힐 대상이 없고, 품목 선택지도 창고를 고른
   * 뒤에 온다. 잠근 사실만 두면 사용자가 무엇을 하면 풀리는지 모르므로 사유를 함께 낸다.
   */
  it('창고를 고르기 전에는 품목 칸이 잠기고 사유가 보인다', () => {
    renderBar(DEFAULT_FILTERS, { itemOptions: [] });

    expect(screen.getByRole('combobox', { name: t.fields.item })).toBeDisabled();
    expect(screen.getByText(t.filters.itemNeedsWarehouse)).toBeInTheDocument();
  });

  it('창고를 고른 뒤에는 품목 칸이 열린다', () => {
    renderBar({ warehouseId: '9201', itemId: '', activeOnly: false });

    expect(screen.getByRole('combobox', { name: t.fields.item })).toBeEnabled();
  });

  /**
   * **선택지가 0건이면 「전체」도 붙이지 않는다.** 고를 것이 하나도 없는데 「전체」만 있으면
   * 「전체를 고를 수 있다 = 목록이 준비됐다」로 읽힌다 — 실제로는 값이 하나도 오지 않은 상태다.
   */
  it.each([
    ['창고', t.fields.warehouse, { warehouseOptions: [] }],
    ['품목', t.fields.item, { itemOptions: [] }],
  ])('%s 선택지가 0건이면 「전체」도 붙이지 않는다', async (_axis, label, overrides) => {
    const { user } = renderBar({ warehouseId: '9201', itemId: '', activeOnly: false }, overrides);

    await user.click(screen.getByRole('combobox', { name: label }));

    expect(screen.queryByRole('option', { name: t.filters.all })).not.toBeInTheDocument();
  });

  /**
   * ⛔ **0건이라는 이유만으로 「없습니다」를 짓지 않는다.**
   *
   * 이 부품이 볼 수 있는 것은 배열 길이뿐이고, 그 길이는 **미도착·실패·조회가 열리지도 않은
   * 상태**에서도 0이다 — 이유를 아는 것은 조회 상태를 든 화면뿐이다. 자리표시를 받지 않았으면
   * 아무 말도 하지 않아야 하며, 그래야 판정이 화면 한 곳에만 산다.
   */
  it('자리표시를 받지 않으면 0건이어도 아무 말도 하지 않는다', () => {
    renderBar(DEFAULT_FILTERS, { warehouseOptions: [], itemOptions: [] });

    /* 두 칸 모두 — 어느 축에서도 부품이 문장을 지어내지 않는다. */
    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).not.toHaveTextContent(
      t.filters.noWarehouseOptions,
    );
    expect(screen.getByRole('combobox', { name: t.fields.item })).not.toHaveTextContent(
      t.filters.noItemOptions,
    );
  });

  /** 받은 자리표시는 그대로 그린다 — 짓지는 않되 전달은 끊기지 않아야 한다. */
  it('받은 자리표시를 그대로 그린다', () => {
    renderBar(DEFAULT_FILTERS, {
      warehouseOptions: [],
      warehousePlaceholder: t.filters.noWarehouseOptions,
    });

    expect(screen.getByRole('combobox', { name: t.fields.warehouse })).toHaveTextContent(
      t.filters.noWarehouseOptions,
    );
  });

  /** 선택지가 있으면 「전체」가 서야 한다 — 한 번 고른 뒤 해제할 방법이 칸 안에 있어야 한다. */
  it('선택지가 있으면 「전체」가 함께 선다', async () => {
    const { user } = renderBar();

    await user.click(screen.getByRole('combobox', { name: t.fields.warehouse }));

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

  it('적용된 조건마다 칩이 서고 ×가 그 조건만 푼다', async () => {
    const { onRemoveFilter, user } = renderBar({
      warehouseId: '9201',
      itemId: '9101',
      activeOnly: true,
    });

    expect(screen.getByText(t.filters.chipWarehouse('창고9201'))).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: t.filters.chipRemoveItem }));

    expect(onRemoveFilter).toHaveBeenCalledWith('itemId');
  });

  it('조건이 없으면 칩도 없다', () => {
    renderBar();

    expect(
      screen.queryByRole('button', { name: t.filters.chipRemoveWarehouse }),
    ).not.toBeInTheDocument();
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

  /** 밝히지 않으면 사용자가 불완전한 목록을 완전한 것으로 읽고 「그런 창고가 없다」로 결론짓는다. */
  it('선택지의 한계를 안내로 밝힌다', () => {
    renderBar(DEFAULT_FILTERS, { warehouseNote: t.filters.lookupTruncated });

    expect(screen.getByText(t.filters.lookupTruncated)).toBeInTheDocument();
  });
});
