import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkOrderResourcePane } from './work-order-resource-pane';
import type { WorkOrderAssignmentDraft } from './assignment-model';

const t = messages.workOrder.resourcePane;
const draft = (overrides: Partial<WorkOrderAssignmentDraft> = {}): WorkOrderAssignmentDraft => ({
  productionLineId: '101',
  responsibleWorkerId: '201',
  plannedEquipmentId: '301',
  plannedMoldId: '401',
  plannedShiftId: '',
  plannedStartAtLocal: '',
  plannedEndAtLocal: '',
  priorityNo: '1',
  ...overrides,
});
const options = [
  { value: '101', label: '  SYN-Z-LINE-CURRENT  ' },
  { value: '102', label: ' SYN-A-LINE-NEXT ' },
  { value: '', label: 'SYN-BLANK-OPTION' },
];
const renderPane = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderResourcePane>> = {},
) => {
  const onChange = vi.fn();
  const result = render(
    <WorkOrderResourcePane
      selectedWorkOrderNo="SYN-WO-ALPHA"
      draft={draft()}
      productionLineOptions={options}
      plannedEquipmentOptions={[
        { value: '301', label: 'SYN-EQUIPMENT-CURRENT' },
        { value: '302', label: 'SYN-EQUIPMENT-NEXT' },
      ]}
      responsibleWorkerOptions={[
        { value: '201', label: 'SYN-WORKER-CURRENT' },
        { value: '202', label: 'SYN-WORKER-NEXT' },
      ]}
      plannedMoldOptions={[
        { value: '401', label: 'SYN-MOLD-CURRENT' },
        { value: '402', label: 'SYN-MOLD-NEXT' },
      ]}
      plannedShiftOptions={[
        { value: '501', label: 'SYN-SHIFT-CURRENT' },
        { value: '502', label: 'SYN-SHIFT-NEXT' },
      ]}
      fieldErrors={{}}
      fieldNotes={{}}
      onChange={onChange}
      {...overrides}
    />,
  );
  return { ...result, onChange, user: userEvent.setup() };
};

describe('WorkOrderResourcePane', () => {
  it('isolates no-selection state from stale assignment data', () => {
    renderPane({ selectedWorkOrderNo: null, fieldErrors: { productionLineId: 'SYN-ERROR' } });
    expect(screen.getByText(t.empty.notSelectedTitle)).toBeInTheDocument();
    expect(screen.queryByText('SYN-ERROR')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(t.warning)).toBeNull();
  });

  it('renders four cards in order with five labelled controls and material guidance', () => {
    renderPane();
    expect(screen.getByRole('heading', { name: t.heading('SYN-WO-ALPHA') })).toBeInTheDocument();
    const cards = screen.getAllByRole('heading', { level: 3 });
    expect(cards.map((card) => card.textContent)).toEqual([
      t.cards.machine,
      t.cards.man,
      t.cards.tool,
      t.cards.material,
    ]);
    expect(
      cards.every((card) => card.closest('[class*="_card_"]')?.className.includes('_bordered_')),
    ).toBe(true);
    expect(screen.getByRole('combobox', { name: t.fields.productionLine })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.equipment })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.worker })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.mold })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: t.fields.shift })).toBeInTheDocument();
    expect(screen.getByText(t.materialInfo)).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(5);
  });

  it('preserves caller option order and text, owns one clear option, and emits exact patches', async () => {
    const { onChange, user } = renderPane();
    const line = screen.getByRole('combobox', { name: t.fields.productionLine });
    expect(line).toHaveTextContent('SYN-Z-LINE-CURRENT');
    expect(screen.queryByText('101')).toBeNull();
    expect(screen.queryByText('SYN-BLANK-OPTION')).toBeNull();
    await user.click(line);
    expect(screen.queryByRole('option', { name: 'SYN-BLANK-OPTION' })).toBeNull();
    expect(
      screen
        .getAllByRole('option')
        .map((option) => option.querySelector('[class*="_optionLabel_"]')?.textContent),
    ).toEqual([t.clearOption, '  SYN-Z-LINE-CURRENT  ', ' SYN-A-LINE-NEXT ']);
    await user.click(screen.getByRole('option', { name: 'SYN-A-LINE-NEXT' }));
    await user.click(screen.getByRole('combobox', { name: t.fields.equipment }));
    await user.click(screen.getByRole('option', { name: 'SYN-EQUIPMENT-NEXT' }));
    await user.click(screen.getByRole('combobox', { name: t.fields.worker }));
    await user.click(screen.getByRole('option', { name: 'SYN-WORKER-NEXT' }));
    await user.click(screen.getByRole('combobox', { name: t.fields.mold }));
    await user.click(screen.getByRole('option', { name: 'SYN-MOLD-NEXT' }));
    await user.click(screen.getByRole('combobox', { name: t.fields.shift }));
    await user.click(screen.getByRole('option', { name: 'SYN-SHIFT-NEXT' }));
    await user.click(screen.getByRole('combobox', { name: t.fields.productionLine }));
    await user.click(screen.getByRole('option', { name: t.clearOption }));
    expect(onChange.mock.calls).toEqual([
      [{ productionLineId: '102' }],
      [{ plannedEquipmentId: '302' }],
      [{ responsibleWorkerId: '202' }],
      [{ plannedMoldId: '402' }],
      [{ plannedShiftId: '502' }],
      [{ productionLineId: '' }],
    ]);
  });

  it('uses caller error before note and links each visible description', () => {
    renderPane({
      fieldErrors: { productionLineId: 'SYN-ERROR' },
      fieldNotes: { productionLineId: 'SYN-NOTE', plannedMoldId: 'SYN-MOLD-NOTE' },
    });
    const line = screen.getByRole('combobox', { name: t.fields.productionLine });
    const mold = screen.getByRole('combobox', { name: t.fields.mold });
    expect(screen.getByText('SYN-ERROR')).toBeVisible();
    expect(screen.queryByText('SYN-NOTE')).toBeNull();
    expect(line).toBeInvalid();
    expect(line).toHaveAccessibleDescription('SYN-ERROR');
    expect(screen.getByText('SYN-MOLD-NOTE')).toBeVisible();
    expect(mold).toHaveAccessibleDescription('SYN-MOLD-NOTE');
  });

  it('shows the single-assignment warning and renders an empty draft as the explicit clear value', () => {
    renderPane();
    expect(screen.getByText(t.warning)).toBeVisible();
    expect(screen.getByRole('combobox', { name: t.fields.shift })).toHaveTextContent(t.clearOption);
  });

  it('locks every resource control with the caller reason', () => {
    renderPane({ disabled: true, disabledReason: 'SYN-SAVE-LOCK' });

    for (const control of screen.getAllByRole('combobox')) {
      expect(control).toBeDisabled();
      expect(control).toHaveAccessibleDescription('SYN-SAVE-LOCK');
    }
    expect(screen.getAllByText('SYN-SAVE-LOCK')).toHaveLength(5);
  });
});
