import { AlertBanner, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { CountChip } from '../../patterns/count-chip';
import { HUB_ACTIONS_ID } from '../../patterns/hub-actions';
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
import {
  DEFAULT_SIZE,
  EMPTY_FILTERS,
  KIND_FILTERS,
  hasNumberCondition,
  periodReasonOf,
  readFilters,
  toSearchParams,
  withKind,
  type KindFilter,
  type LotTraceFilters,
} from './filters';
import { LoadFailure } from './load-failure';
import { LOT_STATUS_PATH, LotDetail } from './lot-detail';
import { MovementTable } from './movement-table';
import { defaultPeriod } from './period';
import {
  ALL_CAP,
  fetchMovementPage,
  useCodeNames,
  useItemLabel,
  useKindCounts,
  useMovementList,
  usePartnerLabel,
} from './queries';
import { formatQtyByUom, rowKeyOf, type MovementRow } from './rows';
import { TabToolbar } from './tab-toolbar';
import { appendPath, readPath, readTraceSelected, type PathStep } from './trace-filters';
import { useAllPagesExport } from './use-export';

const t = messages.lotTrace;

const LINE = /^[A-Z]+-[1-9][0-9]*$/;

/** 고른 줄(`line`, 「구분-번호」). 상세에 선 LOT은 `selected`, 지나온 경로는 `via`다. */
const readLine = (params: URLSearchParams): string | null => {
  const raw = params.get('line');
  return raw !== null && LINE.test(raw) ? raw : null;
};

/**
 * LOT 생산 이력 조회 본문 — 이력 줄 하나의 목록(T-W-A 목록과 상세). 자재 입고, 투입, 제품입고, 포장, 제품 출하 줄을
 * 기간으로 보고, 구분 칩으로 거른다. 줄을 고르면 오른쪽 상세 창에 그 줄의 LOT을 세운다(투입 자재, 사용처, 제품입고, 포장,
 * 출하, 단계 줄, [보기], [이전 LOT]). 한 줄에 LOT이 여럿이면 상세 머리에서 LOT을 고른다.
 * LOT 번호로 찾아 줄이 모두 한 LOT이면 그 LOT의 상세를 바로 연다. 번호 조건이 있으면 기간은 선택이다.
 */
export const LotHistory = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { client } = useApiClient();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const line = readLine(searchParams);
  const selected = readTraceSelected(searchParams);
  const path = useMemo(() => readPath(searchParams), [searchParams]);
  /* 주소에 기간도 번호 조건도 없으면 기본 7일(공장 날짜)을 채운다. 고른 LOT과 경로는 둔다. replace 로 두어 뒤로 가기가 빈 주소로 가지 않는다. */
  const seed = filters.from === '' && filters.to === '' && !hasNumberCondition(filters);
  useEffect(() => {
    if (!seed) return;
    const next = toSearchParams({ ...filters, ...defaultPeriod(plantToday()) });
    for (const key of ['line', 'selected']) {
      const value = searchParams.get(key);
      if (value !== null) next.set(key, value);
    }
    for (const step of searchParams.getAll('via')) next.append('via', step);
    setSearchParams(next, { replace: true });
  }, [filters, seed, searchParams, setSearchParams]);

  /* 번호 조건(LOT 번호, 입하번호, W/O 번호, 출하번호)이 있으면 기간 없이도 부른다(서버 규칙). */
  const periodReason = periodReasonOf(filters);
  const ready = periodReason === null;
  const list = useMovementList(filters, ready);
  const counts = useKindCounts(filters, ready);
  const receiptStatus = useCodeNames('LOGISTICS_DOCUMENT_STATUS');
  const shipmentStatus = useCodeNames('SHIPMENT_STATUS');
  const statusName = (row: MovementRow) =>
    row.kind === 'SHIPMENT'
      ? shipmentStatus.nameOf(row.statusCode)
      : receiptStatus.nameOf(row.statusCode);
  const exporter = useAllPagesExport();
  const { session } = useSession();
  const canOpenLotStatus = toWebAccess(session?.permissions).allows(LOT_STATUS_PATH);
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:lot-trace:split', 0.56);
  const layout = useSplitOrientation('omf-mes:lot-trace:split-orientation');
  const itemLabel = useItemLabel(filters.item);
  const supplierLabel = usePartnerLabel(filters.supplier, 'SUPPLIER');
  const customerLabel = usePartnerLabel(filters.customer, 'CUSTOMER');

  /* 조건을 바꿔 바로 반영하는 갈래는 주소를 바꿔 쓴다. 조건이 바뀌면 고른 줄은 푼다. */
  const apply = (next: LotTraceFilters, replace = false) =>
    setSearchParams(toSearchParams(next), { replace });
  /** 줄(없으면 LOT만)과 LOT을 고른다. 목록과 조건은 그대로다. */
  const choose = (
    nextLine: string | null,
    lotId: number,
    nextPath: readonly PathStep[] = [],
    replace = false,
  ) => {
    const params = toSearchParams(filters);
    if (nextLine !== null) params.set('line', nextLine);
    params.set('selected', String(lotId));
    setSearchParams(appendPath(params, nextPath), { replace });
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

  const rows = list.data?.rows ?? [];
  const chosenRow = rows.find((row) => rowKeyOf(row) === line);
  const total = list.data?.page.total ?? 0;

  /*
   * LOT 번호로 찾아 목록의 줄이 모두 한 LOT이면 그 LOT의 상세를 바로 연다(고른 LOT이 없을 때만). 첫 줄을 짚는다.
   */
  const lotSearch = filters.materialLot !== '' || filters.productLot !== '';
  const onlyLot =
    lotSearch && selected === null && !list.isPlaceholderData && rows.length > 0
      ? new Set(rows.flatMap((row) => row.lots.map((lot) => lot.lotId)))
      : null;
  const autoRow = onlyLot !== null && onlyLot.size === 1 ? rows[0] : undefined;
  const autoKey = autoRow === undefined ? '' : rowKeyOf(autoRow);
  useEffect(() => {
    const first = autoRow?.lots[0];
    if (autoRow === undefined || first === undefined) return;
    choose(rowKeyOf(autoRow), first.lotId, [], true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 그 줄이 바뀔 때만 고른다
  }, [autoKey]);

  /* 고른 칩은 목록과 같은 기준(목록 합계), 다른 칩은 같은 조건으로 센 값이다(C-17). */
  const countOf = (kind: KindFilter): number | undefined =>
    kind === filters.kind && list.data !== undefined && !list.isPlaceholderData
      ? list.data.page.total
      : counts.data?.[kind];

  const narrowed = [
    `${t.filters.period} ${filters.from} ~ ${filters.to}`.trim(),
    ...(filters.item === '' ? [] : [`${t.filters.item} ${itemLabel}`]),
    ...(filters.materialLot === '' ? [] : [`${t.filters.materialLot} ${filters.materialLot}`]),
    ...(filters.productLot === '' ? [] : [`${t.filters.productLot} ${filters.productLot}`]),
    ...(filters.inbound === '' ? [] : [`${t.filters.inboundNo} ${filters.inbound}`]),
    ...(filters.workOrder === '' ? [] : [`${t.filters.workOrderNo} ${filters.workOrder}`]),
    ...(filters.shipment === '' ? [] : [`${t.filters.shipmentNo} ${filters.shipment}`]),
    ...(filters.supplier === '' ? [] : [`${t.filters.supplier} ${supplierLabel}`]),
    ...(filters.customer === '' ? [] : [`${t.filters.customer} ${customerLabel}`]),
  ].join(', ');

  const chips = (
    <span className="lot-trace-kinds" role="group" aria-label={t.kinds.label}>
      {KIND_FILTERS.map((kind) => {
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
        {list.data.capped && <AlertBanner variant="info">{t.list.capped(ALL_CAP)}</AlertBanner>}
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
          showKind={filters.kind === 'ALL'}
          rows={rows}
          activeKey={line}
          onOpen={(row) => {
            const first = row.lots[0];
            if (first !== undefined) choose(rowKeyOf(row), first.lotId);
          }}
          empty={
            <EmptyState
              size="sm"
              title={
                filters.from === '' && filters.to === ''
                  ? t.list.emptyTitleNoPeriod
                  : t.list.emptyTitle(filters.from, filters.to)
              }
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

  const lotOfRow = (row: MovementRow, lotId: number) => row.lots.some((lot) => lot.lotId === lotId);

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
              content: toCsv(all, statusName),
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
            apply({ ...EMPTY_FILTERS, ...defaultPeriod(plantToday()), size: DEFAULT_SIZE })
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
          {selected === null ? (
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
                      onSelect={() => choose(rowKeyOf(chosenRow), lot.lotId)}
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
                  path.length > 0
                    ? null
                    : chosenRow !== undefined && lotOfRow(chosenRow, selected)
                      ? chosenRow.kind === 'MATERIAL' || chosenRow.kind === 'CONSUMED'
                        ? 'MATERIAL'
                        : 'PRODUCTION'
                      : null
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
