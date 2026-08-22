import {
  Chip,
  type ChipStatus,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { WorkOrderValidationFinding, WorkOrderValidationReport } from './queries';

const t = messages.workOrder.validationPane;

type ValidationSummary = 'blocked' | 'warning' | 'passed';

const summaryStatus: Record<ValidationSummary, ChipStatus> = {
  blocked: 'error',
  warning: 'warning',
  passed: 'success',
};

const toValidationSummary = (report: WorkOrderValidationReport): ValidationSummary => {
  if (!report.passed || report.findings.some((finding) => finding.severity === 'BLOCK')) {
    return 'blocked';
  }

  return report.findings.some((finding) => finding.severity === 'WARN') ? 'warning' : 'passed';
};

const severityStatus = (severity: WorkOrderValidationFinding['severity']): ChipStatus =>
  severity === 'BLOCK' ? 'error' : 'warning';

const severityLabel = (severity: WorkOrderValidationFinding['severity']): string =>
  severity === 'BLOCK' ? t.severity.block : t.severity.warning;

export interface WorkOrderValidationPaneProps {
  selectedWorkOrderNo: string | null;
  report: WorkOrderValidationReport | undefined;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadError: ReactNode;
}

export const WorkOrderValidationPane = ({
  selectedWorkOrderNo,
  report,
  isInitialLoading,
  isRefreshing,
  loadError,
}: WorkOrderValidationPaneProps) => {
  const columns: Column<WorkOrderValidationFinding>[] = [
    {
      key: 'severity',
      header: t.fields.severity,
      render: (finding) => (
        <Chip variant="status" status={severityStatus(finding.severity)} size="sm">
          {severityLabel(finding.severity)}
        </Chip>
      ),
    },
    { key: 'message', header: t.fields.message },
  ];

  if (selectedWorkOrderNo === null) {
    return (
      <section className="pane" aria-label={t.panes.validation}>
        <EmptyState
          size="sm"
          title={t.empty.notSelectedTitle}
          description={t.empty.notSelectedDescription}
        />
      </section>
    );
  }

  if (loadError !== null && loadError !== undefined) {
    return (
      <section className="pane" aria-label={t.panes.validation}>
        {loadError}
      </section>
    );
  }

  if (isInitialLoading) {
    return (
      <section className="pane" aria-label={t.panes.validation}>
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      </section>
    );
  }

  if (report === undefined) {
    return (
      <section className="pane" aria-label={t.panes.validation}>
        <EmptyState
          size="sm"
          title={t.empty.missingTitle}
          description={t.empty.missingDescription}
        />
      </section>
    );
  }

  const summary = toValidationSummary(report);

  return (
    <section className="pane" aria-label={t.panes.validation} aria-busy={isRefreshing}>
      <Chip variant="status" status={summaryStatus[summary]} size="sm">
        {t.summary[summary]}
      </Chip>
      {isRefreshing && (
        <p role="status" aria-label={t.refreshing}>
          {t.refreshing}
        </p>
      )}
      {report.findings.length === 0 ? (
        <EmptyState
          size="sm"
          title={t.empty.noFindingsTitle}
          description={t.empty.noFindingsDescription}
        />
      ) : (
        <div className="wide-table">
          <Table
            density="compact"
            columns={columns}
            rows={report.findings}
            getRowId={(_finding, index) => String(index)}
            sort={null}
          />
        </div>
      )}
    </section>
  );
};
