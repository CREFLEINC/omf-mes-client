import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkOrderValidationChecks } from './validation-checks';

const t = messages.workOrder.validationPane;

const rowOf = (label: string): HTMLElement => {
  const term = screen.getByText(label);
  const row = term.closest('.work-order-validation-checks-row');
  if (row === null) throw new Error(`no row for ${label}`);
  return row as HTMLElement;
};

describe('WorkOrderValidationChecks', () => {
  it('lists every server check once', () => {
    render(<WorkOrderValidationChecks hasEquipment hasMold hasWorker />);

    expect(screen.getByText(t.checksTitle)).toBeVisible();
    for (const label of Object.values(t.checks)) {
      expect(within(rowOf(label)).getByText(t.checkState.checked)).toBeVisible();
    }
  });

  it('does not claim a check ran for a resource that was never assigned', () => {
    render(<WorkOrderValidationChecks hasEquipment={false} hasMold={false} hasWorker />);

    expect(within(rowOf(t.checks.equipmentStatus)).getByText(t.checkState.skipped)).toBeVisible();
    expect(within(rowOf(t.checks.moldLife)).getByText(t.checkState.skipped)).toBeVisible();
    expect(
      within(rowOf(t.checks.workerQualification)).getByText(t.checkState.checked),
    ).toBeVisible();
    expect(screen.getAllByText(t.checkState.skipped)).toHaveLength(5);
  });
});
