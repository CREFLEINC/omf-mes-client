import { AlertBanner, EmptyState, SkeletonText } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { CountChip } from '../../patterns/count-chip';
import { PageNav } from '../../patterns/page-nav';
import { plantToday } from '../../patterns/plant-time';
import { exportFileName, toCsv } from './export';
import { FilterBar } from './filter-bar';
import { LoadFailure } from './load-failure';
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
import { openLotParams, openShipmentParams } from './trace-filters';
import { useAllPagesExport } from './use-export';

const t = messages.lotTrace;

/**
 * 행을 누르면 그 LOT의 추적으로 간다. 자재 입고는 정방향, 생산 입고는 역방향,
 * 제품 출고는 그 출하번호로 역방향(LOT이 하나면 그 LOT의 사슬을 연다).
 */
export const traceParamsOf = (row: MovementRow): URLSearchParams => {
  const first = row.lots[0];
  if (row.kind === 'SHIPMENT') {
    return openShipmentParams(
      row.documentNo,
      row.lotCount === 1 && first !== undefined ? first.lotId : null,
    );
  }
  if (first === undefined) return new URLSearchParams();
  return openLotParams(row.kind === 'MATERIAL' ? 'forward' : 'backward', {
    lotId: first.lotId,
    lotNo: first.lotNo,
  });
};

/** 입출고 현황 탭 — 자재 입고, 생산 입고, 제품 출고 줄을 기간으로 본다(T-W-A 목록). */
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

  const role = partnerRoleOf(filters.kind);
  const itemLabel = useItemLabel(filters.item);
  const warehouseLabel = useWarehouseLabel(filters.warehouse);
  const partnerLabel = usePartnerLabel(filters.partner, role);

  const apply = (next: LotTraceFilters) => setSearchParams(toSearchParams(next));

  /* 고른 칩은 목록과 같은 기준(목록 합계), 다른 칩은 공통 조건으로 센 값이다(C-17). */
  const countOf = (kind: (typeof KINDS)[number]): number | undefined =>
    kind === filters.kind && list.data !== undefined && !list.isPlaceholderData
      ? list.data.totals.lineCount
      : counts.data?.[kind];

  const rows = list.data?.rows ?? [];
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
            onSelect={() => apply(withKind(filters, kind))}
          />
        );
      })}
    </span>
  );

  return (
    <>
      <TabToolbar
        lead={t.tabs.movementsLead}
        chips={chips}
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
      <section className="pane lot-trace-filter-pane" aria-label={t.filters.pane}>
        <FilterBar
          applied={filters}
          onSearch={(draft) => apply({ ...filters, ...draft, page: 1 })}
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
      <section className="pane lot-trace-list-pane" aria-label={t.list.pane}>
        {periodReason !== null ? (
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
              onOpen={(row) => setSearchParams(traceParamsOf(row))}
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
              onChangeSize={(size) => apply({ ...filters, size, page: 1 })}
            />
          </>
        )}
      </section>
    </>
  );
};
