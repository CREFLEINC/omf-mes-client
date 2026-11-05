import {
  Button,
  Chip,
  type Column,
  Dialog,
  EmptyState,
  Icon,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { useRoutingHistory, useUserNames } from './queries';
import { toHistoryRow, type HistoryRow } from './revision-history';

const t = messages.routing;

export interface RevisionHistoryDialogProps {
  routingId: number;
  processLabel: (processId: string) => string;
  renderLoadError: (error: unknown, onRetry: () => void) => ReactNode;
  onClose: () => void;
}

/**
 * 변경 이력(사용자 지시 · omf-all-around#231) — 일시 · 처리자 · 구분 · 변경 내용. 최신이 위.
 * 서버가 Routing 쓰기(등록 · 기본 정보 · 공정 구성 · 선후행 · 확정 · 폐기 · 기본 지정 · 신규 Rev)마다 남긴 감사 이력을 최근 1년만 읽는다.
 * 기록을 시작하기 전의 변경은 없다.
 */
export const RevisionHistoryDialog = ({
  routingId,
  processLabel,
  renderLoadError,
  onClose,
}: RevisionHistoryDialogProps) => {
  const history = useRoutingHistory(routingId);
  const events = history.data?.items ?? [];
  const nameOf = useUserNames(events.map((event) => event.performedBy));

  const body = (): ReactNode => {
    if (history.isError) return renderLoadError(history.error, () => void history.refetch());
    if (history.data === undefined) {
      return (
        <div role="status" aria-label={t.history.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }
    const rows = [...events]
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
      .map((event) => toHistoryRow(event, processLabel));
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
        /* 바뀐 칸마다 한 줄 — 이름은 왼쪽, 「전 → 후」는 오른쪽, 바뀐 뒤 값은 초록(검사 기준 변경 이력과 같다 · #231). */
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
                      {change.note === 'added'
                        ? t.history.operationAdded
                        : t.history.operationRemoved}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ),
      },
    ];
    return (
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
    );
  };

  return (
    <Dialog
      open
      size="lg"
      closeOnBackdropClick={false}
      showCloseButton={false}
      title={
        <span className="inspection-standard-dialog-title">
          {t.history.title}
          <Chip variant="status" size="sm" status="idle">
            {t.history.range}
          </Chip>
        </span>
      }
      onClose={onClose}
      footer={
        <Button variant="outlined" onClick={onClose}>
          {messages.common.close}
        </Button>
      }
    >
      {body()}
    </Dialog>
  );
};
