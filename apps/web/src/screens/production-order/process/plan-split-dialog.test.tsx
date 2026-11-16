import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/api-harness';
import { appendProductionPlanRow } from '../../production-plan/editor-state';
import { PlanSplitDialog } from './plan-split-dialog';
const setup = () => {
  const onApply = vi.fn(),
    onClose = vi.fn();
  renderWithProviders(
    <PlanSplitDialog
      row={
        appendProductionPlanRow([], 'new', {
          plannedQty: '17000',
          planDate: '2026-11-13',
          bomId: '1',
          routingId: '2',
        })[0]!
      }
      planName="계획 A"
      identity={{ orderNo: 'ERP-A', itemCode: 'ITEM-A', itemName: '품목 A' }}
      lineName="라인 A"
      unit="EA"
      decimalScale={0}
      onApply={onApply}
      onClose={onClose}
    />,
  );
  return { onApply, onClose, user: userEvent.setup() };
};
it('조건 변경 시 이전 결과 적용을 막고 계획당 수량으로 나눈 잔량을 마지막 계획에 배분한다', async () => {
  const { user, onApply } = setup();
  await user.click(screen.getByRole('combobox', { name: '분할 방식' }));
  await user.click(screen.getByRole('option', { name: '계획당 생산량 지정' }));
  await user.type(screen.getByRole('textbox', { name: '계획당 생산량' }), '5000');
  expect(screen.getByRole('button', { name: '분할 적용' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '분할 조건 적용' }));
  expect(screen.getByRole('textbox', { name: '계획 4 생산량' })).toHaveValue('2000');
  await user.click(screen.getByRole('button', { name: '분할 적용' }));
  expect(onApply).toHaveBeenCalledWith([
    { plannedQty: '5000', planDate: '2026-11-13' },
    { plannedQty: '5000', planDate: '2026-11-14' },
    { plannedQty: '5000', planDate: '2026-11-15' },
    { plannedQty: '2000', planDate: '2026-11-16' },
  ]);
});
it('수량 부족·초과와 잘못된 소수 입력을 차단하고 취소는 편성 내용을 바꾸지 않는다', async () => {
  const { user, onApply, onClose } = setup();
  const input = screen.getByRole('textbox', { name: '계획 1 생산량' });
  await user.clear(input);
  await user.type(input, '18000');
  expect(screen.getByText('초과 수량')).toBeVisible();
  expect(screen.getByRole('button', { name: '분할 적용' })).toBeDisabled();
  await user.clear(input);
  await user.type(input, '5000');
  expect(screen.getByText('미배분 수량')).toBeVisible();
  await user.click(screen.getByRole('button', { name: '취소' }));
  expect(onClose).toHaveBeenCalledOnce();
  expect(onApply).not.toHaveBeenCalled();
});

it('처음에는 전체 생산량의 계획 1건만 표시하고 사용자가 직접 추가한다', async () => {
  const { user } = setup();
  expect(screen.getByRole('textbox', { name: '분할 후 계획 건수' })).toHaveValue('1');
  expect(screen.getByRole('textbox', { name: '계획 1 생산량' })).toHaveValue('17000');
  expect(screen.queryByRole('textbox', { name: '계획 2 생산량' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '분할 적용' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '계획 추가' }));
  expect(screen.getByRole('textbox', { name: '분할 후 계획 건수' })).toHaveValue('2');
  expect(screen.getByRole('textbox', { name: '계획 2 생산량' })).toHaveValue('');
  await user.clear(screen.getByRole('textbox', { name: '계획 1 생산량' }));
  await user.type(screen.getByRole('textbox', { name: '계획 1 생산량' }), '12000');
  await user.type(screen.getByRole('textbox', { name: '계획 2 생산량' }), '5000');
  expect(screen.getByRole('button', { name: '분할 적용' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: '계획 2 삭제' }));
  expect(screen.getByRole('textbox', { name: '분할 후 계획 건수' })).toHaveValue('1');
});
