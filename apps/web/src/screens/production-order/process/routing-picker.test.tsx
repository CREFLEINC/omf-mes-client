import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, jsonResponse } from '../../../test/api-harness';
import { RoutingPicker } from './routing-picker';

const options = [
  { value: '21', label: 'R1 Rev 1', isDefault: true },
  { value: '22', label: 'R2 Rev 2' },
];
describe('Routing 상세 목록 선택', () => {
  it('공정 조건을 비교하고 선택 적용할 때만 개정을 변경한다', async () => {
    const change = vi.fn();
    renderWithProviders(<RoutingPicker options={options} value="21" onChange={change} />, {
      fetch: async (request) => {
        expect(request.method).toBe('GET');
        return jsonResponse({
          items: [
            {
              routingOperationId: 1,
              operationSeq: 10,
              operationName: request.url.includes('/21/') ? '사출' : '검사',
              equipmentRequired: true,
              standardCycleTimeSec: 45,
            },
          ],
        });
      },
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Routing 선택' }));
    const dialog = screen.getByRole('dialog', { name: 'Routing 선택' });
    await within(dialog).findByText('검사');
    expect(within(dialog).getAllByText('45초')).toHaveLength(2);
    expect(within(dialog).getAllByText('설비 필수')).toHaveLength(2);
    await user.click(within(dialog).getByRole('radio', { name: 'R2 Rev 2' }));
    expect(change).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: '취소' }));
    await user.click(screen.getByRole('button', { name: 'Routing 선택' }));
    expect(screen.getByRole('radio', { name: /R1 Rev 1/ })).toBeChecked();
    await user.click(screen.getByRole('radio', { name: 'R2 Rev 2' }));
    await user.click(screen.getByRole('button', { name: '선택 적용' }));
    expect(change).toHaveBeenCalledExactlyOnceWith('22');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('공정이 없는 개정은 적용할 수 없다', async () => {
    renderWithProviders(<RoutingPicker options={options} value="21" onChange={vi.fn()} />, {
      fetch: async () => jsonResponse({ items: [] }),
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Routing 선택' }));
    await screen.findAllByText('등록된 공정이 없습니다.');
    expect(screen.getByRole('button', { name: '선택 적용' })).toBeDisabled();
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });
});
