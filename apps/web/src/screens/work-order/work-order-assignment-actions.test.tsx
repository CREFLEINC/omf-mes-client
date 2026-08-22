import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { WorkOrderAssignmentActions } from './work-order-assignment-actions';
import type { WorkOrderAssignmentDraft } from './assignment-model';

const t = messages.workOrder.assignmentActions;

const draft = (overrides: Partial<WorkOrderAssignmentDraft> = {}): WorkOrderAssignmentDraft => ({
  productionLineId: '101',
  responsibleWorkerId: '',
  plannedEquipmentId: '',
  plannedMoldId: '',
  plannedShiftId: '',
  plannedStartAtLocal: '2026-08-23T09:00',
  plannedEndAtLocal: '2026-08-23T11:00',
  priorityNo: '7',
  ...overrides,
});

const renderActions = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderAssignmentActions>> = {},
) => {
  const onValidate = vi.fn();
  const onReset = vi.fn();
  const onSave = vi.fn();
  const props = {
    draft: draft(),
    isDirty: true,
    isSaving: false,
    onValidate,
    onReset,
    onSave,
    ...overrides,
  };
  const result = render(<WorkOrderAssignmentActions {...props} />);

  return { ...result, onValidate, onReset, onSave, props, user: userEvent.setup() };
};

describe('WorkOrderAssignmentActions', () => {
  it('enables valid dirty actions in order and calls only their exact callbacks', async () => {
    const { onValidate, onReset, onSave, user } = renderActions();
    const actions = screen.getAllByRole('button');

    expect(actions.map((action) => action.textContent)).toEqual([
      t.actions.validate,
      t.actions.reset,
      t.actions.save,
    ]);
    expect(actions[0]?.className).toContain('_outlined_');
    expect(actions[1]?.className).toContain('_outlined_');
    expect(actions[2]?.className).toContain('_filled_');
    for (const action of actions) {
      expect(action).toBeEnabled();
      expect(action).not.toHaveAttribute('aria-describedby');
    }
    expect(screen.queryByText(t.reasons.saving)).toBeNull();
    expect(screen.queryByText(t.reasons.noChanges)).toBeNull();
    expect(screen.queryByText(t.reasons.invalidDraft)).toBeNull();

    await user.click(actions[0]!);
    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onReset).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
    await user.click(actions[1]!);
    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
    await user.click(actions[2]!);
    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('keeps validation enabled and gives reset and save the no-change reason before draft validity', async () => {
    const { onValidate, onReset, onSave, rerender, props, user } = renderActions({
      isDirty: false,
      draft: draft({ priorityNo: 'not-an-integer' }),
    });
    const validate = screen.getByRole('button', { name: t.actions.validate });
    const reset = screen.getByRole('button', { name: t.actions.reset });
    const save = screen.getByRole('button', { name: t.actions.save });

    expect(validate).toBeEnabled();
    expect(reset).toBeDisabled();
    expect(save).toBeDisabled();
    expect(reset.className).toContain('_outlined_');
    expect(save.className).toContain('_filled_');
    expect(reset).toHaveAccessibleDescription(t.reasons.noChanges);
    expect(save).toHaveAccessibleDescription(t.reasons.noChanges);
    const noChangeReasons = screen.getAllByText(t.reasons.noChanges);
    expect(noChangeReasons).toHaveLength(2);
    noChangeReasons.forEach((reason) => expect(reason).toBeVisible());
    expect(screen.queryByText(t.reasons.invalidDraft)).toBeNull();

    rerender(<WorkOrderAssignmentActions {...props} draft={draft()} isDirty />);
    expect(screen.getByRole('button', { name: t.actions.validate })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.reset })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.save })).toBeEnabled();
    expect(screen.queryByText(t.reasons.noChanges)).toBeNull();
    expect(
      screen.getAllByRole('button').every((action) => !action.hasAttribute('aria-describedby')),
    ).toBe(true);

    await user.click(validate);
    await user.click(reset);
    await user.click(save);
    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('blocks only save for a dirty invalid assignment draft', () => {
    renderActions({ draft: draft({ priorityNo: 'not-an-integer' }) });

    expect(screen.getByRole('button', { name: t.actions.validate })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.actions.reset })).toBeEnabled();
    const save = screen.getByRole('button', { name: t.actions.save });
    expect(save).toBeDisabled();
    expect(save).toHaveAccessibleDescription(t.reasons.invalidDraft);
    expect(screen.getByText(t.reasons.invalidDraft)).toBeVisible();
  });

  it('gives saving priority to every action, marks save loading, and calls nothing', async () => {
    const { onValidate, onReset, onSave, user } = renderActions({
      isSaving: true,
      isDirty: false,
      draft: draft({ priorityNo: 'not-an-integer' }),
    });
    const actions = screen.getAllByRole('button');

    for (const action of actions) {
      expect(action).toBeDisabled();
      expect(action).toHaveAccessibleDescription(t.reasons.saving);
    }
    expect(actions[0]?.className).toContain('_outlined_');
    expect(actions[1]?.className).toContain('_outlined_');
    expect(actions[2]?.className).toContain('_filled_');
    const savingReasons = screen.getAllByText(t.reasons.saving);
    expect(savingReasons).toHaveLength(3);
    savingReasons.forEach((reason) => expect(reason).toBeVisible());
    expect(screen.queryByText(t.reasons.noChanges)).toBeNull();
    expect(screen.queryByText(t.reasons.invalidDraft)).toBeNull();
    expect(actions[2]).toHaveAttribute('aria-busy', 'true');

    for (const action of actions) await user.click(action);
    expect(onValidate).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
