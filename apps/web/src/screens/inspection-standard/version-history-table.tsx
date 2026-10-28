import { type Column, EmptyState, Icon, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { LoadErrorBanner } from './load-error-banner';
import { useUserNames, useVersionHistory } from './queries';
import type { CompareLabels } from './version-compare';
import { toHistoryRow, type HistoryRow } from './version-history';

const t = messages.inspectionStandard;

export interface VersionHistoryTableProps {
  inspectionPlanVersionId: number;
  labels: CompareLabels;
}

/**
 * 버전 변경 이력 표(사용자 지시 · omf-all-around#196) — 일시 · 처리자 · 구분 · 변경 내용.
 * 서버가 버전 쓰기마다 남긴 감사 이력을 최근 1년만 읽는다. 최신이 위다.
 */
export const VersionHistoryTable = ({
  inspectionPlanVersionId,
  labels,
}: VersionHistoryTableProps) => {
  const history = useVersionHistory(inspectionPlanVersionId);
  const events = history.data?.items ?? [];
  const nameOf = useUserNames(events.map((event) => event.performedBy));

  if (history.isError) {
    return <LoadErrorBanner error={history.error} onRetry={() => void history.refetch()} />;
  }
  if (history.data === undefined) {
    return (
      <div role="status" aria-label={t.history.loading}>
        <SkeletonText lines={3} />
      </div>
    );
  }

  const rows = [...events]
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .map((event) => toHistoryRow(event, labels));

  const columns: Column<HistoryRow>[] = [
    {
      key: 'occurredAt',
      header: t.history.occurredAt,
      align: 'center',
      width: '160px',
      render: (row) => formatPlantDateTime(row.occurredAt) ?? t.values.empty,
    },
    {
      key: 'performedBy',
      header: t.history.performedBy,
      align: 'center',
      width: '120px',
      render: (row) =>
        row.performedBy === null
          ? t.history.system
          : (nameOf(row.performedBy) ?? t.history.unknownUser(row.performedBy)),
    },
    { key: 'action', header: t.history.action, align: 'center', width: '140px' },
    {
      key: 'changes',
      header: t.history.changes,
      align: 'center',
      render: (row): ReactNode =>
        row.changes.length === 0 ? (
          t.values.empty
        ) : (
          <ul className="inspection-standard-compare-changes">
            {row.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        ),
    },
  ];

  return (
    <div className="inspection-standard-history">
      <div className="inspection-queue-table inspection-standard-table-box inspection-standard-history-rows">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          getRowId={(row) => String(row.id)}
          empty={
            <EmptyState
              size="sm"
              icon={<Icon name="history" size={32} />}
              title={t.history.none}
              description={t.history.noneDescription}
            />
          }
        />
      </div>
      <p className="field-note">{t.history.rangeNote}</p>
    </div>
  );
};
