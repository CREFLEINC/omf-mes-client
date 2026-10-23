import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
  useToast,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { toApiError } from '../../patterns/request';
import { describeLoadError, LoadErrorBanner } from './load-error-banner';
import { formatDateTime } from './message-status';
import {
  isRunFinished,
  SYNC_RESULT,
  toSyncStateView,
  useRequestSyncRun,
  useSyncTables,
  type SyncTableStatus,
} from './sync-tables';

const t = messages.integrationSync.syncTables;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | number | null): ReactNode =>
  value === null ? messages.integrationSync.values.empty : value;

/**
 * 누른 표의 기다림. `baseline` 은 누를 때 보이던 마지막 끝난 시각이고, `seenRequest` 는 목록이 그 요청을
 * 한 번이라도 실었는가다 — 싣기 전에 받은 목록(누르기 전에 떠난 다시 읽기)으로 「사라졌다」고 판정하지 않는다.
 */
interface PendingRun {
  baseline: string | null;
  seenRequest: boolean;
}

/**
 * ERP 받기 표 여덟의 상태와 「지금 읽기」(omf-mes-server#757 · 장부 P-81).
 *
 * 연계 메시지 목록 **위에** 둔다 — 「지금 읽었는가」가 먼저 읽히고, 읽은 결과의 실패 건은 아래 목록에서
 * 다시 보낸다. 조회 조건(기간·상태)과 무관한 현재 상태라 주소에 아무것도 두지 않는다.
 *
 * 끝을 아는 법은 서버가 정했다 — 요청 시각이 비고 마지막 끝난 시각이 바뀌면 다 읽은 것이다.
 * 그때 결과를 알림으로 한 번 알린다(창을 열어 둔 채 다른 일을 하는 사람이 표를 다시 보지 않아도 되게).
 */
export const SyncTablePanel = () => {
  const titleId = useId();
  const disabledReasonId = useId();
  const toast = useToast();
  const status = useSyncTables();
  const run = useRequestSyncRun();
  const [pending, setPending] = useState<Record<string, PendingRun>>({});

  const items = status.data?.items ?? [];
  const enabled = status.data?.enabled ?? false;

  useEffect(() => {
    const waits = Object.entries(pending);
    if (status.data === undefined || waits.length === 0) return;

    const next = { ...pending };
    let changed = false;

    for (const [code, wait] of waits) {
      const item = status.data.items.find((candidate) => candidate.interfaceCode === code);

      if (item === undefined) {
        delete next[code];
        changed = true;
        continue;
      }

      if (isRunFinished(item, wait.baseline)) {
        delete next[code];
        changed = true;
        toast.show(finishedToast(item));
        continue;
      }

      if (item.requestedAt !== null && !wait.seenRequest) {
        next[code] = { ...wait, seenRequest: true };
        changed = true;
        continue;
      }

      /*
       * 요청이 실렸다가 결과 기록 없이 사라졌다(서버의 결과 기록이 실패한 경우). 알릴 결과가 없으니
       * 조용히 기다림을 접는다 — 남겨 두면 다음 주기 회차의 결과를 이 요청의 것으로 알린다.
       */
      if (wait.seenRequest && item.requestedAt === null && !item.running) {
        delete next[code];
        changed = true;
      }
    }

    if (changed) setPending(next);
  }, [pending, status.data, toast]);

  const requestRun = (item: SyncTableStatus) => {
    run.reset();
    run.mutate(item.interfaceCode, {
      onSuccess: () => {
        setPending((current) => ({
          ...current,
          [item.interfaceCode]: { baseline: item.lastFinishedAt, seenRequest: false },
        }));
      },
    });
  };

  const columns: Column<SyncTableStatus>[] = [
    { key: 'name', header: t.table.name, width: '112px' },
    /* 폭을 지정하지 않는 열 — 실패 사유가 길 수 있어 남는 폭을 이 열이 가져간다. */
    {
      key: 'state',
      header: t.table.state,
      render: (item) => {
        const view = toSyncStateView(item);

        return (
          <>
            <Chip variant="status" size="sm" status={view.tone}>
              {view.label}
            </Chip>
            {view.note !== null && <span className="field-note">{view.note}</span>}
          </>
        );
      },
    },
    {
      key: 'lastFinishedAt',
      header: t.table.lastFinishedAt,
      width: '148px',
      render: (item) => orEmptyMark(formatDateTime(item.lastFinishedAt)),
    },
    {
      key: 'lastReadCount',
      header: t.table.read,
      align: 'end',
      width: '64px',
      render: (item) => orEmptyMark(item.lastReadCount),
    },
    {
      key: 'lastAppliedCount',
      header: t.table.applied,
      align: 'end',
      width: '64px',
      render: (item) => orEmptyMark(item.lastAppliedCount),
    },
    {
      key: 'lastFailedCount',
      header: t.table.failed,
      align: 'end',
      width: '64px',
      render: (item) => orEmptyMark(item.lastFailedCount),
    },
    {
      key: 'lastHeldCount',
      header: t.table.held,
      align: 'end',
      width: '64px',
      render: (item) => orEmptyMark(item.lastHeldCount),
    },
    {
      key: 'nextRunAt',
      header: t.table.nextRunAt,
      width: '148px',
      render: (item) => orEmptyMark(formatDateTime(item.nextRunAt)),
    },
    {
      key: 'action',
      header: t.table.action,
      width: '112px',
      /*
       * 요청이 걸려 있는 동안은 잠근다 — 다시 눌러도 서버가 처음 시각을 지켜 한 번 돌 뿐이라 누를 까닭이 없다.
       * **도는 중에는 잠그지 않는다.** 도는 사이에 들어온 줄은 그 회차가 놓칠 수 있어, 서버가 한 번 더 돈다.
       */
      render: (item) => (
        <Button
          variant="outlined"
          size="sm"
          disabled={!enabled}
          aria-describedby={enabled ? undefined : disabledReasonId}
          loading={
            item.requestedAt !== null || (run.isPending && run.variables === item.interfaceCode)
          }
          aria-label={t.actions.runNowRow(item.name)}
          onClick={() => {
            requestRun(item);
          }}
        >
          {t.actions.runNow}
        </Button>
      ),
    },
  ];

  return (
    <section className="pane" aria-labelledby={titleId}>
      <h2 id={titleId} className="pane-title">
        {t.title}
      </h2>
      <p className="field-note">{t.description}</p>

      {status.isError && (
        <LoadErrorBanner error={status.error} onRetry={() => void status.refetch()} />
      )}

      {run.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.runErrorTitle}>
            {describeLoadError(toApiError(run.error))}
          </AlertBanner>
        </div>
      )}

      {/* 배치 규범 4 — 비활성 사유는 감추지 않고 항상 보이는 DOM 텍스트로 낸다. */}
      {status.data !== undefined && !enabled && (
        <p id={disabledReasonId} className="field-note">
          {t.disabledReason}
        </p>
      )}

      {status.isPending ? (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      ) : (
        !status.isError && (
          <div className="wide-table">
            <Table
              density="compact"
              // 제목이 바로 위 h2 에 보이므로 표 이름은 읽는 이에게만 준다.
              caption={<span className="erp-data-table-caption">{t.title}</span>}
              columns={columns}
              rows={items}
              getRowId={(item) => item.interfaceCode}
              empty={<EmptyState size="sm" title={t.empty} />}
            />
          </div>
        )
      )}
    </section>
  );
};

/** 다 읽은 표 하나의 알림. 실패 건이 있으면 성공으로 칠하지 않는다 — 아래 목록에서 다시 보내야 한다. */
const finishedToast = (item: SyncTableStatus) => {
  if (item.lastStatusCode === SYNC_RESULT.failed) {
    return { variant: 'error' as const, description: t.finished.failed(item.name) };
  }

  const applied = item.lastAppliedCount ?? 0;
  const failed = item.lastFailedCount ?? 0;

  return failed > 0
    ? {
        variant: 'warning' as const,
        description: t.finished.withFailures(item.name, applied, failed),
      }
    : { variant: 'success' as const, description: t.finished.succeeded(item.name, applied) };
};
