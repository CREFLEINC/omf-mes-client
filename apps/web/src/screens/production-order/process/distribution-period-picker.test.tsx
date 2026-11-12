import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/api-harness';
import { plantToday } from '../../../patterns/plant-time';
import { DistributionPeriodPicker } from './distribution-period-picker';

describe('분배 기간 선택', () => {
  it('오늘로 이동은 표시 월만 변경하고 기간을 적용하지 않는다', async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DistributionPeriodPicker
        label="분배 기간"
        value={['2099-01-03', '2099-01-09']}
        disabled={false}
        onChange={change}
      />,
    );
    await user.click(screen.getByRole('button', { name: '분배 기간' }));
    const dialog = screen.getByRole('dialog', { name: '분배 기간' });
    await user.click(within(dialog).getByRole('button', { name: '오늘로 이동' }));
    expect(within(dialog).getByRole('button', { name: plantToday() })).toBeVisible();
    expect(dialog.querySelector('[aria-current="date"]')).toBeNull();
    expect(change).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    expect(screen.getByRole('button', { name: '분배 기간' })).toHaveTextContent(
      '2099-01-03 ~ 2099-01-09',
    );
  });
  it('두 날짜를 선택해야 반영하고 이전 날짜를 누르면 시작일을 다시 지정한다', async () => {
    const change = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <DistributionPeriodPicker
        label="분배 기간"
        value={['2099-01-03', '2099-01-09']}
        disabled={false}
        onChange={change}
      />,
    );
    await user.click(screen.getByRole('button', { name: '분배 기간' }));
    await user.click(screen.getByRole('button', { name: '2099-01-15' }));
    expect(change).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '2099-01-12' }));
    expect(change).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '2099-01-18' }));
    expect(change).toHaveBeenCalledExactlyOnceWith(['2099-01-12', '2099-01-18']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
