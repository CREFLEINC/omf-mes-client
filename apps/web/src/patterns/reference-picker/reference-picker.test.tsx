import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { ReferenceField, type ReferenceSource } from './reference-picker';

const t = messages.screenPatterns.referencePicker;

const source = (search = vi.fn()): ReferenceSource => ({
  title: '생산 라인 선택',
  key: ['test-line'],
  columns: { code: '라인 코드', name: '라인명' },
  search: search.mockResolvedValue({
    items: [
      { id: 1, code: 'LN-A', name: '사출 A라인' },
      { id: 2, code: 'LN-B', name: '조립 B라인' },
    ],
    total: 2,
  }),
});

describe('ReferenceField와 PickerDialog(C-12)', () => {
  it('칸을 누르면 팝업이 열리고, 행을 눌러 고른 뒤 [선택]으로 채운다', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    renderWithProviders(
      <ReferenceField
        label="생산 라인"
        valueLabel=""
        source={source()}
        onPick={onPick}
        onClear={vi.fn()}
      />,
    );
    const field = screen.getByLabelText('생산 라인');
    expect(field).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(field);
    const dialog = await screen.findByRole('dialog', { name: '생산 라인 선택' });
    const pick = within(dialog).getByRole('button', { name: t.pick });
    expect(pick).toBeDisabled();
    expect(pick).toHaveAccessibleDescription(t.pickReason);
    await user.click(await within(dialog).findByText('조립 B라인'));
    await user.click(pick);
    expect(onPick).toHaveBeenCalledWith({ id: 2, code: 'LN-B', name: '조립 B라인' });
  });

  it('검색어로 다시 찾는다(Enter로도)', async () => {
    const user = userEvent.setup();
    const search = vi.fn();
    renderWithProviders(
      <ReferenceField
        label="생산 라인"
        valueLabel=""
        source={source(search)}
        onPick={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText('생산 라인'));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(t.keyword), '조립{Enter}');
    expect(search).toHaveBeenLastCalledWith('조립', 1, '');
  });
});
