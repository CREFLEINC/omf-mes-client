import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../test/api-harness';
import { PopSelect } from './pop-select';

const OPTIONS = Array.from({ length: 7 }, (_, index) => ({
  value: `value-${String(index + 1)}`,
  label: `항목 ${String(index + 1)}`,
}));

describe('PopSelect — 항목 뒤 표시·맨 위 묶음(D-10)', () => {
  it('US3-6 항목 뒤 표시를 주면 그 항목 안 이름 뒤에 선다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PopSelect
        aria-label="사유"
        options={OPTIONS}
        value={null}
        onChange={vi.fn()}
        optionTrailing={(option) => (option.value === 'value-2' ? <b>표시</b> : null)}
      />,
    );

    await user.click(screen.getByRole('combobox', { name: '사유' }));
    expect(
      within(screen.getByRole('option', { name: /항목 2/ })).getByText('표시'),
    ).toBeInTheDocument();
    expect(within(screen.getByRole('option', { name: '항목 1' })).queryByText('표시')).toBeNull();
  });

  it('맨 위 묶음에서 고르면 목록에서 고른 것과 같이 값을 내고 닫는다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <PopSelect
        aria-label="사유"
        options={OPTIONS}
        value={null}
        onChange={onChange}
        actionBadge={<i>점</i>}
        dialogLead={(choose) => (
          <button type="button" onClick={() => choose('value-7')}>
            바로 가기
          </button>
        )}
      />,
    );

    expect(
      within(screen.getByRole('combobox', { name: '사유' })).getByText('점'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: '사유' }));
    await user.click(screen.getByRole('button', { name: '바로 가기' }));

    expect(onChange).toHaveBeenCalledWith('value-7');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('세 속성을 주지 않으면 항목·단추·창이 지금과 같다(18곳 불변)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PopSelect aria-label="사유" options={OPTIONS} value={null} onChange={vi.fn()} />,
    );

    const trigger = screen.getByRole('combobox', { name: '사유' });
    expect(trigger).toHaveTextContent(/^선택$/);
    await user.click(trigger);
    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      '항목 1',
      '항목 2',
      '항목 3',
      '항목 4',
      '항목 5',
    ]);
    const list = screen.getByRole('listbox');
    expect(list.previousElementSibling).toHaveClass('pop-select-dialog__search');
  });
});
