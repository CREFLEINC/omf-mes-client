import { AlertBanner, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { HUB_ACTIONS_ID } from '../../patterns/hub-actions';
import { CountChip } from '../../patterns/count-chip';
import { PageNav } from '../../patterns/page-nav';
import { plantToday } from '../../patterns/plant-time';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { useSession } from '../../patterns/session';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { toWebAccess } from '../../patterns/web-access';
import { exportFileName, toCsv } from './export';
import { FilterBar, type FilterDraft, type FilterSearchMode } from './filter-bar';
import { LoadFailure } from './load-failure';
import { LOT_STATUS_PATH, LotDetail } from './lot-detail';
import {
  DEFAULT_SIZE,
  KINDS,
  readFilters,
  toSearchParams,
  withKind,
  type LotTraceFilters,
} from './filters';
import { MovementTable } from './movement-table';
import { defaultPeriod, validatePeriod } from './period';
import {
  fetchMovementPage,
  partnerRoleOf,
  useItemLabel,
  useKindCounts,
  useMovementList,
  usePartnerLabel,
  useStatusCodes,
  useWarehouseLabel,
} from './queries';
import { formatQtyByUom, type MovementRow } from './rows';
import { TabToolbar } from './tab-toolbar';
import { appendPath, readPath, readTraceSelected, type PathStep } from './trace-filters';
import { useAllPagesExport } from './use-export';

const t = messages.lotTrace;

const POSITIVE = /^[1-9][0-9]*$/;

/** 고른 줄(`line`). 상세에 선 LOT은 `selected`, 지나온 경로는 `via`다(다른 두 탭과 같다). */
const readLine = (params: URLSearchParams): number | null => {
  const raw = params.get('line');
  return raw !== null && POSITIVE.test(raw) ? Number(raw) : null;
};

/**
 * 기간별 이력 탭 — 자재 입고, 제품입고, 제품 출하 줄을 기간으로 본다(T-W-A 목록과 상세). 줄을 고르면 탭을 바꾸지 않고
 * 오른쪽 상세 창에 그 줄의 LOT을 세운다(다른 두 탭과 같은 상세, [보기]와 [이전 LOT]도 같다). 한 줄에 LOT이 여럿이면
 * 상세 머리에서 LOT을 고른다. 투입과 포장 줄은 기간으로 부르는 서버 목록이 들어오면 구분에 더한다(`filters.ts`).
 */
export const MovementsTab = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { client } = useApiClient();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const hasPeriod = searchParams.has('from');

  /* 주소에 기간이 없을 때만 기본 7일(공장 날짜)을 채운다. replace 로 두어 뒤로가기가 빈 주소로 가지 않는다. */
  useEffect(() => {
    if (hasPeriod) return;
    const seeded = { ...readFilters(searchParams), ...defaultPeriod(plantToday()) };
    setSearchParams(toSearchParams(seeded), { replace: true });
  }, [hasPeriod, searchParams, setSearchParams]);

  const periodReason = hasPeriod ? validatePeriod(filters) : null;
  const ready = hasPeriod && periodReason === null;
  const list = useMovementList(filters, ready);
  const counts = useKindCounts(filters, ready);
  const statusCodes = useStatusCodes(filters.kind);
  const exporter = useAllPagesExport();
  const line = readLine(searchParams);
  const selected = readTraceSelected(searchParams);
  const path = useMemo(() => readPath(searchParams), [searchParams]);
  const { session } = useSession();
  const canOpenLotStatus = toWebAccess(session?.permissions).allows(LOT_STATUS_PATH);
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:lot-trace:split', 0.5);
  const layout = useSplitOrientation('omf-mes:lot-trace:split-orientation');

  const role = partnerRoleOf(filters.kind);
  const itemLabel = useItemLabel(filters.item);
  const warehouseLabel = useWarehouseLabel(filters.warehouse);
  const partnerLabel = usePartnerLabel(filters.partner, role);

  /* 조건을 바꿔 바로 반영하는 갈래는 주소를 바꿔 쓴다. 뒤로 가기가 조건 변경으로 넘치지 않게 한다. 조건이 바뀌면 고른 줄은 푼다. */
  const apply = (next: LotTraceFilters, replace = false) =>
    setSearchParams(toSearchParams(next), { replace });
  /** 줄과 LOT을 고른다(목록과 조건은 그대로). */
  const choose = (nextLine: number, lotId: number, nextPath: readonly PathStep[] = []) => {
    const params = toSearchParams(filters);
    params.set('line', String(nextLine));
    params.set('selected', String(lotId));
    setSearchParams(appendPath(params, nextPath));
  };
  /** 같은 조건의 [조회]는 다시 조회한다(받는 중이면 겹쳐 부르지 않는다). */
  const search = (draft: FilterDraft, mode: FilterSearchMode) => {
    const next = { ...filters, ...draft, page: 1 };
    if (toSearchParams(next).toString() === toSearchParams(filters).toString()) {
      if (mode === 'manual' && ready && !list.isFetching) {
        void list.refetch();
        void counts.refetch();
      }
      return;
    }
    apply(next, mode === 'auto');
  };

  /* 고른 칩은 목록과 같은 기준(목록 합계), 다른 칩은 공통 조건으로 센 값이다(C-17). */
  const countOf = (kind: (typeof KINDS)[number]): number | undefined =>
    kind === filters.kind && list.data !== undefined && !list.isPlaceholderData
      ? list.data.totals.lineCount
      : counts.data?.[kind];

  const rows = list.data?.rows ?? [];
  const chosenRow = rows.find((row) => row.id === line);
  const total = list.data?.totals.lineCount ?? 0;

  const narrowed = [
    `${t.filters.period} ${filters.from} ~ ${filters.to}`.trim(),
    ...(filters.item === '' ? [] : [`${t.filters.item} ${itemLabel}`]),
    ...(filters.warehouse === '' ? [] : [`${t.filters.warehouse} ${warehouseLabel}`]),
    ...(filters.partner === '' || role === null
      ? []
      : [`${role === 'SUPPLIER' ? t.filters.supplier : t.filters.customer} ${partnerLabel}`]),
    ...(filters.status === '' ? [] : [`${t.filters.status} ${statusCodes.nameOf(filters.status)}`]),
  ].join(', ');

  const chips = (
    <span className="lot-trace-kinds" role="group" aria-label={t.kinds.label}>
      {KINDS.map((kind) => {
        const count = countOf(kind);
        return (
          <CountChip
            key={kind}
            tone="idle"
            label={count === undefined ? t.kinds[kind] : t.kinds.count(t.kinds[kind], count)}
            selected={filters.kind === kind}
            onSelect={() => apply(withKind(filters, kind), true)}
          />
        );
      })}
    </span>
  );

  const listBody =
    periodReason !== null ? (
      <AlertBanner variant="warning">{periodReason}</AlertBanner>
    ) : list.isError ? (
      <LoadFailure
        error={list.error}
        title={t.list.loadFailed}
        description={t.list.loadFailedDescription}
        onRetry={() => void list.refetch()}
      />
    ) : list.data === undefined ? (
      <div role="status" aria-label={t.list.loading}>
        <SkeletonText lines={5} />
      </div>
    ) : (
      <>
        {total > 0 && (
          <p className="lot-trace-totals">
            <span>{t.list.totalLines(total)}</span>
            <span>
              <span className="lot-trace-totals-label">{t.list.totalQty}</span>{' '}
              {formatQtyByUom(list.data.totals.qtyByUom)}
            </span>
          </p>
        )}
        <MovementTable
          kind={filters.kind}
          rows={rows}
          activeId={line}
          onOpen={(row) => {
            const first = row.lots[0];
            if (first !== undefined) choose(row.id, first.lotId);
          }}
          empty={
            <EmptyState
              size="sm"
              title={t.list.emptyTitle(t.kinds[filters.kind])}
              description={
                <>
                  {t.list.emptyDescription}
                  <br />
                  {t.list.narrowedBy(narrowed)}
                </>
              }
            />
          }
        />
        <PageNav
          meta={list.data.page}
          onChangePage={(page) => apply({ ...filters, page })}
          onChangeSize={(size) => apply({ ...filters, size, page: 1 }, true)}
        />
      </>
    );

  return (
    <>
      <TabToolbar
        chips={chips}
        actions={
          <>
            <div id={HUB_ACTIONS_ID} className="hub-actions" />
            <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
          </>
        }
        exportState={exporter.state}
        total={total}
        onExport={() =>
          void exporter.start<MovementRow>({
            total,
            fetchPage: (page, size, signal) =>
              fetchMovementPage(client, filters, page, size, signal),
            build: (all) => ({
              fileName: exportFileName(filters),
              content: toCsv(filters.kind, all, statusCodes.nameOf),
            }),
          })
        }
        onCancelExport={exporter.cancel}
        onDismissExport={exporter.dismiss}
      />
      <section ref={aboveRef} className="pane lot-trace-filter-pane" aria-label={t.filters.pane}>
        <FilterBar
          applied={filters}
          onSearch={search}
          onReset={() =>
            apply({
              ...filters,
              ...defaultPeriod(plantToday()),
              item: '',
              warehouse: '',
              partner: '',
              status: '',
              page: 1,
              size: DEFAULT_SIZE,
            })
          }
        />
      </section>
      <div
        ref={splitRef}
        className={`po-board-split inspection-split lot-trace-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <section className="pane lot-trace-list-pane" aria-label={t.list.pane}>
          {listBody}
        </section>
        <PaneSplitter label={t.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={messages.common.inspectionHub.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}
        <section className="pane lot-trace-detail-pane" aria-label={t.chain.pane}>
          {selected === null || line === null ? (
            <EmptyState size="sm" title={t.chain.pickTitle} description={t.list.pick} />
          ) : (
            <>
              {chosenRow !== undefined && chosenRow.lotCount > 1 && (
                <div className="lot-trace-lot-picker" role="group" aria-label={t.list.lotPicker}>
                  <span className="field-label">{t.list.lotPicker}</span>
                  {chosenRow.lots.map((lot) => (
                    <CountChip
                      key={lot.lotId}
                      tone="idle"
                      label={lot.lotNo}
                      selected={lot.lotId === (path[0]?.lotId ?? selected)}
                      onSelect={() => choose(chosenRow.id, lot.lotId)}
                    />
                  ))}
                  {chosenRow.lotCount > chosenRow.lots.length && (
                    <span className="field-note">
                      {t.list.lotPickerMore(chosenRow.lotCount - chosenRow.lots.length)}
                    </span>
                  )}
                </div>
              )}
              <LotDetail
                key={selected}
                lotId={selected}
                path={path}
                canOpenLotStatus={canOpenLotStatus}
                typeHint={
                  path.length > 0 || chosenRow === undefined
                    ? null
                    : chosenRow.kind === 'MATERIAL'
                      ? 'MATERIAL'
                      : 'PRODUCTION'
                }
                onCenter={(lot, nextPath) => choose(line, lot.lotId, nextPath)}
              />
            </>
          )}
        </section>
      </div>
    </>
  );
};
