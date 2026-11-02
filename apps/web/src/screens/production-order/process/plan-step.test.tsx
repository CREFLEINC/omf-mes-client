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
});
