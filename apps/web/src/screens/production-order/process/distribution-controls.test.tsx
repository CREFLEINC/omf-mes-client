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
  it('표 머리글에서 전체 선택·해제하고 일부 선택 상태를 표시한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <DistributionControls
        orders={[...orders, { ...orders[0]!, id: 'B', label: 'ERP W/O B' }]}
        existing={[]}
        disabled={false}
        onApply={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: '자동 분배' }));
    const all = screen.getByRole('checkbox', { name: '분배 조건 전체 선택' });
    expect(all).toBeVisible();
    await user.click(all);
    expect(screen.getByRole('checkbox', { name: '분배 조건 1 선택' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'ERP W/O B 전체 선택' })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: 'ERP W/O B 전체 선택' }));
    expect(all).toBePartiallyChecked();
    await user.click(all);
    expect(all).toBeChecked();
    await user.click(all);
    expect(screen.getByRole('checkbox', { name: '분배 조건 1 선택' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'ERP W/O B 전체 선택' })).not.toBeChecked();
    expect(screen.getByRole('heading', { name: 'ERP W/O A / 품목 A' })).toBeVisible();
  });
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
    expect(screen.getByLabelText('조건 1 분배 기간')).toHaveTextContent('2099-11-10');
    expect(screen.getByLabelText('조건 1 분배 기간')).toHaveTextContent('2099-11-16');
    expect(
      screen
        .getByRole('button', { name: '조건 1 생산 라인 선택' })
        .closest('.erp-wo-distribution-line-field'),
    ).toHaveTextContent('라인 1');
    const quantity = screen.getByRole('textbox', { name: '조건 1 수량' });
    await user.clear(quantity);
    await user.type(quantity, '2');
    expect(screen.getByRole('dialog', { name: '자동 분배' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '편성 화면으로' }));
    expect(screen.queryByRole('dialog', { name: '자동 분배' })).toBeNull();
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
    await user.click(screen.getByRole('row', { name: 'ERP W/O B / 품목 B 분배 조건' }));
    expect(screen.queryByLabelText('조건 1 수량')).toBeNull();
    const quantity = screen.getByRole('textbox', { name: '조건 2 수량' });
    await user.clear(quantity);
    await user.type(quantity, '2');
    await user.click(screen.getByRole('button', { name: '분배 미리보기' }));
    expect(screen.queryByRole('textbox', { name: '조건 2 수량' })).toBeNull();
    expect(screen.queryByRole('button', { name: '분배 미리보기' })).toBeNull();
    expect(screen.getByRole('region', { name: '분배 미리보기 결과' })).toBeVisible();
    /* 라인 합계가 무엇을 세는지는 늘 펼쳐 두지 않고 제목 옆 ⓘ 로 읽힌다. */
    expect(
      screen.getByRole('button', {
        name: '선택한 ERP W/O의 계획만 집계합니다. 생산능력 검증 결과는 아닙니다.',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('선택한 ERP W/O의 계획만 집계합니다. 생산능력 검증 결과는 아닙니다.'),
    ).toBeNull();
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
    await user.click(screen.getByRole('button', { name: 'ERP W/O 6' }));
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
    expect(
      within(dialog).getByText(/균등 배분은 기존 휴일 설정을 적용해 휴일을 제외/),
    ).toBeVisible();
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
    expect(screen.queryByRole('dialog', { name: '자동 분배' })).toBeNull();
    await user.click(screen.getByRole('button', { name: '자동 분배' }));
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
          { ...orders[0]!, startDate: '2027-01-04' },
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
    expect(screen.getByRole('heading', { name: /^선택 항목 일괄 입력/ })).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: '분배 조건 1 선택' }));
    await user.click(screen.getByRole('button', { name: '공통 생산 라인 선택' }));
    await user.click(
      within(await screen.findByRole('dialog', { name: '생산 라인 선택' })).getByText('라인 1', {
        exact: true,
      }),
    );
    await user.click(screen.getByRole('button', { name: '선택' }));
    expect(screen.getByRole('button', { name: '공통 분배 기간' })).toHaveTextContent(
      '변경하지 않음',
    );
    await user.click(screen.getByRole('button', { name: '선택 항목에 적용' }));
    expect(screen.getByRole('button', { name: '조건 1 분배 기간' })).toHaveTextContent(
      '2027-01-04',
    );
    expect(
      screen
        .getByRole('button', { name: '조건 1 생산 라인 선택' })
        .closest('.erp-wo-distribution-line-field'),
    ).toHaveTextContent('라인 1');
    await user.click(screen.getByRole('row', { name: 'ERP W/O B / 품목 B 분배 조건' }));
    expect(
      screen
        .getByRole('button', { name: '조건 2 생산 라인 선택' })
        .closest('.erp-wo-distribution-line-field'),
    ).not.toHaveTextContent('라인 1');
  });
});

it('휴일 0 수량을 직접 수정하면 사용자 지정 계획으로 적용하고 합계를 보존한다', async () => {
  const { planningDaysResponse } = await import('../../../test/planning-day-fixture');
  const onApply = vi.fn();
  renderWithProviders(
    <DistributionControls
      orders={[{ ...orders[0]!, plantId: 1 }]}
      existing={[]}
      disabled={false}
      onApply={onApply}
    />,
    {
      fetch: (request) =>
        planningDaysResponse(request, (date) =>
          [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 'HOLIDAY' : 'WORKING',
        ),
    },
  );
  const user = await configure();
  expect(await screen.findAllByText('주말 · 휴일')).not.toHaveLength(0);
  const resultTable = screen.getByRole('table', { name: '날짜와 라인별 결과' });
  const holidayRow = within(resultTable).getAllByText('주말 · 휴일')[0]!.closest('tr')!;
  const holidayInput = within(holidayRow).getByRole('textbox');
  const weekdayInput = within(resultTable)
    .getAllByRole('textbox')
    .find((input) => Number((input as HTMLInputElement).value) > 0)!;
  await user.clear(holidayInput);
  await user.type(holidayInput, '1');
  expect(screen.getByRole('button', { name: '분배안 적용' })).toBeDisabled();
  await user.clear(weekdayInput);
  await user.type(weekdayInput, '0');

  await user.click(screen.getByRole('button', { name: '분배안 적용' }));
  expect(onApply).toHaveBeenCalledOnce();
  expect(onApply.mock.calls[0]![0]).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        planDate: holidayInput.getAttribute('aria-label')!.split(' ')[1],
        plannedQty: '1',
        planDateSourceCode: 'USER',
      }),
    ]),
  );
  expect(
    onApply.mock.calls[0]![0].every((row: { plannedQty: string }) => Number(row.plannedQty) > 0),
  ).toBe(true);
  expect(
    onApply.mock.calls[0]![0].reduce(
      (sum: number, row: { plannedQty: string }) => sum + Number(row.plannedQty),
      0,
    ),
  ).toBe(3);
});

it('공통 휴일 설정은 선택한 조건만 바꾸며 기간은 유지한다', async () => {
  const user = userEvent.setup();
  renderWithProviders(
    <DistributionControls
      orders={[...orders, { ...orders[0]!, id: 'B', label: 'ERP W/O B' }]}
      existing={[]}
      disabled={false}
      onApply={() => {}}
    />,
  );
  await user.click(screen.getByRole('button', { name: '자동 분배' }));
  expect(screen.getByRole('button', { name: '선택 항목에 적용' })).toBeDisabled();
  await user.click(screen.getByRole('checkbox', { name: '분배 조건 1 선택' }));
  await user.click(screen.getByRole('combobox', { name: '공통 휴일 편성' }));
  await user.click(screen.getByRole('option', { name: /^포함$/ }));
  await user.click(screen.getByRole('button', { name: '선택 항목에 적용' }));
  expect(screen.getByRole('checkbox', { name: '분배 조건 1 휴일 포함' })).toBeChecked();
  expect(screen.getByRole('button', { name: '공통 분배 기간' })).toHaveTextContent('변경하지 않음');
  await user.click(screen.getByRole('button', { name: 'ERP W/O B' }));
  expect(screen.getByRole('checkbox', { name: '분배 조건 2 휴일 포함' })).not.toBeChecked();
});

it('ERP W/O의 여러 조건을 같은 화면에서 편집하고 분배 수량이 없는 대상의 추가를 막는다', async () => {
  const user = userEvent.setup();
  renderWithProviders(
    <DistributionControls
      orders={[...orders, { ...orders[0]!, id: 'B', label: 'ERP W/O B', pending: 0 }]}
      existing={[]}
      disabled={false}
      onApply={() => {}}
    />,
  );
  await user.click(screen.getByRole('button', { name: '자동 분배' }));
  await user.click(screen.getByRole('button', { name: '분배 조건 추가' }));
  expect(screen.getAllByRole('group', { name: /^분배 조건 \d+$/ })).toHaveLength(2);
  await user.clear(screen.getByRole('textbox', { name: '조건 1 수량' }));
  await user.type(screen.getByRole('textbox', { name: '조건 1 수량' }), '2');
  await user.clear(screen.getByRole('textbox', { name: '조건 2 수량' }));
  await user.type(screen.getByRole('textbox', { name: '조건 2 수량' }), '1');
  const row = screen.getByRole('row', { name: 'ERP W/O A / 품목 A 분배 조건' });
  expect(within(row).getAllByRole('cell')[3]).toHaveTextContent('3 EA');
  await user.click(screen.getByRole('button', { name: 'ERP W/O B' }));
  expect(screen.getByText('이 ERP W/O에 분배 조건이 없습니다.')).toBeVisible();
  expect(screen.getByRole('button', { name: '분배 조건 추가' })).toBeDisabled();
});
