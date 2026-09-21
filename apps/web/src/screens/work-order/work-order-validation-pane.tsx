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
import { WorkOrderValidationChecks, type WorkOrderValidationCheckScope } from './validation-checks';

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
  /**
   * 배정된 자원. 주면 지적 0건일 때 큰 빈 상태 대신 「확인 항목 / 결과」 표를 그린다.
   * 「검증 통과」 칩 옆에 「검증 항목이 없습니다」만 뜨면 검증을 안 한 것처럼 읽히기 때문이다.
   * 주지 않으면 종전 빈 상태 그대로다.
   */
  checkScope?: WorkOrderValidationCheckScope;
  /** 결과 칩 크기. 기본은 작게 — 이 칩이 화면의 주인공인 쪽만 키운다. */
  summaryChipSize?: 'sm' | 'md';
}

export const WorkOrderValidationPane = ({
  selectedWorkOrderNo,
  report,
  isInitialLoading,
  isRefreshing,
  loadError,
  checkScope,
  summaryChipSize = 'sm',
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
  const skippedNote =
    checkScope !== undefined &&
    report.findings.length === 0 &&
    (!checkScope.hasEquipment || !checkScope.hasMold || !checkScope.hasWorker)
      ? t.skippedNote
      : null;

  return (
    <section
      className="pane work-order-validation-pane"
      aria-label={t.panes.validation}
      aria-busy={isRefreshing}
    >
      <div className="work-order-validation-heading">
        <h2 className="pane-title">{t.panes.validation}</h2>
        {/* 같은 까닭을 줄마다 반복하지 않고 제목 옆에서 한 번 말한다. */}
        {skippedNote !== null && (
          <span className="work-order-validation-heading-hint">{skippedNote}</span>
        )}
        <Chip variant="status" status={summaryStatus[summary]} size={summaryChipSize}>
          {t.summary[summary]}
        </Chip>
      </div>
      {isRefreshing && (
        <p role="status" aria-label={t.refreshing}>
          {t.refreshing}
        </p>
      )}
      {report.findings.length === 0 && checkScope !== undefined ? (
        <div className="work-order-validation-clean">
          <p className="work-order-validation-clean-line">{t.clean}</p>
          <WorkOrderValidationChecks {...checkScope} />
        </div>
      ) : report.findings.length === 0 ? (
        <EmptyState
          size="sm"
          title={t.empty.noFindingsTitle}
          description={t.empty.noFindingsDescription}
        />
      ) : (
        <div className="wide-table">
          <Table
            density="compact"
            caption={<span className="work-order-table-caption">{t.panes.validation}</span>}
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
