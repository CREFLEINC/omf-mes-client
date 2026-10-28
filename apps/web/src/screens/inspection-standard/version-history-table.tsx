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
  /** 조회 기간 표기를 표 위 오른쪽에 둔다 — 창에서는 제목 줄이 대신 말한다(#196). */
  showRange?: boolean;
}

/**
 * 버전 변경 이력 표(사용자 지시 · omf-all-around#196) — 일시 · 처리자 · 구분 · 변경 내용.
 * 서버가 버전 쓰기마다 남긴 감사 이력을 최근 1년만 읽는다. 최신이 위다.
 */
export const VersionHistoryTable = ({
  inspectionPlanVersionId,
  labels,
  showRange = false,
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
      /* 바뀐 칸마다 한 줄 — 이름은 왼쪽, 「전 → 후」는 오른쪽, 바뀐 뒤 값은 초록(사용자 시안 · #196). */
      render: (row): ReactNode =>
        row.changes.length === 0 ? (
          t.values.empty
        ) : (
          <ul className="inspection-standard-history-changes">
            {row.changes.map((change) => (
              <li key={`${change.label}:${change.note ?? ''}`}>
                <span className="inspection-standard-history-label">{change.label}</span>
                {change.note === undefined ? (
                  <span className="inspection-standard-history-value">
                    {change.before}
                    <Icon name="arrow_forward" size={14} aria-label="→" />
                    <span className="inspection-standard-history-after">{change.after}</span>
                  </span>
                ) : (
                  <span className="inspection-standard-history-note" data-tone={change.note}>
                    {change.note === 'added' ? t.history.itemAdded : t.history.itemRemoved}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ),
    },
  ];

  return (
    <div className="inspection-standard-history">
      {showRange && <p className="inspection-standard-history-range">{t.history.range}</p>}
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
    </div>
  );
};
