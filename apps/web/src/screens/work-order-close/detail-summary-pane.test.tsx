import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  WorkOrderCloseDetailSummaryPane,
  type WorkOrderCloseDetailSummaryPaneProps,
} from './detail-summary-pane';
import type { WorkOrderCloseDetailFact } from './queries';

const t = messages.workOrderClose.detailSummary;

const detail = (overrides: Partial<WorkOrderCloseDetailFact> = {}): WorkOrderCloseDetailFact => ({
  workOrderId: 701,
  workOrderNo: 'SYN-WO-ALPHA',
  productionPlanId: 801,
  routingOperationId: 901,
  itemId: 1001,
  orderQty: 100,
  uomId: 987654,
  workOrderTypeCode: 'SYN-WO-TYPE',
  priorityNo: 1,
  statusCode: 'SYN-WO-STATUS',
  productionLineId: null,
  responsibleWorkerId: null,
  plannedStartAt: null,
  plannedEndAt: null,
  plannedEquipmentId: null,
  plannedMoldId: null,
  plannedShiftId: null,
  remarks: null,
  completedAt: null,
  completionVarianceReasonCode: null,
  closedAt: null,
  progress: {
    goodQty: 180,
    defectQty: 12,
    holdQty: 0,
    scrapQty: 4,
    reworkQty: 5,
    achievementRate: 0.17,
    varianceQty: 73,
    completionJudgmentCode: 'UNDER',
  },
  preIssuedLots: { slotCount: 9, withResultCount: 6, withoutResultCount: 0 },
  ...overrides,
});

const resolvedState = (
  overrides: Partial<WorkOrderCloseDetailFact> = {},
  unitLabel: string | null = 'SYN-EA',
): WorkOrderCloseDetailSummaryPaneProps['state'] => ({
  kind: 'RESOLVED',
  detail: detail(overrides),
  unitLabel,
});

const renderPane = (state: WorkOrderCloseDetailSummaryPaneProps['state']) =>
  render(<WorkOrderCloseDetailSummaryPane state={state} />);

const stat = (label: string): HTMLElement => screen.getByRole('group', { name: label });

const QUANTITY_FIELDS = [
  t.fields.orderQty,
  t.fields.goodQty,
  t.fields.defectQty,
  t.fields.holdQty,
  t.fields.scrapQty,
  t.fields.reworkQty,
  t.fields.varianceQty,
] as const;

describe('WorkOrderCloseDetailSummaryPane', () => {
  it('shows only the named loading state while checking', () => {
    renderPane({ kind: 'CHECKING' });

    expect(screen.getByRole('region', { name: t.pane })).toHaveClass(
      'pane',
      'work-order-close-summary-pane',
    );
    expect(screen.getByRole('heading', { name: t.heading })).toBeVisible();
    expect(screen.getByRole('status', { name: t.loading })).toBeVisible();
    expect(screen.queryByText('SYN-WO-ALPHA')).not.toBeInTheDocument();
  });

  it('retains caller-owned unavailable content without rendering stale detail', () => {
    renderPane({
      kind: 'UNAVAILABLE',
      content: <aside data-testid="caller-content">Synthetic detail error</aside>,
    });

    expect(screen.getByTestId('caller-content')).toHaveTextContent('Synthetic detail error');
    expect(screen.queryByRole('status', { name: t.loading })).not.toBeInTheDocument();
    expect(screen.queryByText('SYN-WO-ALPHA')).not.toBeInTheDocument();
  });

  it('shows the W/O, server progress, and pre-issued LOT counts without recomputing them', () => {
    const { container } = renderPane(resolvedState());

    expect(
      within(screen.getByRole('group', { name: t.groups.order })).getByText('SYN-WO-ALPHA'),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: t.groups.order })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: t.groups.progress })).toBeVisible();
    expect(screen.getByRole('heading', { level: 3, name: t.groups.preIssuedLots })).toBeVisible();
    expect(within(stat(t.fields.orderQty)).getByText('100')).toBeVisible();
    expect(within(stat(t.fields.goodQty)).getByText('180')).toBeVisible();
    expect(within(stat(t.fields.defectQty)).getByText('12')).toBeVisible();
    expect(within(stat(t.fields.holdQty)).getByText('0')).toBeVisible();
    expect(within(stat(t.fields.scrapQty)).getByText('4')).toBeVisible();
    expect(within(stat(t.fields.reworkQty)).getByText('5')).toBeVisible();
    expect(within(stat(t.fields.achievementRate)).getByText('17')).toBeVisible();
    expect(within(stat(t.fields.varianceQty)).getByText('73')).toBeVisible();
    expect(within(stat(t.fields.judgment)).getByText(t.judgments.UNDER)).toBeVisible();
    expect(within(stat(t.fields.slotCount)).getByText('9')).toBeVisible();
    expect(within(stat(t.fields.withResultCount)).getByText('6')).toBeVisible();
    expect(within(stat(t.fields.withoutResultCount)).getByText('0')).toBeVisible();
    expect(container.querySelectorAll('[data-status]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-direction]')).toHaveLength(0);
  });

  it.each([
    ['UNDER', '미달'],
    ['NORMAL', '정상'],
    ['OVER', '초과'],
  ] as const)('maps only the server judgment %s to its confirmed label', (code, label) => {
    renderPane(
      resolvedState({
        orderQty: 100,
        progress: {
          goodQty: 1,
          achievementRate: 9.87,
          varianceQty: -432,
          completionJudgmentCode: code,
        },
      }),
    );

    expect(within(stat(t.fields.judgment)).getByText(label)).toBeVisible();
    expect(within(stat(t.fields.goodQty)).getByText('1')).toBeVisible();
    expect(within(stat(t.fields.achievementRate)).getByText('987')).toBeVisible();
    expect(within(stat(t.fields.varianceQty)).getByText('-432')).toBeVisible();
    expect(screen.queryByText(code)).not.toBeInTheDocument();
  });

  it('keeps omitted optional progress quantities explicitly unconfirmed instead of zero', () => {
    renderPane(
      resolvedState({
        progress: {
          goodQty: 11,
          achievementRate: 0.5,
          completionJudgmentCode: 'NORMAL',
        },
      }),
    );

    for (const label of [
      t.fields.defectQty,
      t.fields.holdQty,
      t.fields.scrapQty,
      t.fields.reworkQty,
      t.fields.varianceQty,
    ]) {
      expect(within(stat(label)).getByText(t.values.notConfirmed)).toBeVisible();
      expect(within(stat(label)).queryByText('0')).not.toBeInTheDocument();
    }
  });

  it('shows distinct unconfirmed states for absent progress and LOT summaries', () => {
    renderPane(resolvedState({ progress: null, preIssuedLots: null }));

    expect(screen.getByText(t.empty.progressTitle)).toBeVisible();
    expect(screen.getByText(t.empty.progressDescription)).toBeVisible();
    expect(screen.getByText(t.empty.preIssuedLotsTitle)).toBeVisible();
    expect(screen.getByText(t.empty.preIssuedLotsDescription)).toBeVisible();
    expect(screen.getByRole('group', { name: t.groups.progress })).toBeVisible();
    expect(screen.getByRole('group', { name: t.groups.preIssuedLots })).toBeVisible();
  });

  it('uses only a caller-confirmed unit label and never exposes the internal uom ID', () => {
    const { container, rerender } = renderPane(resolvedState({}, null));

    for (const label of QUANTITY_FIELDS) {
      expect(within(stat(label)).getByText(t.values.unitNotConfirmed)).toBeVisible();
    }
    expect(container.textContent).not.toContain('987654');

    rerender(<WorkOrderCloseDetailSummaryPane state={resolvedState({}, '합성 단위 갑')} />);
    for (const label of QUANTITY_FIELDS) {
      expect(within(stat(label)).getByText('합성 단위 갑')).toBeVisible();
    }
    expect(screen.queryByText(t.values.unitNotConfirmed)).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('987654');
  });
});
