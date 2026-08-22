import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  WorkOrderReleaseSummaryPane,
  type WorkOrderReleaseSummaryView,
} from './work-order-release-summary-pane';

const t = messages.workOrderRelease.summary;

const view = (
  overrides: Partial<WorkOrderReleaseSummaryView> = {},
): WorkOrderReleaseSummaryView => ({
  workOrderNo: 'SYN-WO-ALPHA',
  itemLabel: 'SYN-ITEM-ALPHA',
  quantityLabel: '12.5 SYN-EA',
  operationLabel: 'SYN-OPERATION-ALPHA',
  routingRevisionLabel: 'SYN-ROUTING-REV-A',
  productionLineLabel: 'SYN-LINE-ALPHA',
  equipmentLabel: 'SYN-EQUIPMENT-ALPHA',
  moldLabel: 'SYN-MOLD-ALPHA',
  shiftLabel: 'SYN-SHIFT-ALPHA',
  plannedPeriodLabel: 'SYN-PERIOD-ALPHA',
  ...overrides,
});

const renderPane = (summary: WorkOrderReleaseSummaryView | null = view()) =>
  render(<WorkOrderReleaseSummaryPane view={summary} />);

describe('WorkOrderReleaseSummaryPane', () => {
  it('isolates the empty state from stale selected-summary content', () => {
    renderPane(null);

    expect(screen.getByText(t.empty.title)).toBeVisible();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('definition')).toBeNull();
    expect(screen.queryByText('SYN-WO-ALPHA')).toBeNull();
  });

  it('renders a bordered card with a semantic definition list in exact field order', () => {
    const { container } = renderPane();
    const definitionList = container.querySelector('dl');
    const cells = Array.from(definitionList?.children ?? []);

    expect(
      screen.getByRole('heading', { level: 2, name: t.heading('SYN-WO-ALPHA') }),
    ).toBeVisible();
    expect(definitionList).not.toBeNull();
    expect(definitionList?.closest('[class*="_card_"]')?.className).toContain('_bordered_');
    expect(cells).toHaveLength(9);
    expect(cells.every((cell) => cell.classList.contains('field-cell'))).toBe(true);
    expect(cells.map((cell) => Array.from(cell.children).map((child) => child.tagName))).toEqual(
      Array.from({ length: 9 }, () => ['DT', 'DD']),
    );
    expect(
      Array.from(definitionList?.querySelectorAll('dt') ?? []).map((term) => term.textContent),
    ).toEqual([
      t.fields.item,
      t.fields.quantity,
      t.fields.operation,
      t.fields.routingRevision,
      t.fields.productionLine,
      t.fields.equipment,
      t.fields.mold,
      t.fields.shift,
      t.fields.plannedPeriod,
    ]);
    expect(
      Array.from(definitionList?.querySelectorAll('dd') ?? []).map((detail) => detail.textContent),
    ).toEqual([
      'SYN-ITEM-ALPHA',
      '12.5 SYN-EA',
      'SYN-OPERATION-ALPHA',
      'SYN-ROUTING-REV-A',
      'SYN-LINE-ALPHA',
      'SYN-EQUIPMENT-ALPHA',
      'SYN-MOLD-ALPHA',
      'SYN-SHIFT-ALPHA',
      'SYN-PERIOD-ALPHA',
    ]);
  });

  it('uses the generic fallback for null, undefined, and blank nullable labels', () => {
    renderPane(
      view({
        itemLabel: null,
        operationLabel: undefined as never,
        routingRevisionLabel: ' ',
        productionLineLabel: '\t',
        equipmentLabel: null,
        moldLabel: undefined as never,
        shiftLabel: '  ',
        plannedPeriodLabel: '',
      }),
    );

    expect(screen.getAllByText(t.values.unavailable)).toHaveLength(8);
    expect(screen.getByText('12.5 SYN-EA')).toBeVisible();
    expect(screen.queryByText('undefined')).toBeNull();
  });

  it('preserves nonblank prepared whitespace and quantity exactly as supplied', () => {
    const { container } = renderPane(
      view({
        quantityLabel: '  SYN-QUANTITY-AS-SUPPLIED  ',
        operationLabel: '  SYN-OPERATION-AS-SUPPLIED  ',
      }),
    );
    const details = Array.from(container.querySelectorAll('dd')).map(
      (detail) => detail.textContent,
    );

    expect(details[1]).toBe('  SYN-QUANTITY-AS-SUPPLIED  ');
    expect(details[2]).toBe('  SYN-OPERATION-AS-SUPPLIED  ');
  });

  it('renders no IDs, snapshot content, or interactive controls', () => {
    renderPane();

    expect(screen.queryByText('901')).toBeNull();
    expect(screen.queryByText('SYN-SNAPSHOT-CONTENT')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
