import { AlertBanner, Breadcrumb, Button, EmptyState, Icon, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { useApiClient } from '../api-context';
import { plantToday } from '../plant-time';
import { PaneListHead, PaneSplitter, useFitToViewport, usePaneSplit } from '../po-board';
import { ApiRequestError } from '../request';
import { ScreenHeader } from '../screen-header';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../split-orientation';
import { TraceExportButton, useTraceExportRun } from './export';
import { TraceFilterBar } from './filter-bar';
import { buildLineage, firstView, locate, type TreeView } from './graph-rows';
import { traceLotHref } from './href';
import {
  SCAN_CAP,
  applyScan,
  conditionRows,
  initialListState,
  recentRows,
  startCondition,
  type ListCondition,
  type ListEntry,
  type LotListState,
  type ScanNotice,
} from './lot-list-state';
import { TraceListFailure, TraceLotList } from './lot-list';
import { defaultPeriod } from './period';
import {
  IQC_JUDGMENT_GROUP,
  LOT_STATUS_GROUP,
  WORK_ORDER_STATUS_GROUP,
  fetchLotNo,
  fetchTraceStarts,
  partnerRoleOf,
  traceTreeKeys,
  useCodeNames,
  useConditionLots,
  usePartnerLabel,
  usePartnerSource,
  useRecentLots,
  useTracePlants,
  useTraceTree,
  type TraceTree,
} from './queries';
import { TraceTreeTable, type TraceNames } from './tree-table';
import type { TraceDirection, TraceStartMatch } from './types';

const t = messages.traceTree;

const POSITIVE = /^[1-9][0-9]*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const positive = (raw: string | null): number | null =>
  raw !== null && POSITIVE.test(raw) ? Number(raw) : null;

/** 주소의 조건(`partner`·`from`·`to`) — 셋이 다 맞아야 조건이다. */
export const readCondition = (params: URLSearchParams): ListCondition | null => {
  const partnerId = positive(params.get('partner'));
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  return partnerId !== null && DATE.test(from) && DATE.test(to) ? { partnerId, from, to } : null;
};

export interface TraceDetailContext {
  tree: TraceTree;
  /** 고른 목록 줄(주소로 막 들어와 아직 목록에 없으면 `null`). */
  entry: ListEntry | null;
  names: TraceNames;
  /** 최종 LOT 줄에서 고른 것(줄 열쇠). */
  activeEnd: string | null;
  /** 최종 LOT 줄을 고르면 계보에서 그 항목(`nodeKey`)까지 편다. */
  onLocate: (rowId: string, nodeKey: string) => void;
  partial: boolean;
}

export interface TraceWorkspaceProps {
  direction: TraceDirection;
  /** 고른 LOT 요약(오른쪽 맨 위). */
  renderSummary: (context: TraceDetailContext) => ReactNode;
  /** 최종 LOT 목록(오른쪽 맨 아래). */
  renderEnd: (context: TraceDetailContext) => ReactNode;
}

const NoticeBanner = ({
  notice,
  direction,
  onOpenOther,
  onDismiss,
}: {
  notice: ScanNotice;
  direction: TraceDirection;
  onOpenOther: (lotId: number) => void;
  onDismiss: () => void;
}) => {
  const words = direction === 'FORWARD' ? t.material : t.product;
  switch (notice.kind) {
    case 'added':
    case 'existing':
      return (
        <p className="trace-tree-toast" role="status">
          <Icon name="check_circle" size={18} />
          {notice.kind === 'added'
            ? t.scan.added(
                t.matchedBy[notice.matchedBy],
                notice.label,
                notice.added,
                notice.selected,
              )
            : t.scan.existing(t.matchedBy[notice.matchedBy], notice.label)}
        </p>
      );
    case 'notFound':
      return (
        <AlertBanner
          variant="error"
          title={t.scan.notFoundTitle}
          onDismiss={onDismiss}
          dismissLabel={t.scan.dismiss}
        >
          {words.notFoundHint}
        </AlertBanner>
      );
    case 'otherDirection':
      return (
        <AlertBanner
          variant="info"
          title={words.otherTitle}
          onDismiss={onDismiss}
          dismissLabel={t.scan.dismiss}
          action={
            <Button
              size="sm"
              variant="outlined"
              leadingIcon={<Icon name="open_in_new" size={18} />}
              onClick={() => onOpenOther(notice.lotId)}
            >
              {words.otherOpen}
            </Button>
          }
        >
          {words.otherBody}
        </AlertBanner>
      );
    case 'full':
      return (
        <AlertBanner
          variant="warning"
          title={t.scan.fullTitle(SCAN_CAP)}
          onDismiss={onDismiss}
          dismissLabel={t.scan.dismiss}
        >
          {t.scan.fullBody(notice.label, notice.skipped)}
        </AlertBanner>
      );
    case 'truncated':
      return (
        <AlertBanner
          variant="warning"
          title={t.scan.truncated(notice.label, SCAN_CAP)}
          onDismiss={onDismiss}
          dismissLabel={t.scan.dismiss}
        />
      );
  }
};

const DetailFailure = ({
  error,
  direction,
  onRetry,
}: {
  error: unknown;
  direction: TraceDirection;
  onRetry: () => void;
}) => {
  const status = error instanceof ApiRequestError ? error.httpStatus : undefined;
  if (status === 403) {
    return (
      <AlertBanner variant="warning" title={t.detail.forbiddenTitle}>
        {(direction === 'FORWARD' ? t.material : t.product).forbidden}
      </AlertBanner>
    );
  }
  if (status === 404) {
    return (
      <AlertBanner variant="warning" title={t.detail.notFoundTitle}>
        {t.detail.notFound}
      </AlertBanner>
    );
  }
  return (
    <AlertBanner
      variant="error"
      title={t.detail.loadFailed}
      action={
        <Button size="sm" variant="outlined" onClick={onRetry}>
          {t.detail.retry}
        </Button>
      }
    >
      {t.detail.loadFailedDescription}
    </AlertBanner>
  );
};

/**
 * 추적 두 화면의 틀(피처 015 R-7) — 위 조건 줄 / 왼쪽 LOT 목록 / 오른쪽 고른 LOT 하나(요약 → 계보 → 최종 LOT 목록).
 *
 * - 목록 상태(최근·조건·스캔)는 이 화면 안에 두고, 고른 LOT(`lot`·`serial`)과 조건(`partner`·`from`·`to`)·공장(`plant`)은
 *   주소에 남긴다. 스캔해 쌓은 목록은 주소에 두지 않는다(FR-003).
 * - `?lot=` 으로 들어오거나(다른 화면의 [추적 보기]·옛 주소·뒤로 가기) 목록에 없는 LOT 을 주소가 가리키면, 그 LOT 을
 *   스캔한 것처럼 목록에 넣고 고른다. `?q=` 는 번호 하나를 스캔한 것으로 다루고 주소에서 지운다.
 * - 계보는 LOT 을 고를 때 한 번 부른다. 접기·펴기·묶음은 다시 부르지 않는다.
 */
export const TraceWorkspace = ({ direction, renderSummary, renderEnd }: TraceWorkspaceProps) => {
  const words = direction === 'FORWARD' ? t.material : t.product;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { client } = useApiClient();
  const queryClient = useQueryClient();

  const plants = useTracePlants();
  const plantList = plants.data ?? [];
  const askedPlant = positive(searchParams.get('plant'));
  const plantId =
    plantList.find((plant) => plant.plantId === askedPlant)?.plantId ??
    plantList[0]?.plantId ??
    null;

  const lotId = positive(searchParams.get('lot'));
  const serialNo = searchParams.get('serial');
  const urlCondition = useMemo(() => readCondition(searchParams), [searchParams]);
  const [list, setList] = useState<LotListState>(() =>
    urlCondition === null ? initialListState : startCondition(urlCondition),
  );
  const [notice, setNotice] = useState<ScanNotice | null>(null);
  const [scanning, setScanning] = useState(false);

  const recent = useRecentLots(direction, plantId, list.mode === 'RECENT');
  const conditionQuery = useConditionLots(
    direction,
    plantId,
    list.mode === 'CONDITION' ? list.condition : null,
  );
  const entries = useMemo<ListEntry[]>(
    () =>
      list.mode === 'SCAN'
        ? list.entries
        : list.mode === 'CONDITION'
          ? conditionRows(conditionQuery.data?.pages ?? [])
          : recentRows(recent.data?.items ?? []),
    [list, conditionQuery.data, recent.data],
  );
  const conditionTotal = conditionQuery.data?.pages[0]?.page.total ?? 0;
  const partnerRole = partnerRoleOf(direction);
  const partnerSource = usePartnerSource(partnerRole);
  const partnerLabel = usePartnerLabel(list.condition?.partnerId ?? null, partnerRole);

  const names: TraceNames = {
    lotStatus: useCodeNames(LOT_STATUS_GROUP),
    workOrderStatus: useCodeNames(WORK_ORDER_STATUS_GROUP),
    iqc: useCodeNames(IQC_JUDGMENT_GROUP),
  };

  /** 주소 바꾸기 — `plant` 는 늘 둔다. */
  const writeUrl = (
    next: { lot?: number | null; serial?: string | null; condition?: ListCondition | null },
    replace = false,
  ) => {
    const params = new URLSearchParams();
    if (askedPlant !== null) params.set('plant', String(askedPlant));
    const condition = next.condition === undefined ? urlCondition : next.condition;
    if (condition !== null) {
      params.set('partner', String(condition.partnerId));
      params.set('from', condition.from);
      params.set('to', condition.to);
    }
    const lot = next.lot === undefined ? lotId : next.lot;
    const serial = next.serial === undefined ? serialNo : next.serial;
    if (lot !== null) params.set('lot', String(lot));
    if (lot !== null && serial !== null) params.set('serial', serial);
    setSearchParams(params, { replace });
  };

  const choose = (entry: ListEntry, replace = false) =>
    writeUrl({ lot: entry.row.lot.lotId, serial: entry.serialNo }, replace);

  /** 번호 풀기 결과를 목록에 반영한다 — 고를 LOT 이 있으면 주소에 쓴다. */
  const absorb = (state: LotListState, matches: TraceStartMatch[], replace: boolean) => {
    const outcome = applyScan(state, matches);
    setList(outcome.state);
    setNotice(outcome.notice);
    const keepCondition = outcome.state.mode === 'CONDITION' ? undefined : null;
    if (outcome.select !== null) {
      writeUrl(
        {
          lot: outcome.select.row.lot.lotId,
          serial: outcome.select.serialNo,
          condition: keepCondition,
        },
        replace,
      );
    } else if (outcome.state !== state && urlCondition !== null) {
      writeUrl({ condition: null }, true);
    }
  };

  const scan = async (q: string, replace = false) => {
    if (plantId === null) return;
    setScanning(true);
    try {
      absorb(list, await fetchTraceStarts(client, direction, plantId, q), replace);
    } catch {
      setNotice({ kind: 'notFound' });
    } finally {
      setScanning(false);
    }
  };

  /*
   * 주소가 목록에 없는 LOT 을 가리키면(들어올 때 · 뒤로 가기) 그 LOT 을 번호로 풀어 목록에 넣고 고른다(FR-003).
   * 같은 LOT 을 두 번 풀지 않는다.
   */
  const resolving = useRef<string | null>(null);
  const urlQ = searchParams.get('q');
  const inList = lotId !== null && entries.some((entry) => entry.row.lot.lotId === lotId);
  useEffect(() => {
    if (plantId === null) return;
    if (urlQ !== null && urlQ.trim() !== '') {
      const key = `q:${urlQ}`;
      if (resolving.current === key) return;
      resolving.current = key;
      const params = new URLSearchParams(searchParams);
      params.delete('q');
      setSearchParams(params, { replace: true });
      void scan(urlQ.trim(), true);
      return;
    }
    if (lotId === null || inList) return;
    const key = `lot:${String(lotId)}:${serialNo ?? ''}`;
    if (resolving.current === key) return;
    resolving.current = key;
    void (async () => {
      try {
        const q = serialNo ?? (await fetchLotNo(client, lotId));
        const matches = await fetchTraceStarts(client, direction, plantId, q);
        /* 그 번호의 다른 LOT(입하 LOT 묶음 등)은 빼고 주소의 LOT 하나만 넣는다. */
        const only = matches
          .map((match) => ({ ...match, lots: match.lots.filter((row) => row.lot.lotId === lotId) }))
          .filter((match) => match.lots.length > 0);
        absorb(list, only, true);
      } catch {
        setNotice({ kind: 'notFound' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 주소의 LOT·번호와 공장이 바뀔 때만 푼다
  }, [lotId, serialNo, urlQ, plantId, inList]);

  const tree = useTraceTree(direction, plantId, lotId, serialNo);
  const lineage = useMemo(
    () => (tree.data === undefined ? null : buildLineage(tree.data)),
    [tree.data],
  );
  const [view, setView] = useState<TreeView | null>(null);
  const [activeEnd, setActiveEnd] = useState<string | null>(null);
  useEffect(() => {
    setView(lineage === null ? null : firstView(lineage));
    setActiveEnd(null);
  }, [lineage]);

  const run = useTraceExportRun(direction, plantId);
  const split = usePaneSplit(`omf-mes:trace-tree:${direction}:split`, 0.34);
  const layout = useSplitOrientation(`omf-mes:trace-tree:${direction}:split-orientation`);
  const { splitRef, aboveRef } = useFitToViewport();

  const reset = () => {
    setList(initialListState);
    setNotice(null);
    resolving.current = null;
    const params = new URLSearchParams();
    if (askedPlant !== null) params.set('plant', String(askedPlant));
    setSearchParams(params);
    void queryClient.invalidateQueries({ queryKey: traceTreeKeys.recent(direction, plantId ?? 0) });
  };

  const search = (condition: ListCondition) => {
    setList(startCondition(condition));
    setNotice(null);
    writeUrl({ condition, lot: null });
  };

  const selected = entries.find((entry) => entry.row.lot.lotId === lotId) ?? null;
  const listStatus =
    list.mode === 'SCAN'
      ? 'ready'
      : list.mode === 'CONDITION'
        ? conditionQuery.isError
          ? 'error'
          : conditionQuery.data === undefined
            ? 'loading'
            : 'ready'
        : recent.isError
          ? 'error'
          : recent.data === undefined
            ? 'loading'
            : 'ready';

  const listCollapse = {
    collapsed: split.collapsed,
    onToggle: split.toggleCollapsed,
    collapseLabel: messages.common.inspectionHub.listCollapse,
    expandLabel: messages.common.inspectionHub.listExpand,
  };

  const partial =
    tree.data !== undefined && (tree.data.limit.exceeded || tree.data.limit.maxDepthReached);
  const context: TraceDetailContext | null =
    tree.data === undefined
      ? null
      : {
          tree: tree.data,
          entry: selected,
          names,
          activeEnd,
          partial,
          onLocate: (rowId, nodeKey) => {
            setActiveEnd(rowId);
            if (lineage === null || view === null) return;
            const located = locate(lineage, view, nodeKey);
            if (located !== null) setView(located.view);
          },
        };

  const detail =
    lotId === null ? (
      <EmptyState
        size="sm"
        icon={<Icon name="arrow_back" size={24} />}
        title={t.detail.pickTitle}
        description={words.pickHint}
      />
    ) : tree.isError ? (
      <DetailFailure error={tree.error} direction={direction} onRetry={() => void tree.refetch()} />
    ) : context === null || lineage === null || view === null ? (
      <div role="status" aria-label={t.detail.loading}>
        <SkeletonText lines={8} />
      </div>
    ) : (
      <div className="trace-tree-detail">
        {partial && (
          <AlertBanner variant="warning" title={t.detail.partialTitle}>
            {t.detail.partialBody(context.tree.limit.lotCap)}
          </AlertBanner>
        )}
        {renderSummary(context)}
        <TraceTreeTable
          lineage={lineage}
          view={view}
          onViewChange={setView}
          onOpenLot={(lotNo) => void scan(lotNo)}
          names={names}
        />
        {renderEnd(context)}
      </div>
    );

  return (
    <>
      <ScreenHeader
        title={words.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: words.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
        actions={
          <>
            <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
            <TraceExportButton
              direction={direction}
              entries={entries}
              total={list.mode === 'CONDITION' ? conditionTotal : null}
              run={run}
            />
          </>
        }
      />
      <section ref={aboveRef} className="pane trace-tree-filter-pane" aria-label={t.list.pane}>
        <TraceFilterBar
          direction={direction}
          plants={plantList}
          plantId={plantId}
          onPlantChange={(next) => {
            setList(initialListState);
            setNotice(null);
            setSearchParams(new URLSearchParams({ plant: String(next) }));
          }}
          scanning={scanning}
          onScan={(q) => void scan(q)}
          condition={list.mode === 'CONDITION' ? list.condition : null}
          defaultPeriod={defaultPeriod(plantToday())}
          partnerSource={partnerSource}
          partnerLabel={partnerLabel}
          onSearch={search}
          canReset={list.mode !== 'RECENT' || lotId !== null}
          onReset={reset}
        />
        {notice !== null && (
          <NoticeBanner
            notice={notice}
            direction={direction}
            onDismiss={() => setNotice(null)}
            onOpenOther={(other) =>
              void navigate(traceLotHref(direction === 'FORWARD' ? 'BACKWARD' : 'FORWARD', other))
            }
          />
        )}
      </section>
      <div
        ref={splitRef}
        className={`po-board-split inspection-split trace-tree-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
        data-left-collapsed={split.collapsed ? 'true' : undefined}
      >
        <section className="pane trace-tree-list-pane" aria-label={t.list.pane}>
          <PaneListHead title="" collapse={listCollapse} />
          <TraceLotList
            direction={direction}
            mode={list.mode}
            entries={entries}
            selectedLotId={lotId}
            onSelect={(entry) => choose(entry)}
            status={listStatus}
            error={
              <TraceListFailure
                onRetry={() =>
                  void (list.mode === 'CONDITION' ? conditionQuery.refetch() : recent.refetch())
                }
              />
            }
            statusName={names.lotStatus}
            {...(list.mode === 'CONDITION' && list.condition !== null
              ? {
                  condition: {
                    partnerLabel,
                    from: list.condition.from,
                    to: list.condition.to,
                    total: conditionTotal,
                    hasMore: conditionQuery.hasNextPage,
                    loadingMore: conditionQuery.isFetchingNextPage,
                    onMore: () => void conditionQuery.fetchNextPage(),
                  },
                }
              : {})}
          />
        </section>
        <PaneSplitter
          label={t.list.pane}
          ratio={split.ratio}
          onChange={split.commit}
          collapse={listCollapse}
        />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={messages.common.inspectionHub.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
            collapse={listCollapse}
          />
        )}
        <section className="pane trace-tree-detail-pane" aria-label={t.detail.pane}>
          {detail}
        </section>
      </div>
    </>
  );
};
