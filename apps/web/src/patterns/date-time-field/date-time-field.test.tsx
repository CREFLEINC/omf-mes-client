import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/api-harness';
import { DateTimeField } from './date-time-field';

describe('일시의 시·분 선택', () => {
  it('날짜를 유지하고 시와 분을 모두 선택한 뒤에만 변경한다', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithProviders(
      <DateTimeField timePicker label="계획 시작" value="2026-11-16T08:00" onChange={onChange} />,
    );
    /* 시각은 칸에 바로 칠 수도 있고(24시간), 시계 아이콘으로 고르기 창을 열 수도 있다(omf-all-around#360). */
    expect(screen.getByRole('textbox', { name: '계획 시작 시각' })).toHaveValue('08:00');
    await user.click(screen.getByRole('button', { name: '계획 시작 시각 고르기' }));
    await user.click(
      within(screen.getByRole('listbox', { name: '계획 시작 (시)' })).getByRole('option', {
        name: '09',
      }),
    );
    expect(onChange).not.toHaveBeenCalled();
    await user.click(
      within(screen.getByRole('listbox', { name: '계획 시작 (분)' })).getByRole('option', {
        name: '30',
      }),
    );
    expect(onChange).toHaveBeenCalledWith('2026-11-16T09:30');
    expect(screen.queryByRole('dialog', { name: '계획 시작 시각' })).toBeNull();
  });
  it('완료된 건은 시간 선택도 잠근다', () => {
    renderWithProviders(
      <DateTimeField
        timePicker
        disabled
        label="계획 종료"
        value="2026-11-16T17:00"
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole('textbox', { name: '계획 종료 시각' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '계획 종료 시각 고르기' })).toBeDisabled();
  });
});
