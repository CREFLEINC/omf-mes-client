import { AlertBanner, Button, EmptyState, SkeletonText } from '@crefle/web-ui';
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
import { ChainDrawer, LOT_STATUS_PATH } from './chain-drawer';
import { toCsvText, type CsvColumn } from './export';
import { defaultPeriod } from './period';
import { useItemLabel } from './queries';
import { formatQty } from './rows';
import { TabToolbar } from './tab-toolbar';
import { TraceFilterBar, type TraceFieldErrors } from './trace-filter-bar';
import {
  EMPTY_TRACE_FILTERS,
  TRACE_DEFAULT_DAYS,
  hasEntry,
  openLotParams,
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

/**
 * 서버 400의 칸 오류를 이 화면의 두 자리(진입점, 기간)로 옮긴다. 서버 문구에는 내부 칸 이름이 들어 있어
 * 화면 문구로 바꿔 보인다(C-13).
 */
export const toFieldErrors = (error: unknown): TraceFieldErrors => {
  const apiError = toApiError(error);
  if (apiError.kind !== 'validation') return {};
  const result: TraceFieldErrors = {};
  for (const item of apiError.errors) {
    const field = item.field ?? '';
    if (ENTRY_FIELDS.has(field)) result.entry = t.trace.entryRequired;
    if (PERIOD_FIELDS.has(field)) {
      result.period =
        item.code === 'REQUIRED'
          ? t.period.required
          : item.code === 'RANGE' && /366/.test(item.message ?? '')
            ? t.period.tooLong
            : t.period.reversed;
    }
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
 * 정방향 추적, 역방향 추적 탭(T-W-A 조회형). 목록은 진입점(품목, LOT 번호, 입하번호, 출하번호, W/O 번호)이
 * 있어야 부른다. 행을 누르면 그 LOT의 사슬 드로어(계획 2-4). 조건 칩은 현재 단계와 단계별 LOT 수(C-17).
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

  const apply = (next: TraceFilters, nextSelected: number | null = null) =>
    setSearchParams(toTraceSearchParams(direction, next, nextSelected));

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
          onSelect={() => apply({ ...filters, stage: '', page: 1 })}
        />
        {stagesOf(direction).map((stage) => (
          <CountChip
            key={stage}
            tone="idle"
            label={t.kinds.count(t.stages[stage], stageCounts[stage] ?? 0)}
            selected={filters.stage === stage}
            onSelect={() => apply({ ...filters, stage, page: 1 })}
          />
        ))}
      </span>
    ) : undefined;

  const startExport = () => {
    const today = plantToday();
    if (direction === 'forward') {
      void exporter.start<ForwardListRow>({
        total,
        fetchPage: async (page, size, signal) => {
          const result = await fetchForwardPage(client, filters, page, size, signal);
          return { rows: result.items, page: result.page };
        },
        build: (rows) => ({
          fileName: t.trace.fileName(t.tabs.forward, today),
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
        fileName: t.trace.fileName(t.tabs.backward, today),
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

  const empty = (
    <EmptyState
      size="sm"
      title={t.trace.emptyTitle}
      description={
        <>
          {t.trace.emptyDescription}
          <br />
          {t.list.narrowedBy(narrowed)}
        </>
      }
    />
  );

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
      <AlertBanner
        variant="error"
        title={t.trace.loadFailed}
        action={
          <Button size="sm" variant="outlined" onClick={() => void list.refetch()}>
            {t.list.retry}
          </Button>
        }
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
            activeId={selected}
            onOpen={(row) => apply(filters, row.lotId)}
            empty={empty}
          />
        ) : (
          <BackwardTable
            rows={data.items as BackwardListRow[]}
            activeId={selected}
            onOpen={(row) => apply(filters, row.lotId)}
            empty={empty}
          />
        )}
        <PageNav
          meta={data.page}
          onChangePage={(page) => apply({ ...filters, page })}
          onChangeSize={(size) => apply({ ...filters, size, page: 1 })}
        />
      </>
    );
  }

  return (
    <>
      <TabToolbar
        lead={direction === 'forward' ? t.tabs.forwardLead : t.tabs.backwardLead}
        chips={chips}
        exportState={exporter.state}
        total={total}
        onExport={startExport}
        onCancelExport={exporter.cancel}
        onDismissExport={exporter.dismiss}
      />
      <section className="pane lot-trace-filter-pane" aria-label={t.filters.pane}>
        <TraceFilterBar
          direction={direction}
          applied={filters}
          serverErrors={serverErrors}
          onSearch={(draft) => apply({ ...filters, ...draft, stage: '', page: 1 })}
          onReset={() =>
            apply({
              ...EMPTY_TRACE_FILTERS,
              ...defaultPeriod(plantToday(), TRACE_DEFAULT_DAYS),
            })
          }
        />
      </section>
      {body !== null && (
        <section
          className="pane lot-trace-list-pane"
          aria-label={direction === 'forward' ? t.tabs.forward : t.tabs.backward}
        >
          {body}
        </section>
      )}
      {selected !== null && (
        <ChainDrawer
          direction={direction}
          lotId={selected}
          path={path}
          canOpenLotStatus={canOpenLotStatus}
          onClose={() => apply(filters)}
          onOpenLot={(nextDirection, lot, nextPath) =>
            setSearchParams(openLotParams(nextDirection, lot, nextPath))
          }
        />
      )}
    </>
  );
};
