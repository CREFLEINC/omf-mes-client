import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkOrderValidationPane } from './work-order-validation-pane';
import type { WorkOrderValidationFinding, WorkOrderValidationReport } from './queries';

const t = messages.workOrder.validationPane;

const finding = (
  overrides: Partial<WorkOrderValidationFinding> = {},
): WorkOrderValidationFinding => ({
  severity: 'BLOCK',
  field: 'SYN-INTERNAL-FIELD',
  code: 'SYN-INTERNAL-CODE',
  message: 'SYN-SERVER-MESSAGE',
  ...overrides,
});

const report = (overrides: Partial<WorkOrderValidationReport> = {}): WorkOrderValidationReport => ({
  passed: true,
  findings: [finding()],
  ...overrides,
});

const renderPane = (
  overrides: Partial<React.ComponentProps<typeof WorkOrderValidationPane>> = {},
) =>
  render(
    <WorkOrderValidationPane
      selectedWorkOrderNo="SYN-WO-ALPHA"
      report={report()}
      isInitialLoading={false}
      isRefreshing={false}
      loadError={null}
      {...overrides}
    />,
  );

describe('WorkOrderValidationPane', () => {
  it('isolates the no-selection state from stale caller states', () => {
    renderPane({
      selectedWorkOrderNo: null,
      isInitialLoading: true,
      isRefreshing: true,
      loadError: <p>SYN-CALLER-ERROR</p>,
    });

    expect(screen.getByText(t.empty.notSelectedTitle)).toBeInTheDocument();
    expect(screen.queryByText('SYN-CALLER-ERROR')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('status', { name: t.loading })).toBeNull();
    expect(screen.queryByRole('status', { name: t.refreshing })).toBeNull();
    expect(screen.queryByText(t.summary.blocked)).toBeNull();
  });

  it('prioritizes caller error, initial loading, and missing report before report content', () => {
    const { rerender } = renderPane({
      isInitialLoading: true,
      loadError: <p>SYN-CALLER-ERROR</p>,
    });

    expect(screen.getByText('SYN-CALLER-ERROR')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.loading })).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();

    rerender(
      <WorkOrderValidationPane
        selectedWorkOrderNo="SYN-WO-ALPHA"
        report={report()}
        isInitialLoading
        isRefreshing={false}
        loadError={null}
      />,
    );
    expect(screen.getByRole('status', { name: t.loading })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(t.empty.missingTitle)).toBeNull();
    expect(screen.queryByText(t.summary.blocked)).toBeNull();

    rerender(
      <WorkOrderValidationPane
        selectedWorkOrderNo="SYN-WO-ALPHA"
        report={undefined}
        isInitialLoading={false}
        isRefreshing={false}
        loadError={null}
      />,
    );
    expect(screen.getByText(t.empty.missingTitle)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(t.summary.passed)).toBeNull();
  });

  it('renders exact finding columns in server order with severity chips and verbatim messages', () => {
    renderPane({
      report: report({
        findings: [
          finding({ message: '  SYN-BLOCK-MESSAGE  ' }),
          finding({
            severity: 'WARN',
            field: 'SYN-HIDDEN-FIELD',
            code: 'SYN-HIDDEN-CODE',
            message: 'SYN-WARN-MESSAGE',
          }),
        ],
      }),
    });
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    const block = screen.getByText(t.severity.block);
    const warning = screen.getByText(t.severity.warning);

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([t.fields.severity, t.fields.message]);
    expect(within(rows[1]!).getAllByRole('cell')[1]?.textContent).toBe('  SYN-BLOCK-MESSAGE  ');
    expect(within(rows[2]!).getAllByRole('cell')[1]?.textContent).toBe('SYN-WARN-MESSAGE');
    expect(block.parentElement?.className).toContain('status-error');
    expect(warning.parentElement?.className).toContain('status-warning');
    expect(screen.queryByText('SYN-INTERNAL-FIELD')).toBeNull();
    expect(screen.queryByText('SYN-INTERNAL-CODE')).toBeNull();
    expect(screen.queryByText('SYN-HIDDEN-FIELD')).toBeNull();
    expect(screen.queryByText('SYN-HIDDEN-CODE')).toBeNull();
  });

  it.each([
    [
      'failed report with warning',
      report({ passed: false, findings: [finding({ severity: 'WARN' })] }),
      'blocked',
      'status-error',
    ],
    ['passed report with block', report({ findings: [finding()] }), 'blocked', 'status-error'],
    [
      'passed report with warning',
      report({ findings: [finding({ severity: 'WARN' })] }),
      'warning',
      'status-warning',
    ],
  ] as const)('uses defensive %s summary', (_name, validationReport, summary, statusClass) => {
    renderPane({ report: validationReport });

    expect(screen.getByText(t.summary[summary]).parentElement?.className).toContain(statusClass);
  });

  it('shows the passed summary and no-findings state for a successful empty report', () => {
    renderPane({ report: report({ findings: [] }) });

    expect(screen.getByText(t.summary.passed)).toBeInTheDocument();
    expect(screen.getByText(t.empty.noFindingsTitle)).toBeInTheDocument();
    expect(screen.getByText(t.empty.noFindingsDescription)).toBeInTheDocument();
    expect(screen.getByText(t.summary.passed).parentElement?.className).toContain('status-success');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('keeps the report visible and exposes busy refresh state', () => {
    renderPane({ isRefreshing: true });
    const pane = screen.getByRole('region', { name: t.panes.validation });

    expect(pane).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('status', { name: t.refreshing })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('SYN-SERVER-MESSAGE')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: t.loading })).toBeNull();
  });
});
