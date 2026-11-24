import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  Icon,
  SearchInput,
  Select,
  SkeletonText,
  useToast,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type ReactNode } from 'react';

import { BoardTable } from '../../patterns/board-table';
import { useClientPage } from '../../patterns/client-page';
import { useColumnOrder } from '../../patterns/column-grip-order';
import { hasChangedFilters } from '../../patterns/filter-more';
import {
  FIT_PLACEHOLDER_CLASS,
  useFitPlaceholderWidth,
} from '../../patterns/fit-placeholder-width';
import { HubActions, useHubActionsTarget } from '../../patterns/hub-actions';
import { ListDetailWorkspace } from '../../patterns/list-detail-workspace';
import { PageNav } from '../../patterns/page-nav';
import { toApiError } from '../../patterns/request';
import { describeLoadError, LoadErrorBanner } from '../../patterns/load-error-banner';
import { ERP_LINK_ORIENTATION_KEY } from '../integration-sync/erp-link-layout';
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
/** 상태 칩 — 목록은 칩만(한 줄 · #358). 요청 시각 · 실패 사유는 상세에서 본다. */
const StateChip = ({ item }: { item: SyncTableStatus }) => {
  const view = toSyncStateView(item);

  return (
    <Chip variant="status" size="sm" status={view.tone}>
      {view.label}
    </Chip>
  );
};

/** 조회 조건 — 이름 검색어 · 구분(laneCode) · 상태(상태 칩 글자). 빈 값은 조건 없음. */
interface InboundFilters {
  q: string;
  lane: string;
  state: string;
}

const EMPTY_FILTERS: InboundFilters = { q: '', lane: '', state: '' };

/** 상태 선택지 — 상태 칩 글자 그대로(성공 · 실패 · 대기 중 · 읽는 중 · 기록 없음). */
const STATE_OPTIONS = [
  t.state.succeeded,
  t.state.failed,
  t.state.requested,
  t.state.running,
  t.state.never,
];

/**
 * 화면 안에서만 거른다(서버 요청은 그대로 · #358). 이름은 앞뒤 빈칸 · 대소문자를 가리지 않는다.
 * 상태는 목록의 상태 칩과 같은 판정(`toSyncStateView`)으로 견준다 — 칩에 보이는 것과 거르는 것이 어긋나지 않게.
 */
const matchesFilters = (item: SyncTableStatus, filters: InboundFilters): boolean =>
  item.name.toLowerCase().includes(filters.q.trim().toLowerCase()) &&
  (filters.lane === '' || item.laneCode === filters.lane) &&
  (filters.state === '' || toSyncStateView(item).label === filters.state);

interface PendingRun {
  baseline: string | null;
  seenRequest: boolean;
}

/**
 * ERP 수신 — ERP 받기 표 여덟의 상태와 「지금 읽기」(omf-mes-server#757 · 장부 P-81).
 *
 * 「ERP 연동 현황·이력」 묶음의 탭이다(사용자 지시 2026-10-27 — 연동 현황·이력 위에 접혀 있던 받기 상태를 탭으로 뗐다).
 * 단말 관리와 같은 틀(#358) — 위 조회 상자(표 이름 검색 · 화면 안 거르기), 아래 왼쪽 받는 표 목록 | 오른쪽 고른 표의
 * 상세(읽기 결과 · 「지금 읽기」). 주소에는 아무것도 두지 않는다. 읽은 결과의 실패 건은 「연동 현황·이력」 탭에서 다시 보낸다.
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
  /* 조회 조건 — 고치는 값(`draft`)과 [조회]로 건 값(`applied`). 고른 표는 `interfaceCode` 로 잡는다(#358). */
  const [draft, setDraft] = useState<InboundFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<InboundFilters>(EMPTY_FILTERS);
  const searchRef = useFitPlaceholderWidth(t.filters.searchPlaceholder);
  const fieldId = useId();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const items = status.data?.items ?? [];
  const enabled = status.data?.enabled ?? false;
  const shownItems = items.filter((item) => matchesFilters(item, applied));
  /* 구분 선택지 — 받은 표들의 묶음에서 만든다(기준정보 · 전표). 순서는 서버가 준 순서. */
  const laneOptions = [...new Map(items.map((item) => [item.laneCode, item.laneName])).entries()];
  /* 받는 표는 다 받는 작은 목록이라 화면에서 쪽을 나눈다(#358). */
  const itemPage = useClientPage(shownItems);
  const selected = items.find((item) => item.interfaceCode === selectedCode) ?? null;

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
   * 모두 가운데 정렬(연동 현황·이력과 같다 · 사용자 지시 2026-11-24). 요청 시각 · 실패 사유와 「지금 읽기」는 상세에서 본다.
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
            minWidth="58rem"
            columns={ordered}
            rows={itemPage.rows}
            getRowId={(item) => item.interfaceCode}
            pick={{
              columnKey: 'name',
              label: (item) => t.detail.pickRow(item.name),
              currentId: selectedCode,
              onPick: (item) => {
                setSelectedCode(item.interfaceCode);
              },
            }}
            empty={<EmptyState size="sm" live title={items.length === 0 ? t.empty : t.noMatch} />}
          />
        </div>
        <PageNav {...itemPage.nav} buttonSize="md" />
      </>
    );
  };

  /** 오른쪽 상세 — 고른 표의 마지막 읽기 결과와 「지금 읽기」. */
  const detailSlot = (): ReactNode => {
    if (selected === null) {
      /* 단말 관리와 같은 빈 상태(#358). */
      return (
        <EmptyState
          size="sm"
          className="users-roles-pick-empty"
          icon={
            <span className="inspection-standard-empty-icon">
              <Icon name="download" size={20} />
            </span>
          }
          title={t.detail.pick}
          description={t.detail.pickDescription}
        />
      );
    }

    const view = toSyncStateView(selected);
    /* 요청 시각은 칩 옆 보조 줄, 실패 사유는 아래 빨간 칸으로 나눠 보인다(연동 현황·이력과 같다 · #358). */
    const requestNote = selected.requestedAt !== null ? view.note : null;
    const errorMessage = selected.lastErrorMessage ?? '';

    return (
      <div className="integration-sync-detail erp-inbound-detail">
        <div className="erp-inbound-detail-head">
          {/* 상자 제목 — 목록 상자의 「받는 표 목록」과 짝(#358). */}
          <h2 className="pane-title">{t.panes.detail}</h2>
          {/*
           * 요청이 걸려 있는 동안은 잠근다 — 다시 눌러도 서버가 처음 시각을 지켜 한 번 돌 뿐이라 누를 까닭이 없다.
           * **도는 중에는 잠그지 않는다.** 도는 사이에 들어온 줄은 그 회차가 놓칠 수 있어, 서버가 한 번 더 돈다.
           */}
          <Button
            variant="outlined"
            size="sm"
            leadingIcon={<Icon name="refresh" size={18} aria-hidden />}
            disabled={!enabled}
            aria-describedby={enabled ? undefined : disabledReasonId}
            loading={
              selected.requestedAt !== null ||
              (run.isPending && run.variables === selected.interfaceCode)
            }
            aria-label={t.actions.runNowRow(selected.name)}
            onClick={() => {
              requestRun(selected);
            }}
          >
            {t.actions.runNow}
          </Button>
        </div>

        {run.isError && (
          <AlertBanner variant="error" title={t.runErrorTitle}>
            {describeLoadError(toApiError(run.error))}
          </AlertBanner>
        )}

        {/* 배치 규범 4 — 비활성 사유는 감추지 않고 항상 보이는 DOM 텍스트로 낸다. 연동이 꺼진 서버에서만 선다. */}
        {!enabled && (
          <p id={disabledReasonId} className="field-note">
            {t.disabledReason}
          </p>
        )}

        {/* 정보 상자 하나 — 검사 조회·판정 · 연동 현황·이력과 같은 모양(첫 칸에 표 이름 + 상태 배지 · #358). */}
        <dl className="parts-iqc-facts iqc-inbound-facts integration-sync-facts">
          <div className="parts-iqc-fact">
            <dt className="field-label">{t.table.name}</dt>
            <dd className="iqc-inbound-lot-key">
              <h3 className="parts-iqc-fact-key">{selected.name}</h3>
              <Chip variant="status" size="sm" status={view.tone}>
                {view.label}
              </Chip>
              {requestNote !== null && <span className="parts-iqc-fact-sub">{requestNote}</span>}
            </dd>
          </div>
          {[
            { label: t.table.lane, value: selected.laneName },
            {
              label: t.table.lastFinishedAt,
              value: orEmptyMark(formatDateTime(selected.lastFinishedAt)),
            },
            { label: t.table.nextRunAt, value: orEmptyMark(formatDateTime(selected.nextRunAt)) },
            { label: t.table.read, value: orEmptyMark(selected.lastReadCount) },
            { label: t.table.applied, value: orEmptyMark(selected.lastAppliedCount) },
            { label: t.table.failed, value: orEmptyMark(selected.lastFailedCount) },
            { label: t.table.held, value: orEmptyMark(selected.lastHeldCount) },
          ].map((fact) => (
            <div className="parts-iqc-fact" key={fact.label}>
              <dt className="field-label">{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>

        {/* 실패 사유는 값이 있을 때만, 정보 상자 바로 아래 전체 폭으로(#358). */}
        {errorMessage !== '' && (
          <div className="integration-sync-detail-error">
            <span className="field-label">{t.table.lastErrorMessage}</span>
            <p>{errorMessage}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* 탭 막대 오른쪽 — 이 서버의 수신 켜짐 · 꺼짐(사용자 지시 2026-10-28). 받기 전에는 세우지 않는다. */}
      {hubTarget !== null && status.data !== undefined && (
        <HubActions target={hubTarget}>
          <div className="erp-send-chips" role="group" aria-label={t.chips.label}>
            <Chip variant="status" size="sm" status={enabled ? 'success' : 'warning'}>
              {enabled ? t.chips.receiveOn : t.chips.receiveOff}
            </Chip>
          </div>
        </HubActions>
      )}
      <ListDetailWorkspace
        storageKey="omf-mes:erp-inbound"
        orientationKey={ERP_LINK_ORIENTATION_KEY}
        initialRatio={0.65}
        filter={{
          label: t.filters.label,
          content: (
            /* 구분 · 상태 · 수신 항목 검색 + [조회][초기화](이 순서 · 사용자 지시 2026-11-24)(단말 관리와 같다 · #358).
               초기화는 조건이 처음 값(빈칸 · 전체)과 다를 때만 보인다. */
            <div className="filter-bar erp-link-filter">
              {/* 구분 · 상태 — 선택지가 몇 개 안 돼 검색창 없이 펼친다(#358). */}
              <div className="field-cell">
                <label className="field-label" htmlFor={`${fieldId}-lane`}>
                  {t.filters.lane}
                </label>
                <Select
                  id={`${fieldId}-lane`}
                  value={draft.lane}
                  options={[
                    { value: '', label: t.filters.all },
                    ...laneOptions.map(([code, name]) => ({ value: code, label: name })),
                  ]}
                  onChange={(value) => {
                    setDraft((prev) => ({ ...prev, lane: value }));
                  }}
                />
              </div>
              <div className="field-cell">
                <label className="field-label" htmlFor={`${fieldId}-state`}>
                  {t.filters.state}
                </label>
                <Select
                  id={`${fieldId}-state`}
                  value={draft.state}
                  options={[
                    { value: '', label: t.filters.all },
                    ...STATE_OPTIONS.map((label) => ({ value: label, label })),
                  ]}
                  onChange={(value) => {
                    setDraft((prev) => ({ ...prev, state: value }));
                  }}
                />
              </div>
              <SearchInput
                containerClassName={`erp-link-search-input ${FIT_PLACEHOLDER_CLASS}`}
                label={t.filters.search}
                value={draft.q}
                placeholder={t.filters.searchPlaceholder}
                ref={searchRef}
                onChange={(event) => {
                  setDraft((prev) => ({ ...prev, q: event.target.value }));
                }}
                onSearch={(value) => {
                  setApplied({ ...draft, q: value });
                }}
                clearLabel={messages.common.clear}
              />
              <div className="filter-actions field-cell-unlabeled">
                <Button
                  onClick={() => {
                    setApplied(draft);
                  }}
                >
                  {messages.common.search}
                </Button>
                {hasChangedFilters(EMPTY_FILTERS, draft, applied) && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setDraft(EMPTY_FILTERS);
                      setApplied(EMPTY_FILTERS);
                    }}
                  >
                    {messages.common.reset}
                  </Button>
                )}
              </div>
            </div>
          ),
        }}
        list={{
          label: t.panes.list,
          title: t.panes.list,
          count: status.data === undefined ? undefined : shownItems.length,
          content: listSlot(),
        }}
        detail={{ label: t.panes.detail, content: detailSlot() }}
      />
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
