import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StatusFilter, type StatusFilterProps } from './status-filter';

const t = messages.workOrderProgress.summary;

const LABELS: Record<string, string> = { SYN_PLAN: '편성', SYN_RUN: '진행', SYN_DONE: '완료' };

const renderFilter = (overrides: Partial<StatusFilterProps> = {}) => {
  const onSelect = vi.fn();
  render(
    <StatusFilter
      counts={{ SYN_RUN: 2, SYN_PLAN: 3, SYN_DONE: 0 }}
      labelOf={(code) => LABELS[code] ?? code}
      order={['SYN_PLAN', 'SYN_RUN', 'SYN_DONE']}
      selected=""
      total={5}
      onSelect={onSelect}
      {...overrides}
    />,
  );

  const group = screen.getByRole('group', { name: t.statusLabel });

  return {
    onSelect,
    user: userEvent.setup(),
    names: () =>
      within(group)
        .getAllByRole('button')
        .map((chip) => chip.textContent),
    chip: (name: string) => within(group).getByRole('button', { name }),
  };
};

describe('StatusFilter', () => {
  it('「전체」와 상태를 마스터 순서로, 이름과 건수로 놓는다', () => {
    const { names } = renderFilter();

    expect(names()).toEqual(['전체 5', '편성 3', '진행 2']);
  });

  it('0 건인 상태는 두지 않는다', () => {
    const { names } = renderFilter();

    expect(names()).not.toContain('완료 0');
  });

  /* ⛔ 풀 수단이 사라지면 안 된다 — 조건을 좁혀 0 건이 돼도 걸린 칩은 남는다. */
  it('⛔ 걸려 있는 상태는 0 건이어도 남긴다', () => {
    const { names, chip } = renderFilter({ selected: 'SYN_DONE' });

    expect(names()).toContain('완료 0');
    expect(chip('완료 0')).toHaveAttribute('aria-pressed', 'true');
    expect(chip('전체 5')).toHaveAttribute('aria-pressed', 'false');
  });

  it('고르지 않았으면 「전체」가 걸려 있다', () => {
    const { chip } = renderFilter();

    expect(chip('전체 5')).toHaveAttribute('aria-pressed', 'true');
  });

  it('칩을 누르면 그 상태를, 「전체」를 누르면 빈 값을 알린다', async () => {
    const { onSelect, user, chip } = renderFilter({ selected: 'SYN_RUN' });

    await user.click(chip('편성 3'));
    expect(onSelect).toHaveBeenLastCalledWith('SYN_PLAN');

    await user.click(chip('전체 5'));
    expect(onSelect).toHaveBeenLastCalledWith('');
  });

  it('고른 칩을 다시 누르면 「전체」로 돌아간다', async () => {
    const { onSelect, user, chip } = renderFilter({ selected: 'SYN_RUN' });

    await user.click(chip('진행 2'));

    expect(onSelect).toHaveBeenCalledWith('');
  });

  /* ⛔ G-8 — 상태 값 목록은 서버가 정한다. 마스터에 없는 코드도 칩에서 빠지지 않는다. */
  it('⛔ 마스터에 없는 상태 코드도 받은 그대로 칩이 된다', () => {
    const { names } = renderFilter({ counts: { SYN_RUN: 2, SYN_NEW: 1 }, total: 3 });

    expect(names()).toEqual(['전체 3', '진행 2', 'SYN_NEW 1']);
  });

  /* 건수를 못 받았다고 0 으로 적지 않는다 — 모르는 수다. */
  it('건수를 아직 못 받았으면 수 없이 「전체」와 걸린 상태만 둔다', () => {
    const { names } = renderFilter({ counts: undefined, total: undefined, selected: 'SYN_RUN' });

    expect(names()).toEqual(['전체', '진행']);
  });

  it('색은 상태마다 정해진 것을 쓰고, 모르는 상태는 중립이다', () => {
    const { chip } = renderFilter({ counts: { IN_PROGRESS: 1, SYN_RUN: 2 }, total: 3 });

    expect(chip('IN_PROGRESS 1')).toHaveClass('count-chip-success');
    expect(chip('진행 2')).toHaveClass('count-chip-idle');
  });
});
