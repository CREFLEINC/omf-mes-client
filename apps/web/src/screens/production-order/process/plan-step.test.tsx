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
    const inputName = t.fieldLabel(t.newRow(1), t.columns.plannedQty);
    await user.clear(screen.getByRole('textbox', { name: inputName }));
    await user.type(screen.getByRole('textbox', { name: inputName }), '250');
    await user.click(screen.getByRole('tab', { name: t.workspace.week }));
    expect(screen.getByRole('button', { name: t.workspace.selectPlan(t.newRow(1)) })).toBeVisible();
    await user.click(screen.getByRole('button', { name: t.workspace.nextWeek }));
    expect(screen.getByText(t.workspace.outsideWeek)).toBeVisible();
    await user.click(screen.getByRole('tab', { name: t.workspace.grid }));
    expect(screen.getByRole('textbox', { name: inputName })).toHaveValue('250');
    expect(fetch).not.toHaveBeenCalled();
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
    const editor = screen.getByRole('region', { name: t.workspace.editor });
    expect(
      within(editor).getByRole('textbox', {
        name: t.fieldLabel(t.newRow(1), t.columns.plannedQty),
      }),
    ).toBeDisabled();
    expect(
      within(editor).queryByRole('button', { name: t.remove(t.newRow(1)) }),
    ).not.toBeInTheDocument();
  });
  it('복수 오더 중간에 삽입한 분할 행을 선택하고 마지막 다른 오더를 선택하지 않는다', async () => {
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
          onSplit={(source, qty) =>
            setRows((current) => {
              const reduced = changeProductionPlanRow(
                current,
                source.key,
                'plannedQty',
                String(Number(source.draft.plannedQty) - qty),
              );
              const next = appendProductionPlanRow(reduced, 'split-middle', {
                ...source.draft,
                plannedQty: String(qty),
              });
              return [next[0]!, next[2]!, next[1]!];
            })
          }
        />
      );
    };
    renderWithProviders(<Harness />);
    await user.click(screen.getByText('계획 분할', { exact: true }));
    await user.type(screen.getByRole('textbox', { name: '분할 수량' }), '50');
    await user.click(screen.getByRole('button', { name: '분할 적용' }));
    expect(
      screen.getByRole('textbox', { name: t.fieldLabel(t.newRow(3), t.columns.plannedQty) }),
    ).toHaveValue('50');
  });
});
