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
import { type ReactNode, useState } from 'react';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { useRoutingHistory, useUserNames } from './queries';
import { toHistoryRow, type HistoryChange, type HistoryRow } from './revision-history';

/** 표 한 줄 — 이력 한 건의 바뀐 칸 하나(없으면 `change: null`). */
interface ChangeRow extends HistoryRow {
  key: string;
  change: HistoryChange | null;
}

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
  const [newestFirst, setNewestFirst] = useState(true);
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
      .sort((left, right) =>
        newestFirst
          ? right.occurredAt.localeCompare(left.occurredAt)
          : left.occurredAt.localeCompare(right.occurredAt),
      )
      .map((event) => toHistoryRow(event, processLabel))
      /*
       * 바뀐 칸 하나가 표 한 줄 — 「변경 항목 | 변경 전 | 변경 후」(사용자 시안 · #231). 한 번에 여러 칸이 바뀌었으면
       * 같은 일시 · 처리자 · 구분으로 여러 줄이 된다. 바뀐 칸이 없는 이력(등록 · 신규 Rev 발행)은 한 줄에 「—」.
       */
      .flatMap((row): ChangeRow[] =>
        row.changes.length === 0
          ? [{ ...row, key: String(row.id), change: null }]
          : row.changes.map((change, index) => ({
              ...row,
              key: `${String(row.id)}:${String(index)}`,
              change,
            })),
      );
    const afterCell = (change: HistoryChange): ReactNode =>
      change.note === undefined ? (
        <span className="inspection-standard-history-after">{change.after}</span>
      ) : (
        <span className="inspection-standard-history-note" data-tone={change.note}>
          {change.note === 'added' ? t.history.operationAdded : t.history.operationRemoved}
        </span>
      );
    const columns: Column<ChangeRow>[] = [
      {
        key: 'occurredAt',
        header: t.history.occurredAt,
        align: 'center',
        width: '160px',
        /* 일시 머리를 누르면 오름 · 내림차순을 오간다(사용자 지시 · #231). 처음은 최신이 위. */
        sortable: true,
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
        key: 'field',
        header: t.history.changeField,
        render: (row) => row.change?.label ?? t.values.empty,
      },
      {
        key: 'before',
        header: t.history.before,
        render: (row) =>
          row.change === null || row.change.note !== undefined
            ? t.values.empty
            : (row.change.before ?? t.values.empty),
      },
      {
        key: 'after',
        header: t.history.after,
        /* 바뀐 뒤 값은 초록 — 공정 추가는 초록, 삭제는 빨강(검사 기준 변경 이력과 같은 색 · #231). */
        render: (row) => (row.change === null ? t.values.empty : afterCell(row.change)),
      },
    ];
    return (
      <div className="inspection-queue-table inspection-standard-table-box inspection-standard-history-rows routing-history-rows">
        <Table
          density="compact"
          columns={columns}
          rows={rows}
          /* 정렬 해제 단계 없이 두 방향만 오가도록 화면이 쥔다 — 해제되면 「무슨 순서인지」 알 수 없다. */
          sort={{ key: 'occurredAt', direction: newestFirst ? 'descending' : 'ascending' }}
          onSortChange={() => setNewestFirst((value) => !value)}
          getRowId={(row) => row.key}
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
      /* 변경 내용이 길어 창을 화면 폭에 맞춰 넓힌다(사용자 지시 · #231). */
      className="routing-history-dialog"
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
