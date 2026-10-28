import { AlertBanner, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { CountChip } from '../../patterns/count-chip';
import { PageNav } from '../../patterns/page-nav';
import { plantToday } from '../../patterns/plant-time';
import { toApiError } from '../../patterns/request';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import { toCsvText, type CsvColumn } from '../../patterns/csv';
import { LoadFailure, toLoadCause } from './load-failure';
import { LOT_STATUS_PATH, LotDetail, LotDetailEmpty } from './lot-detail';
import { defaultPeriod } from './period';
import { useItemLabel } from './queries';
import { formatQty } from './rows';
import { TabToolbar } from './tab-toolbar';
import {
  TraceFilterBar,
  type SearchMode,
  type TraceDraft,
  type TraceFieldErrors,
} from './trace-filter-bar';
import {
  EMPTY_TRACE_FILTERS,
  TRACE_DEFAULT_DAYS,
  hasEntry,
  readPath,
  readTraceFilters,
  readTraceSelected,
  stagesOf,
  toTraceSearchParams,
  tracePeriodReason,
  type TraceDirection,
  type TraceFilters,
} from './trace-filters';
import { fetchBackwardPage, fetchForwardPage, useTraceList } from './trace-queries';
import { BackwardTable, ForwardTable, plantDate } from './trace-table';
import type { BackwardListRow, ForwardListRow } from './trace-types';
import { useAllPagesExport } from './use-export';

const t = messages.lotTrace;

const ENTRY_FIELDS = new Set([
  'itemId',
  'lotNo',
  'q',
  'inboundReceiptNo',
  'shipmentNo',
  'workOrderNo',
]);
const PERIOD_FIELDS = new Set(['receiptDateFrom', 'receiptDateTo', 'dateFrom', 'dateTo']);

/** 서버 기간 오류 코드 → 기간 칸 문구. 시작 없음, 366일 초과, 종료가 시작보다 앞섬. 그 밖은 형식 오류다. */
const PERIOD_MESSAGES: Record<string, string> = {
  REQUIRED: t.period.required,
  RANGE: t.period.tooLong,
  INVALID: t.period.reversed,
};

/**
 * 서버 400의 칸 오류를 이 화면의 두 자리(진입점, 기간)로 옮긴다. 서버 문구에는 내부 칸 이름이 들어 있어
 * 화면 문구로 바꿔 보인다(C-13).
 */
export const toFieldErrors = (error: unknown): TraceFieldErrors => {
  if (toLoadCause(error) === 'forbidden') return {};
  const apiError = toApiError(error);
  if (apiError.kind !== 'validation') return {};
  const result: TraceFieldErrors = {};
  for (const item of apiError.errors) {
    const field = item.field ?? '';
    if (ENTRY_FIELDS.has(field)) result.entry = t.trace.entryRequired;
    if (PERIOD_FIELDS.has(field)) result.period = PERIOD_MESSAGES[item.code] ?? t.period.invalid;
  }
  return result;
};

const forwardCsv = (stageName: (code: string) => string): CsvColumn<ForwardListRow>[] => {
  const x = t.trace.exportColumns;
  return [
    { header: t.trace.columns.lotNo, value: (row) => row.lotNo },
    { header: x.itemCode, value: (row) => row.item.code },
    { header: x.itemName, value: (row) => row.item.name },
    { header: x.supplierCode, value: (row) => row.inbound?.supplier.code ?? '' },
    { header: x.supplierName, value: (row) => row.inbound?.supplier.name ?? '' },
    { header: x.inboundNo, value: (row) => row.inbound?.inboundReceiptNo ?? '' },
    { header: x.receivedAt, value: (row) => plantDate(row.firstReceivedAt) },
    { header: x.receivedQty, value: (row) => String(row.receivedQty) },
    { header: x.consumedQty, value: (row) => String(row.consumedQty) },
    { header: x.uom, value: (row) => row.uomCode },
    { header: x.stage, value: (row) => stageName(row.currentStageCode) },
    { header: x.shipmentCount, value: (row) => String(row.stages.shipped.shipmentCount) },
    { header: x.lastShippedAt, value: (row) => plantDate(row.stages.shipped.lastShippedAt) },
  ];
};

const backwardCsv = (stageName: (code: string) => string): CsvColumn<BackwardListRow>[] => {
  const x = t.trace.exportColumns;
  return [
    { header: t.trace.columns.lotNo, value: (row) => row.lotNo },
    { header: x.itemCode, value: (row) => row.item.code },
    { header: x.itemName, value: (row) => row.item.name },
    { header: x.workOrderNo, value: (row) => row.workOrder.workOrderNo },
    { header: x.firstProducedAt, value: (row) => plantDate(row.firstProducedAt) },
    { header: x.lastProducedAt, value: (row) => plantDate(row.lastProducedAt) },
    { header: x.goodQty, value: (row) => String(row.producedQty) },
    { header: x.uom, value: (row) => row.uomCode },
    { header: x.inputLotCount, value: (row) => String(row.inputMaterialLotCount) },
    { header: x.stage, value: (row) => stageName(row.currentStageCode) },
    { header: x.shipmentCount, value: (row) => String(row.stages.shipped.shipmentCount) },
    {
      header: x.customers,
      value: (row) =>
        row.stages.shipped.customers.map((cus) => named(cus.name, cus.code)).join(', '),
    },
    { header: x.customerCount, value: (row) => String(row.stages.shipped.customerCount) },
    { header: x.lastShippedAt, value: (row) => plantDate(row.stages.shipped.lastShippedAt) },
  ];
};

const stageName = (code: string): string => (t.stages as Record<string, string>)[code] ?? code;

/**
 * 자재 LOT, 제품 LOT 탭(T-W-A 조회형). 목록은 진입점(품목, LOT 번호, 입하번호, 출하번호, W/O 번호)이
 * 있어야 부른다. 목록과 상세를 한 화면에 나란히 둔다(검사 조회·판정과 같다). 행을 누르면 오른쪽 상세에 그 LOT의
 * 추적이 선다. 창이 1440px보다 좁으면 목록 아래에 상세가 선다. 조건 칩은 현재 단계와 단계별 LOT 수(C-17).
 */
export const TraceTab = ({ direction }: { direction: TraceDirection }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { client } = useApiClient();
  const filters = useMemo(
    () => readTraceFilters(direction, searchParams),
    [direction, searchParams],
  );
  const selected = readTraceSelected(searchParams);
  const path = useMemo(() => readPath(searchParams), [searchParams]);
  const { session } = useSession();
  const canOpenLotStatus = toWebAccess(session?.permissions).allows(LOT_STATUS_PATH);
  const exporter = useAllPagesExport();
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:lot-trace:split', 0.5);
  const itemLabel = useItemLabel(filters.item);

  /* 처음 열면(조건이 하나도 없으면) 기본 기간 30일을 채운다. 다른 탭에서 LOT으로 넘어오면 기간을 두지 않는다. */
  const fresh =
    !hasEntry(filters) && !searchParams.has('from') && !searchParams.has('to') && selected === null;
  useEffect(() => {
    if (!fresh) return;
    setSearchParams(
      toTraceSearchParams(direction, {
        ...EMPTY_TRACE_FILTERS,
        ...defaultPeriod(plantToday(), TRACE_DEFAULT_DAYS),
      }),
      { replace: true },
    );
  }, [direction, fresh, setSearchParams]);

  const entry = hasEntry(filters);
  const periodReason = entry ? tracePeriodReason(filters) : null;
  const ready = entry && periodReason === null;
  const list = useTraceList(direction, filters, ready);
  const serverErrors = list.isError ? toFieldErrors(list.error) : {};
  const fieldError = serverErrors.entry !== undefined || serverErrors.period !== undefined;

  /* 조건을 바꿔 바로 반영하는 갈래(칩, 쪽 크기, 조건 칸)는 주소를 바꿔 쓴다. 뒤로 가기가 조건 변경으로 넘치지 않게 한다. */
  const apply = (next: TraceFilters, nextSelected: number | null = null, replace = false) =>
    setSearchParams(toTraceSearchParams(direction, next, nextSelected), { replace });

  /** 조건 칸의 반영. 같은 조건의 [조회]는 다시 조회한다(받는 중이면 겹쳐 부르지 않는다). */
  const search = (draft: TraceDraft, mode: SearchMode) => {
    const next = { ...filters, ...draft, stage: '', page: 1 };
    const same =
      toTraceSearchParams(direction, next).toString() ===
      toTraceSearchParams(direction, filters).toString();
    if (same) {
      if (mode === 'manual' && ready && !list.isFetching) void list.refetch();
      return;
    }
    apply(next, null, mode === 'auto');
  };

  const data = list.data;
  const total = ready && data !== undefined ? data.page.total : 0;
  const stageCounts = data?.stageCounts as Record<string, number> | undefined;

  const chips =
    ready && stageCounts !== undefined ? (
      <span className="lot-trace-kinds" role="group" aria-label={t.stages.label}>
        <CountChip
          tone="idle"
          label={t.kinds.count(
            t.stages.all,
            Object.values(stageCounts).reduce((sum, value) => sum + value, 0),
          )}
          selected={filters.stage === ''}
          onSelect={() => apply({ ...filters, stage: '', page: 1 }, null, true)}
        />
        {stagesOf(direction).map((stage) => (
          <CountChip
            key={stage}
            tone="idle"
            label={t.kinds.count(t.stages[stage], stageCounts[stage] ?? 0)}
            selected={filters.stage === stage}
            onSelect={() => apply({ ...filters, stage, page: 1 }, null, true)}
          />
        ))}
      </span>
    ) : undefined;

  const startExport = () => {
    if (direction === 'forward') {
      void exporter.start<ForwardListRow>({
        total,
        fetchPage: async (page, size, signal) => {
          const result = await fetchForwardPage(client, filters, page, size, signal);
          return { rows: result.items, page: result.page };
        },
        build: (rows) => ({
          fileName: t.export.fileName(t.tabs.forward, filters.from, filters.to),
          content: toCsvText(forwardCsv(stageName), rows),
        }),
      });
      return;
    }
    void exporter.start<BackwardListRow>({
      total,
      fetchPage: async (page, size, signal) => {
        const result = await fetchBackwardPage(client, filters, page, size, signal);
        return { rows: result.items, page: result.page };
      },
      build: (rows) => ({
        fileName: t.export.fileName(t.tabs.backward, filters.from, filters.to),
        content: toCsvText(backwardCsv(stageName), rows),
      }),
    });
  };

  const narrowed = [
    ...(filters.lot === '' ? [] : [`${t.trace.lotNo} ${filters.lot}`]),
    ...(filters.q === '' ? [] : [`${t.trace.lotNo} ${filters.q}`]),
    ...(filters.item === '' ? [] : [`${t.filters.item} ${itemLabel}`]),
    ...(filters.inbound === '' ? [] : [`${t.trace.inboundNo} ${filters.inbound}`]),
    ...(filters.shipment === '' ? [] : [`${t.trace.shipmentNo} ${filters.shipment}`]),
    ...(filters.workOrder === '' ? [] : [`${t.trace.workOrderNo} ${filters.workOrder}`]),
    ...(filters.from === '' && filters.to === ''
      ? []
      : [`${t.trace.period} ${filters.from} ~ ${filters.to}`.trim()]),
    ...(filters.stage === '' ? [] : [`${t.stages.label} ${stageName(filters.stage)}`]),
  ].join(', ');

  /*
   * 정방향 목록은 자재 입고가 있는 LOT만 싣는다. 생산 LOT을 [이 LOT 기준으로] 정방향으로 열면 목록이 비고
   * 사슬만 열린다. 빈 까닭을 그대로 말한다.
   */
  const notMaterial = direction === 'forward' && filters.lot !== '' && selected !== null;
  const noPeriod = filters.from === '' && filters.to === '';
  const empty = notMaterial ? (
    <EmptyState
      size="sm"
      title={t.trace.notMaterialTitle}
      description={t.trace.notMaterialDescription}
    />
  ) : (
    <EmptyState
      size="sm"
      title={t.trace.emptyTitle}
      description={
        <>
          {noPeriod && filters.lot !== ''
            ? t.trace.emptyExactDescription
            : `${t.trace.emptyDescription}${filters.q === '' ? '' : ` ${t.trace.emptyPartialHint}`}`}
          <br />
          {t.list.narrowedBy(narrowed)}
        </>
      }
    />
  );

  /* 상세에서 [보기]로 다른 LOT을 가운데 두어도 목록은 처음 고른 행을 짚는다. */
  const listActive = path[0]?.lotId ?? selected;

  let body: ReactNode;
  if (!entry) {
    body = (
      <EmptyState
        size="sm"
        title={direction === 'forward' ? t.trace.startForward : t.trace.startBackward}
      />
    );
  } else if (periodReason !== null) {
    body = <AlertBanner variant="warning">{periodReason}</AlertBanner>;
  } else if (list.isError && !fieldError) {
    body = (
      <LoadFailure
        error={list.error}
        title={t.trace.loadFailed}
        onRetry={() => void list.refetch()}
      />
    );
  } else if (fieldError) {
    body = null;
  } else if (data === undefined) {
    body = (
      <div role="status" aria-label={t.chain.loading}>
        <SkeletonText lines={5} />
      </div>
    );
  } else {
    body = (
      <>
        {direction === 'forward' ? (
          <ForwardTable
            rows={data.items as ForwardListRow[]}
            activeId={listActive}
            onOpen={(row) => apply(filters, row.lotId)}
            empty={empty}
          />
        ) : (
          <BackwardTable
            rows={data.items as BackwardListRow[]}
            activeId={listActive}
            onOpen={(row) => apply(filters, row.lotId)}
            empty={empty}
          />
        )}
        <PageNav
          meta={data.page}
          onChangePage={(page) => apply({ ...filters, page })}
          onChangeSize={(size) => apply({ ...filters, size, page: 1 }, null, true)}
        />
      </>
    );
  }

  return (
    <>
      <TabToolbar
        chips={chips}
        exportState={exporter.state}
        total={total}
        onExport={startExport}
        onCancelExport={exporter.cancel}
        onDismissExport={exporter.dismiss}
      />
      <section ref={aboveRef} className="pane lot-trace-filter-pane" aria-label={t.filters.pane}>
        <TraceFilterBar
          direction={direction}
          applied={filters}
          serverErrors={serverErrors}
          onSearch={search}
          onReset={() =>
            apply({
              ...EMPTY_TRACE_FILTERS,
              ...defaultPeriod(plantToday(), TRACE_DEFAULT_DAYS),
            })
          }
        />
      </section>
      <div ref={splitRef} className="po-board-split lot-trace-split" style={split.style}>
        <section
          className="pane lot-trace-list-pane"
          aria-label={direction === 'forward' ? t.tabs.forward : t.tabs.backward}
        >
          {body}
        </section>
        <PaneSplitter label={t.splitter} ratio={split.ratio} onChange={split.commit} />
        <section className="pane lot-trace-detail-pane" aria-label={t.chain.pane}>
          {selected === null ? (
            <LotDetailEmpty material={direction === 'forward'} />
          ) : (
            <LotDetail
              key={selected}
              lotId={selected}
              path={path}
              canOpenLotStatus={canOpenLotStatus}
              onCenter={(lot, nextPath) =>
                setSearchParams(toTraceSearchParams(direction, filters, lot.lotId, nextPath))
              }
            />
          )}
        </section>
      </div>
    </>
  );
};
