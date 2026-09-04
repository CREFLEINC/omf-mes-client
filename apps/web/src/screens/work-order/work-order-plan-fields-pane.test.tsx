import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WorkOrderPlanFieldsPane } from './work-order-plan-fields-pane';
import type { WorkOrderAssignmentDraft } from './assignment-model';

const t = messages.workOrder.planFieldsPane;

const draft = (overrides: Partial<WorkOrderAssignmentDraft> = {}): WorkOrderAssignmentDraft => ({
  productionLineId: '101',
  responsibleWorkerId: '201',
  plannedEquipmentId: '301',
  plannedMoldId: '401',
  plannedShiftId: '501',
  plannedStartAtLocal: '2026-08-23T09:00',
  plannedEndAtLocal: '2026-08-23T11:00',
  priorityNo: '7',
  ...overrides,
});

const renderPane = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderPlanFieldsPane>> = {},
) => {
  const onChange = vi.fn();
  const { draft: initialDraft = draft(), ...props } = overrides;
  const StatefulPane = () => {
    const [currentDraft, setCurrentDraft] = useState(initialDraft);

    return (
      <WorkOrderPlanFieldsPane
        selectedWorkOrderNo="SYN-WO-ALPHA"
        draft={currentDraft}
        fieldErrors={{}}
        onChange={(patch) => {
          onChange(patch);
          setCurrentDraft((previousDraft) => ({ ...previousDraft, ...patch }));
        }}
        {...props}
      />
    );
  };
  const result = render(<StatefulPane />);

  return { ...result, onChange };
};

describe('WorkOrderPlanFieldsPane', () => {
  it('isolates no-selection state from stale plan fields and errors', () => {
    renderPane({ selectedWorkOrderNo: null, fieldErrors: { priorityNo: 'SYN-PRIORITY-ERROR' } });

    expect(screen.getByText(t.empty.notSelectedTitle)).toBeInTheDocument();
    expect(screen.queryByText('SYN-PRIORITY-ERROR')).toBeNull();
    expect(screen.queryByRole('region', { name: t.pane })).toBeNull();
    expect(screen.queryByText(t.warning)).toBeNull();
  });

  it('renders the named pane, bordered card, and three plan fields in order', () => {
    renderPane();

    const pane = screen.getByRole('region', { name: t.pane });
    expect(pane).toHaveClass('work-order-plan-pane');
    expect(pane.querySelector('.work-order-plan-fields')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 2, name: t.heading('SYN-WO-ALPHA') }),
    ).toBeVisible();
    const cardHeading = screen.getByRole('heading', { level: 3, name: t.card });
    expect(cardHeading.closest('[class*="_card_"]')?.className).toContain('_bordered_');

    const start = screen.getByLabelText(t.fields.plannedStartAtLocal);
    const end = screen.getByLabelText(t.fields.plannedEndAtLocal);
    const priority = screen.getByLabelText(t.fields.priorityNo);
    expect(Array.from(cardHeading.closest('[class*="_card_"]')!.querySelectorAll('input'))).toEqual(
      [start, end, priority],
    );
    expect([
      start.getAttribute('type'),
      end.getAttribute('type'),
      priority.getAttribute('type'),
    ]).toEqual(['datetime-local', 'datetime-local', 'text']);
    expect([start, end, priority].map((field) => field.getAttribute('value'))).toEqual([
      '2026-08-23T09:00',
      '2026-08-23T11:00',
      '7',
    ]);
    expect(priority).toHaveAttribute('inputmode', 'numeric');
  });

  it('emits exact one-field patches without parsing raw priority input', () => {
    const { onChange } = renderPane();
    const start = screen.getByLabelText(t.fields.plannedStartAtLocal);
    const end = screen.getByLabelText(t.fields.plannedEndAtLocal);
    const priority = screen.getByLabelText(t.fields.priorityNo);

    fireEvent.change(start, { target: { value: '2026-08-24T10:30' } });
    fireEvent.change(end, { target: { value: '2026-08-24T12:30' } });
    fireEvent.change(priority, { target: { value: '-' } });

    expect(priority).toHaveValue('-');
    expect(onChange.mock.calls).toEqual([
      [{ plannedStartAtLocal: '2026-08-24T10:30' }],
      [{ plannedEndAtLocal: '2026-08-24T12:30' }],
      [{ priorityNo: '-' }],
    ]);
  });

  it('shows each caller error as the matching field description', () => {
    renderPane({
      fieldErrors: {
        plannedStartAtLocal: 'SYN-START-ERROR',
        plannedEndAtLocal: 'SYN-END-ERROR',
        priorityNo: 'SYN-PRIORITY-ERROR',
      },
    });

    for (const [label, error] of [
      [t.fields.plannedStartAtLocal, 'SYN-START-ERROR'],
      [t.fields.plannedEndAtLocal, 'SYN-END-ERROR'],
      [t.fields.priorityNo, 'SYN-PRIORITY-ERROR'],
    ] as const) {
      const field = screen.getByLabelText(label);
      expect(screen.getByText(error)).toBeVisible();
      expect(field).toBeInvalid();
      expect(field).toHaveAccessibleDescription(error);
    }
  });

  it('shows the overlap warning without marking either planned time as required', () => {
    renderPane();

    expect(screen.getByText(t.warning)).toBeVisible();
    expect(screen.getByLabelText(t.fields.plannedStartAtLocal)).not.toBeRequired();
    expect(screen.getByLabelText(t.fields.plannedEndAtLocal)).not.toBeRequired();
  });

  it('locks every plan field with the caller reason', () => {
    renderPane({ disabled: true, disabledReason: 'SYN-STALE-LOCK' });

    for (const field of screen.getAllByRole('textbox')) {
      expect(field).toBeDisabled();
      expect(field).toHaveAccessibleDescription('SYN-STALE-LOCK');
    }
    expect(screen.getAllByText('SYN-STALE-LOCK')).toHaveLength(3);
  });
});
