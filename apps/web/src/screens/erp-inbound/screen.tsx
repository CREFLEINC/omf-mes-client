import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  Icon,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { BoardTable } from '../../patterns/board-table';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { InfoTip } from '../../patterns/info-tip';
import { OneLine, useFitToViewport } from '../../patterns/po-board';
import { toApiError } from '../../patterns/request';
import { describeLoadError, LoadErrorBanner } from '../../patterns/load-error-banner';
import { formatDateTime } from '../integration-sync/message-status';
import {
  isRunFinished,
  SYNC_RESULT,
  toSyncStateView,
  useRequestSyncRun,
  useSyncTables,
  type SyncTableStatus,
} from './sync-tables';

const t = messages.erpInbound;

/** 값이 없는 칸은 비워 두지 않는다 — 자료가 없는 것인지 화면이 빠뜨린 것인지 구분되지 않는다. */
const orEmptyMark = (value: string | number | null): ReactNode =>
  value === null ? t.values.empty : value;

/**
 * 누른 표의 기다림. `baseline` 은 누를 때 보이던 마지막 끝난 시각이고, `seenRequest` 는 목록이 그 요청을
 * 한 번이라도 실었는가다 — 싣기 전에 받은 목록(누르기 전에 떠난 다시 읽기)으로 「사라졌다」고 판정하지 않는다.
 */
/** 상태 칩 — 칩만(한 줄 · #358). 실패 사유는 「오류 내용」 열에서 본다. */
const StateChip = ({ item }: { item: SyncTableStatus }) => {
  const view = toSyncStateView(item);

  return (
    <Chip variant="status" size="sm" status={view.tone}>
      {view.label}
    </Chip>
  );
};

interface PendingRun {
  baseline: string | null;
  seenRequest: boolean;
}

/**
 * ERP 수신 — ERP 받기 표 여덟의 상태와 「지금 읽기」(omf-mes-server#757 · 장부 P-81).
 *
 * 「ERP 연동 현황·이력」 묶음의 탭이다(사용자 지시 2026-10-27 — 연동 현황·이력 위에 접혀 있던 받기 상태를 탭으로 뗐다).
 * 받는 표 목록 한 상자(#358) — 줄마다 읽기 결과 · 「지금 읽기」. 조회 상자 · 쪽 넘김 · 상세 상자는 두지 않는다.
 * 주소에는 아무것도 두지 않는다. 읽은 결과의 실패 건은 「연동 현황·이력」 탭에서 다시 보낸다.
 *
 * 끝을 아는 법은 서버가 정했다 — 요청 시각이 비고 마지막 끝난 시각이 바뀌면 다 읽은 것이다.
 * 그때 결과를 알림으로 한 번 알린다(창을 열어 둔 채 다른 일을 하는 사람이 표를 다시 보지 않아도 되게).
 */
export const ErpInboundScreen = () => {
  const disabledReasonId = useId();
  const hubTarget = useHubActionsTarget();
  const toast = useToast();
  const status = useSyncTables();
  const run = useRequestSyncRun();
  const [pending, setPending] = useState<Record<string, PendingRun>>({});
  /* 목록이 창 바닥에서 멈추게 윗변을 잰다(다른 #358 화면과 같은 아래 여백). */
  const { splitRef } = useFitToViewport();

  const items = status.data?.items ?? [];
  const enabled = status.data?.enabled ?? false;
  /* 탭 막대 칩의 건수 — 받는 표마다 최근 수신의 반영 · 실패 · 보류를 더한다(#358). */
  const totalOf = (key: 'lastAppliedCount' | 'lastFailedCount' | 'lastHeldCount'): number =>
    items.reduce((sum, item) => sum + (item[key] ?? 0), 0);
  const chipCounts = [
    { key: 'applied', count: totalOf('lastAppliedCount'), tone: 'info', text: t.chips.applied },
    { key: 'failed', count: totalOf('lastFailedCount'), tone: 'error', text: t.chips.failed },
    { key: 'held', count: totalOf('lastHeldCount'), tone: 'warning', text: t.chips.held },
  ] as const;
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

  /*
   * 목록 한 줄에 표의 요약을 다 낸다 — 수신 항목 · 구분 · 상태(칩만) · 최근 수신 · 다음 수신 예정 · 읽음 · 반영 · 실패 · 보류,
   * 오류 내용 · 「지금 읽기」 — 모두 가운데 정렬(연동 현황·이력과 같다). 상세 상자는 두지 않는다(사용자 지시 2026-11-24).
   * 폭이 모자라면 표가 옆으로 구른다(`minWidth`) — 수신 항목 이름이 잘리지 않게.
   */
  const countColumn = (
    key: 'lastReadCount' | 'lastAppliedCount' | 'lastFailedCount' | 'lastHeldCount',
    header: string,
  ): Column<SyncTableStatus> => ({
    key,
    header,
    align: 'center',
    width: '72px',
    render: (item) => orEmptyMark(item[key]),
  });
  const columns: Column<SyncTableStatus>[] = [
    { key: 'name', header: t.table.name, align: 'center', width: '112px' },
    { key: 'laneName', header: t.table.lane, align: 'center', width: '88px' },
    {
      key: 'state',
      header: t.table.state,
      align: 'center',
      width: '96px',
      render: (item) => <StateChip item={item} />,
    },
    {
      key: 'lastFinishedAt',
      header: t.table.lastFinishedAt,
      align: 'center',
      width: '160px',
      render: (item) => orEmptyMark(formatDateTime(item.lastFinishedAt)),
    },
    {
      key: 'nextRunAt',
      header: t.table.nextRunAt,
      align: 'center',
      width: '180px',
      render: (item) => orEmptyMark(formatDateTime(item.nextRunAt)),
    },
    countColumn('lastReadCount', t.table.read),
    countColumn('lastAppliedCount', t.table.applied),
    countColumn('lastFailedCount', t.table.failed),
    countColumn('lastHeldCount', t.table.held),
    {
      key: 'lastErrorMessage',
      header: t.table.lastErrorMessage,
      align: 'center',
      width: '160px',
      render: (item) => <OneLine text={item.lastErrorMessage ?? t.values.empty} />,
    },
    {
      key: 'action',
      header: t.table.action,
      align: 'center',
      width: '120px',
      /*
       * 요청이 걸려 있는 동안은 잠근다 — 다시 눌러도 서버가 처음 시각을 지켜 한 번 돌 뿐이라 누를 까닭이 없다.
       * **도는 중에는 잠그지 않는다.** 도는 사이에 들어온 줄은 그 회차가 놓칠 수 있어, 서버가 한 번 더 돈다.
       */
      render: (item) => (
        <Button
          variant="outlined"
          size="sm"
          leadingIcon={<Icon name="refresh" size={18} aria-hidden />}
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
  /* 열 순서는 머리칸 손잡이로 바꾸고 브라우저에 남는다(단말 관리와 같다 · #358). 폭은 `BoardTable` 이 맡는다. */
  const ordered = useColumnOrder('omf-mes:erp-inbound:columns:tables:order', columns);

  const listSlot = (): ReactNode => {
    if (status.isError) {
      return <LoadErrorBanner error={status.error} onRetry={() => void status.refetch()} />;
    }
    if (status.isPending) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <>
        <div className="erp-link-list-body">
          <BoardTable
            label={t.table.label}
            widthKey="omf-mes:erp-inbound:columns:tables"
            minWidth="78rem"
            columns={ordered}
            rows={items}
            getRowId={(item) => item.interfaceCode}
            empty={<EmptyState size="sm" title={t.empty} />}
          />
        </div>
      </>
    );
  };

  return (
    <>
      {/* 탭 막대 오른쪽 — 이 서버의 수신 켜짐 · 꺼짐(사용자 지시 2026-10-28)과 반영 · 실패 · 보류 건수(#358). 받기 전에는 세우지 않는다. */}
      {hubTarget !== null && status.data !== undefined && (
        <HubActions target={hubTarget}>
          {/* 켜짐 · 꺼짐 — 칩이 아니라 「● 수신 ON」 점 + 글자로 건수 칩 바로 오른쪽에(사용자 지시 2026-11-24). */}
          <span className="erp-link-state" data-on={enabled ? 'true' : 'false'}>
            {enabled ? t.chips.receiveOn : t.chips.receiveOff}
          </span>
          <div className="erp-send-chips" role="group" aria-label={t.chips.label}>
            {/* 반영 · 실패 · 보류 — 0건인 칩은 세우지 않는다(ERP 송신의 대기 · 실패 칩과 같다). */}
            {chipCounts
              .filter((chip) => chip.count > 0)
              .map((chip) => (
                <Chip key={chip.key} variant="status" size="sm" status={chip.tone}>
                  {chip.text(chip.count)}
                </Chip>
              ))}
          </div>
        </HubActions>
      )}
      {/*
       * 목록 한 상자 — 조회 상자 · 쪽 넘김 · 상세 상자는 두지 않는다(받는 표 여덟이 한 화면에 다 든다 · 「지금 읽기」는
       * 목록 줄마다 · 사용자 지시 2026-11-24). 목록 상자 짜임 · 클래스는 다른 #358 화면(`ListDetailWorkspace`)과 같다.
       */}
      <div className="list-detail-workspace">
        <div ref={splitRef} className="po-board-split list-detail-split erp-inbound-split">
          <section className="pane list-detail-list" aria-label={t.panes.list}>
            <div className="po-board-list-head">
              <h2 className="pane-title">{t.panes.list}</h2>
              {status.data !== undefined && (
                <span className="po-board-list-count">
                  {messages.common.paneList.count(items.length)}
                </span>
              )}
              {/* 연동이 꺼진 서버에서만 — 건수 오른쪽 ⓘ, 마우스를 올리면 사유가 뜬다(사용자 지시 2026-11-25). */}
              {status.data !== undefined && !enabled && <InfoTip text={t.disabledReason} />}
            </div>
            {run.isError && (
              <AlertBanner variant="error" title={t.runErrorTitle}>
                {describeLoadError(toApiError(run.error))}
              </AlertBanner>
            )}
            {/* 꺼진 「지금 읽기」 단추의 설명(aria-describedby) — 보이는 안내는 건수 옆 ⓘ 로 옮겼다. */}
            {status.data !== undefined && !enabled && (
              <span id={disabledReasonId} className="visually-hidden">
                {t.disabledReason}
              </span>
            )}
            {listSlot()}
          </section>
        </div>
      </div>
    </>
  );
};

/** 다 읽은 표 하나의 알림. 실패 건이 있으면 성공으로 칠하지 않는다 — 연동 현황·이력에서 다시 보내야 한다. */
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
