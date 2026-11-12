import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../test/api-harness';
import { plantToday } from '../../../patterns/plant-time';
import { DistributionControls } from './distribution-controls';
import type { DistributionTarget } from './segmented-distribution-model';
const orders: DistributionTarget[] = [
  {
    id: 'A',
    label: 'ERP W/O A / 품목 A',
    unit: 'EA',
    pending: 3,
    decimalScale: 0,
    lines: [{ id: 31, name: '라인 1', code: 'L1' }],
  },
];
const configure = async () => {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: '자동 분배' }));
  await user.click(screen.getByRole('button', { name: '조건 1 생산 라인 선택' }));
  await user.click(
    within(await screen.findByRole('dialog', { name: '생산 라인 선택' })).getByText('라인 1', {
      exact: true,
    }),
  );
  await user.click(screen.getByRole('button', { name: '선택' }));
  await user.click(screen.getByRole('button', { name: '분배 미리보기' }));
  return user;
};
describe('분배 조건과 미리보기 적용', () => {
  it('ERP 시작일과 추천 라인을 채우고 사용자의 조건 변경은 다시 열어도 유지한다', async () => {
    const user = userEvent.setup();
    const apply = vi.fn();
    renderWithProviders(
      <DistributionControls
        orders={[{ ...orders[0]!, startDate: '2099-11-10', lineId: '31' }]}
        existing={[]}
        disabled={false}
        onApply={apply}
      />,
    );
    await user.click(screen.getByRole('button', { name: '자동 분배' }));
    expect(screen.getByLabelText('조건 1 시작일')).toHaveTextContent('2099-11-10');
    expect(screen.getByLabelText('조건 1 종료일')).toHaveTextContent('2099-11-16');
    expect(
      screen
        .getByRole('button', { name: '조건 1 생산 라인 선택' })
        .closest('.erp-wo-distribution-line-field'),
    ).toHaveTextContent('라인 1');
    const quantity = screen.getByRole('textbox', { name: '조건 1 수량' });
    await user.clear(quantity);
    await user.type(quantity, '2');
    await user.click(screen.getByRole('button', { name: '자동 분배' }));
    await user.click(screen.getByRole('button', { name: '자동 분배' }));
    expect(screen.getByRole('textbox', { name: '조건 1 수량' })).toHaveValue('2');
    expect(apply).not.toHaveBeenCalled();
  });
  it('조건은 하나만 편집하고 미리보기에서 돌아와도 입력을 유지한다', async () => {
    const apply = vi.fn();
    renderWithProviders(
      <DistributionControls
        orders={[...orders, { ...orders[0]!, id: 'B', label: 'ERP W/O B / 품목 B' }]}
        existing={[]}
        disabled={false}
        onApply={apply}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '자동 분배' }));
    expect(screen.getAllByRole('group', { name: /^분배 조건 \d+$/ })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: '조건 2' }));
    expect(screen.queryByLabelText('조건 1 수량')).toBeNull();
    const quantity = screen.getByRole('textbox', { name: '조건 2 수량' });
    await user.clear(quantity);
    await user.type(quantity, '2');
    await user.click(screen.getByRole('button', { name: '분배 미리보기' }));
    expect(screen.queryByRole('textbox', { name: '조건 2 수량' })).toBeNull();
    expect(screen.queryByRole('button', { name: '분배 미리보기' })).toBeNull();
    expect(screen.getByRole('region', { name: '분배 미리보기 결과' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '조건 수정' }));
    expect(screen.getByRole('textbox', { name: '조건 2 수량' })).toHaveValue('2');
    expect(screen.queryByRole('region', { name: '분배 미리보기 결과' })).toBeNull();
    expect(apply).not.toHaveBeenCalled();
  });
  it('조건과 결과 목록은 페이지로 나누되 적용 수량은 모든 페이지를 포함한다', async () => {
    const apply = vi.fn();
    const targets = Array.from({ length: 6 }, (_, i) => ({
      ...orders[0]!,
      id: `P${i}`,
      label: `ERP W/O ${i + 1}`,
    }));
    renderWithProviders(
      <DistributionControls orders={targets} existing={[]} disabled={false} onApply={apply} />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '자동 분배' }));
    expect(screen.queryByRole('button', { name: '조건 6' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(screen.getByRole('textbox', { name: '조건 6 수량' })).toHaveValue('3');
    await user.click(screen.getByRole('button', { name: '분배 미리보기' }));
    const table = screen.getByRole('table', { name: '날짜와 라인별 결과' });
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    await user.click(screen.getByRole('button', { name: '다음' }));
    expect(within(table).getAllByRole('row')).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: '분배안 적용' }));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]?.[0]).toHaveLength(18);
  });

  it('도움말은 조건과 계획을 변경하지 않고 열고 닫는다', async () => {
    const user = userEvent.setup();
    const apply = vi.fn();
    const dirty = vi.fn();
    renderWithProviders(
      <DistributionControls
        orders={orders}
        existing={[]}
        disabled={false}
        onApply={apply}
        onDirtyChange={dirty}
      />,
    );
    await user.click(screen.getByRole('button', { name: '자동 분배 도움말' }));
    const dialog = screen.getByRole('dialog', { name: '자동 분배 도움말' });
    expect(within(dialog).getByRole('heading', { name: '균등 배분' })).toBeVisible();
    expect(within(dialog).getByRole('heading', { name: '날짜별 수량' })).toBeVisible();
    expect(within(dialog).getByText('34 EA')).toBeVisible();
    expect(within(dialog).getByText(/주말과 공휴일도 포함/)).toBeVisible();
    expect(screen.getByRole('button', { name: '자동 분배' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(apply).not.toHaveBeenCalled();
    expect(dirty).not.toHaveBeenCalledWith(true);
    await user.click(within(dialog).getAllByRole('button', { name: '닫기' }).at(-1)!);
    expect(screen.queryByRole('dialog', { name: '자동 분배 도움말' })).toBeNull();
  });

  it('미리보기는 변경을 전송하지 않고 적용 후에만 계획을 추가하며 재실행을 막는다', async () => {
    const apply = vi.fn();
    renderWithProviders(
      <DistributionControls orders={orders} existing={[]} disabled={false} onApply={apply} />,
    );
    const user = await configure();
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: '분배 미리보기 결과' })).toHaveTextContent(
      'ERP W/O A / 품목 A',
    );
    await user.click(screen.getByRole('button', { name: '분배안 적용' }));
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls[0]?.[0]).toHaveLength(3);
    expect(screen.getByRole('button', { name: '분배 미리보기' })).toBeDisabled();
  });
  it('기존 계획과 겹치면 확인하기 전 적용하지 않는다', async () => {
    const apply = vi.fn();
    renderWithProviders(
      <DistributionControls
        orders={orders}
        existing={[{ owner: 'A', planDate: plantToday(), plannedLineId: '31', plannedQty: '1' }]}
        disabled={false}
        onApply={apply}
      />,
    );
    const user = await configure();
    expect(screen.getByRole('button', { name: '분배안 적용' })).toBeDisabled();
    await user.click(
      screen.getByRole('checkbox', { name: '중복 분배 조건과 기존 편성 내용을 확인했습니다.' }),
    );
    await user.click(screen.getByRole('button', { name: '분배안 적용' }));
    expect(apply).toHaveBeenCalledTimes(1);
  });
  it('미리보기 뒤 대상 수량이 바뀌면 기존 결과를 적용하지 않는다', async () => {
    const apply = vi.fn();
    const Harness = () => {
      const [pending, setPending] = useState(3);
      return (
        <>
          <button onClick={() => setPending(2)}>대상 수량 변경</button>
          <DistributionControls
            orders={[{ ...orders[0]!, pending }]}
            existing={[]}
            disabled={false}
            onApply={apply}
          />
        </>
      );
    };
    renderWithProviders(<Harness />);
    const user = await configure();
    await user.click(screen.getByRole('button', { name: '대상 수량 변경' }));
    expect(
      screen.getByText('계획이나 대상 수량이 바뀌었습니다. 미리보기를 다시 만드세요.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '분배안 적용' })).toBeDisabled();
    expect(apply).not.toHaveBeenCalled();
  });
  it('적용하지 않은 조건은 취소할 수 있고 편집 상태를 알린다', async () => {
    const dirty = vi.fn();
    renderWithProviders(
      <DistributionControls
        orders={orders}
        existing={[]}
        disabled={false}
        onApply={() => {}}
        onDirtyChange={dirty}
      />,
    );
    const user = await configure();
    expect(dirty).toHaveBeenLastCalledWith(true);
    await user.click(screen.getByRole('button', { name: '조건 변경 취소' }));
    expect(dirty).toHaveBeenLastCalledWith(false);
    expect(screen.queryByRole('region', { name: '분배 미리보기 결과' })).toBeNull();
  });
  it('공통 조건은 선택한 분배 조건에만 입력한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DistributionControls
        orders={[
          ...orders,
          {
            ...orders[0]!,
            id: 'B',
            label: 'ERP W/O B / 품목 B',
            lines: [...orders[0]!.lines, { id: 32, code: 'L2', name: '라인 2' }],
          },
        ]}
        existing={[]}
        disabled={false}
        onApply={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: '자동 분배' }));
    await user.click(screen.getByText('선택 조건에 공통 기간과 라인 입력', { exact: true }));
    await user.click(screen.getByRole('checkbox', { name: '분배 조건 1 선택' }));
    await user.click(screen.getByRole('button', { name: '공통 생산 라인 선택' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: '생산 라인 선택' })).getByText('라인 1', {
        exact: true,
      }),
    );
    await user.click(screen.getByRole('button', { name: '선택' }));
    await user.click(screen.getByRole('button', { name: '선택 조건에 입력' }));
    expect(
      screen
        .getByRole('button', { name: '조건 1 생산 라인 선택' })
        .closest('.erp-wo-distribution-line-field'),
    ).toHaveTextContent('라인 1');
    await user.click(screen.getByRole('button', { name: '조건 2' }));
    expect(
      screen
        .getByRole('button', { name: '조건 2 생산 라인 선택' })
        .closest('.erp-wo-distribution-line-field'),
    ).not.toHaveTextContent('라인 1');
  });
});
