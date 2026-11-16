import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../../test/api-harness';
import { WeeklyPlanCard } from './weekly-plan-card';
describe('주간 편성 요약 카드', () => {
  it('품목명·생산량·상태만 표시하고 번호와 코드는 상세로 넘긴다', async () => {
    const pick = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <WeeklyPlanCard
        planNo="PP-20990101-0001"
        orderNo="PD990101000001"
        itemCode="ITEM-001"
        itemName="시험 품목"
        quantity="1,000 EA"
        status="확정"
        confirmed
        selected
        label="계획 선택"
        controls="detail"
        onSelect={pick}
      />,
    );
    const card = screen.getByRole('button', { name: '계획 선택' });
    expect(within(card).getByText('시험 품목')).toBeVisible();
    expect(within(card).getByText('1,000 EA')).toBeVisible();
    expect(within(card).getByText('확정')).toBeVisible();
    expect(card).not.toHaveTextContent('PP-20990101-0001');
    expect(card).not.toHaveTextContent('PD990101000001');
    expect(card).not.toHaveTextContent('ITEM-001');
    await user.click(card);
    expect(pick).toHaveBeenCalledOnce();
  });
});
