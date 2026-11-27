import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@omf-mes/i18n';
import { renderWithProviders } from '../../../test/api-harness';
import {
  appendProductionPlanRow,
  changeProductionPlanRow,
} from '../../production-plan/editor-state';
import { PlanStep } from './plan-step';

const t = messages.erpWorkOrderFlow.process.plan;
const initialRows = () =>
  appendProductionPlanRow([], 'new-1', {
    planDate: '2026-11-02',
    plannedQty: '200',
    plannedLineId: '31',
    bomId: '11',
    routingId: '21',
  });

describe('생산계획 보기와 선택 편집', () => {
  it('보기 전환과 주 이동은 저장 요청 없이 같은 편집 수량을 유지한다', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    const Harness = () => {
      const [rows, setRows] = useState(initialRows);
      return (
        <PlanStep
          rows={rows}
          orderQty={300}
          confirmedQty={0}
          uomLabel="EA"
          plantId={null}
          lines={[{ id: 31, code: 'LN-31', name: '라인 A' }]}
          statusNameOf={(value) => value}
          disabled={false}
          failures={[]}
          onAdd={() => {}}
          onRemove={() => {}}
          onChange={(key, field, value) =>
            setRows((current) => changeProductionPlanRow(current, key, field, value))
          }
        />
      );
    };
    renderWithProviders(<Harness />, { fetch });
    expect(screen.queryByText(t.newRow(1), { exact: true })).toBeNull();
    const inputName = t.fieldLabel(t.newRow(1), t.columns.plannedQty);
    await user.clear(screen.getByRole('textbox', { name: inputName }));
    await user.type(screen.getByRole('textbox', { name: inputName }), '250');
    await user.click(screen.getByRole('button', { name: t.workspace.week }));
    expect(screen.getByRole('button', { name: t.workspace.selectPlan(t.newRow(1)) })).toBeVisible();
    await user.click(screen.getByRole('button', { name: t.workspace.nextWeek }));
    expect(screen.getByText(t.workspace.outsideWeek)).toBeVisible();
    await user.click(screen.getByRole('button', { name: t.workspace.grid }));
    expect(screen.getByRole('textbox', { name: inputName })).toHaveValue('250');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('복수 ERP W/O는 계획별 단위와 소속을 표시하고 단일 ERP W/O 합계를 표시하지 않는다', async () => {
    const user = userEvent.setup();
    const rows = [
      ...initialRows(),
      ...initialRows().map((row) => ({ ...row, key: 'second', displayNo: 2 })),
    ];
    renderWithProviders(
      <PlanStep
        rows={rows}
        orderQty={0}
        uomLabel=""
        rowUomLabelOf={(row) => (row.key === 'second' ? 'KG' : 'EA')}
        orderContextOf={(row) => <p>{row.key === 'second' ? 'ERP W/O B' : 'ERP W/O A'}</p>}
        hideTotals
        plantId={null}
        lines={[{ id: 31, code: 'LN-31', name: '라인 A' }]}
        statusNameOf={(value) => value}
        disabled={false}
        failures={[]}
        onAdd={() => {}}
        onRemove={() => {}}
        onChange={() => {}}
      />,
    );
    expect(document.querySelector('.erp-wo-plan-total')).toBeNull();
    expect(
      screen.getByRole('button', { name: t.workspace.selectPlan(t.newRow(1)) }),
    ).toHaveTextContent('200 EA');
    const second = screen.getByRole('button', { name: t.workspace.selectPlan(t.newRow(2)) });
    expect(second).toHaveTextContent('200 KG');
    await user.click(second);
    expect(screen.getByText('ERP W/O B')).toBeVisible();
    /* 단위는 생산량 칸 안에 붙는다. */
    expect(document.querySelector('.erp-wo-unit-suffix')).toHaveTextContent('KG');
  });

  it('고른 계획을 다시 누르면 편집이 풀리고 첫 계획을 다시 고르지 않는다 — 보던 주는 그대로', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PlanStep
        rows={initialRows()}
        orderQty={300}
        confirmedQty={0}
        uomLabel="EA"
        plantId={null}
        lines={[{ id: 31, code: 'LN-31', name: '라인 A' }]}
        statusNameOf={(value) => value}
        disabled={false}
        failures={[]}
        onAdd={() => {}}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    const editor = screen.getByRole('region', { name: t.workspace.editor });
    const inputName = t.fieldLabel(t.newRow(1), t.columns.plannedQty);
    expect(within(editor).getByRole('textbox', { name: inputName })).toBeVisible();
    expect(document.querySelector('.erp-wo-week-range')).toHaveTextContent(
      /2026-11-02.*2026-11-08/,
    );

    const card = screen.getByRole('button', { name: t.workspace.selectPlan(t.newRow(1)) });
    await user.click(card);
    expect(within(editor).getByText(t.workspace.selectPrompt)).toBeVisible();
    expect(within(editor).queryByRole('textbox', { name: inputName })).toBeNull();
    /* 푼 뒤에도 보던 주에 머문다. */
    expect(document.querySelector('.erp-wo-week-range')).toHaveTextContent(
      /2026-11-02.*2026-11-08/,
    );

    await user.click(card);
    expect(within(editor).getByRole('textbox', { name: inputName })).toBeVisible();
  });

  it('확정된 계획을 선택해도 편집이나 삭제를 허용하지 않는다', () => {
    const rows = initialRows().map((row) => ({
      ...row,
      confirmed: true,
      statusCode: 'CONFIRMED',
      isDirty: false,
    }));
    renderWithProviders(
      <PlanStep
        rows={rows}
        orderQty={200}
        confirmedQty={200}
        uomLabel="EA"
        plantId={null}
        lines={[]}
        statusNameOf={(value) => value}
        disabled={false}
        failures={[]}
        onAdd={() => {}}
        onChange={() => {}}
        onRemove={() => {}}
      />,
    );
    /* 확정 계획은 입력 칸 없이 값 목록으로 보이고, 제목도 「편집」이 아니다. */
    const editor = screen.getByRole('region', { name: '생산계획 상세' });
    expect(within(editor).queryByRole('textbox')).toBeNull();
    expect(within(editor).getByText(t.columns.planDate)).toBeVisible();
    expect(
      within(editor).queryByRole('button', { name: t.remove(t.newRow(1)) }),
    ).not.toBeInTheDocument();
  });
  it('복수 ERP W/O 중간에 삽입한 분할 행을 선택하고 마지막 다른 ERP W/O를 선택하지 않는다', async () => {
    const user = userEvent.setup();
    const Harness = () => {
      const [rows, setRows] = useState(() =>
        appendProductionPlanRow(initialRows(), 'other-order', {
          planDate: '2026-11-03',
          plannedQty: '100',
          bomId: '11',
          routingId: '21',
          plannedLineId: '31',
        }),
      );
      return (
        <PlanStep
          rows={rows}
          orderQty={300}
          confirmedQty={0}
          uomLabel="EA"
          plantId={null}
          lines={[]}
          statusNameOf={(code) => code}
          disabled={false}
          failures={[]}
          onAdd={() => {}}
          onChange={() => {}}
          onRemove={() => {}}
          onSplit={(source, parts) =>
            setRows((current) => {
              const reduced = changeProductionPlanRow(
                current,
                source.key,
                'plannedQty',
                parts[0]!.plannedQty,
              );
              const next = appendProductionPlanRow(reduced, 'split-middle', {
                ...source.draft,
                plannedQty: parts[1]!.plannedQty,
              });
              return [next[0]!, next[2]!, next[1]!];
            })
          }
        />
      );
    };
    renderWithProviders(<Harness />);
    await user.click(screen.getByText('계획 분할', { exact: true }));
    await user.clear(screen.getByRole('textbox', { name: '분할 후 계획 건수' }));
    await user.type(screen.getByRole('textbox', { name: '분할 후 계획 건수' }), '2');
    await user.click(screen.getByRole('button', { name: '분할 조건 적용' }));
    await user.clear(screen.getByRole('textbox', { name: '계획 1 생산량' }));
    await user.type(screen.getByRole('textbox', { name: '계획 1 생산량' }), '150');
    await user.clear(screen.getByRole('textbox', { name: '계획 2 생산량' }));
    await user.type(screen.getByRole('textbox', { name: '계획 2 생산량' }), '50');
    await user.click(screen.getByRole('button', { name: '분할 적용' }));
    expect(
      screen.getByRole('textbox', { name: t.fieldLabel(t.newRow(3), t.columns.plannedQty) }),
    ).toHaveValue('50');
  });
});

it('선택 계획의 단위 자릿수에 맞게 소수 분할을 허용한다', async () => {
  const user = userEvent.setup();
  const onSplit = vi.fn();
  renderWithProviders(
    <PlanStep
      rows={initialRows().map((row) => ({ ...row, draft: { ...row.draft, plannedQty: '0.75' } }))}
      orderQty={0.75}
      confirmedQty={0}
      uomLabel="KG"
      plantId={null}
      lines={[]}
      statusNameOf={(value) => value}
      disabled={false}
      failures={[]}
      onAdd={() => {}}
      onRemove={() => {}}
      onChange={() => {}}
      onSplit={onSplit}
      distributionDecimalScale={0}
      rowDecimalScaleOf={() => 2}
    />,
  );
  await user.click(screen.getByRole('button', { name: '계획 분할' }));
  await user.clear(screen.getByRole('textbox', { name: '분할 후 계획 건수' }));
  await user.type(screen.getByRole('textbox', { name: '분할 후 계획 건수' }), '3');
  await user.click(screen.getByRole('button', { name: '분할 조건 적용' }));
  await user.clear(screen.getByRole('textbox', { name: '계획 1 생산량' }));
  await user.type(screen.getByRole('textbox', { name: '계획 1 생산량' }), '0.001');
  expect(screen.getByRole('button', { name: '분할 적용' })).toBeDisabled();
  expect(onSplit).not.toHaveBeenCalled();
  await user.clear(screen.getByRole('textbox', { name: '계획 1 생산량' }));
  await user.type(screen.getByRole('textbox', { name: '계획 1 생산량' }), '0.25');
  await user.click(screen.getByRole('button', { name: '분할 적용' }));
  expect(onSplit).toHaveBeenCalledWith(expect.objectContaining({ key: 'new-1' }), [
    { plannedQty: '0.25', planDate: '2026-11-02' },
    { plannedQty: '0.25', planDate: '2026-11-03' },
    { plannedQty: '0.25', planDate: '2026-11-04' },
  ]);
});

vi.mock('../../../patterns/plant-time', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../patterns/plant-time')>()),
  plantToday: () => '2026-11-01',
}));
