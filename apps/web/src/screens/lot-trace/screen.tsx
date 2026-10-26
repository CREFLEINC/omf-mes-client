/**
 * W-02-09 LOT 추적 — 1단계: 입출고 현황(omf-all-around#73)
 * 유형: T-W-A 조회형 (목록 MovementTable, 상세 MovementDrawer)
 * 이탈: C-10 창고와 공급사, 고객은 표에 이름 열만 둔다. 1280×800에서 자재 LOT 번호(말줄임 없음)와 코드 열 둘이
 *       함께 들어가지 않는다. 코드는 드로어와 내려받은 파일에 있다.
 *       C-12 기간 칸의 「시작일부터」 적용은 DS 기간 선택이 지원하지 않아 미구현(W-02-01과 같다).
 * 탭: 정방향 추적, 역방향 추적은 API(A~D)가 들어온 뒤 화면 안 탭으로 더한다. 그때 이 본문이 「입출고 현황」 탭이 된다.
 *     쓸 수 없는 탭은 두지 않는다(C-4).
 */
import {
  AlertBanner,
  Breadcrumb,
  Button,
  EmptyState,
  PageHeader,
  SkeletonText,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { CountChip } from '../../patterns/count-chip';
import { PageNav } from '../../patterns/page-nav';
import { plantToday } from '../../patterns/plant-time';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { FilterBar } from './filter-bar';
import {
  DEFAULT_SIZE,
  KINDS,
  readFilters,
  readSelected,
  toSearchParams,
  withKind,
  type LotTraceFilters,
} from './filters';
import { LOT_STATUS_PATH, MovementDrawer } from './movement-drawer';
import { MovementTable } from './movement-table';
import { defaultPeriod, validatePeriod } from './period';
import {
  partnerRoleOf,
  useItemLabel,
  useKindCounts,
  useMovementList,
  usePartnerLabel,
  useStatusCodes,
  useWarehouseLabel,
} from './queries';
import { formatQtyByUom } from './rows';
import { useMovementExport } from './use-export';

const t = messages.lotTrace;

export const LotTraceScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const selected = readSelected(searchParams);
  const hasPeriod = searchParams.has('from');
  const exportReasonId = useId();
  const { session } = useSession();
  const canOpenLotStatus = toWebAccess(session?.permissions).allows(LOT_STATUS_PATH);

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
  const exporter = useMovementExport(statusCodes.nameOf);

  const role = partnerRoleOf(filters.kind);
  const itemLabel = useItemLabel(filters.item);
  const warehouseLabel = useWarehouseLabel(filters.warehouse);
  const partnerLabel = usePartnerLabel(filters.partner, role);

  const apply = (next: LotTraceFilters, nextSelected: number | null = null) =>
    setSearchParams(toSearchParams(next, nextSelected));

  /* 고른 칩은 목록과 같은 기준(목록 합계), 다른 칩은 공통 조건으로 센 값이다(C-17, 구성안 3). */
  const countOf = (kind: (typeof KINDS)[number]): number | undefined =>
    kind === filters.kind && list.data !== undefined && !list.isPlaceholderData
      ? list.data.totals.lineCount
      : counts.data?.[kind];

  const rows = list.data?.rows ?? [];
  const selectedRow = selected === null ? undefined : rows.find((row) => row.id === selected);
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

  const exportAction =
    exporter.state.phase === 'running' ? (
      <div className="lot-trace-export">
        <span className="lot-trace-export-progress" role="status">
          {t.export.progress(exporter.state.progress.total, exporter.state.progress.received)}
        </span>
        <Button variant="outlined" onClick={exporter.cancel}>
          {t.export.cancel}
        </Button>
      </div>
    ) : (
      <div className="lot-trace-export">
        {total === 0 && (
          <span id={exportReasonId} className="lot-trace-export-reason">
            {t.export.noRows}
          </span>
        )}
        <Button
          variant="outlined"
          disabled={total === 0}
          aria-describedby={total === 0 ? exportReasonId : undefined}
          onClick={() => void exporter.start(filters, total)}
        >
          {t.export.action}
        </Button>
      </div>
    );

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={
          <Breadcrumb
            items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
            aria-label={messages.common.shell.breadcrumb}
          />
        }
        description={
          <span className="lot-trace-kinds" role="group" aria-label={t.kinds.label}>
            <span className="lot-trace-kinds-label" aria-hidden="true">
              {t.kinds.label}
            </span>
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
        }
        actions={exportAction}
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
      {exporter.state.phase === 'failed' && (
        <AlertBanner
          variant="error"
          action={
            <Button size="sm" variant="outlined" onClick={exporter.dismiss}>
              {messages.common.close}
            </Button>
          }
        >
          {t.export.failed}
        </AlertBanner>
      )}
      <section className="pane lot-trace-list-pane" aria-label={t.list.pane}>
        {periodReason !== null ? (
          <AlertBanner variant="warning">{periodReason}</AlertBanner>
        ) : list.isError ? (
          <AlertBanner
            variant="error"
            title={t.list.loadFailed}
            action={
              <Button size="sm" variant="outlined" onClick={() => void list.refetch()}>
                {t.list.retry}
              </Button>
            }
          >
            {t.list.loadFailedDescription}
          </AlertBanner>
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
              activeId={selected}
              onOpen={(row) => apply(filters, row.id)}
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
      {selectedRow !== undefined && (
        <MovementDrawer
          row={selectedRow}
          statusName={statusCodes.nameOf}
          canOpenLotStatus={canOpenLotStatus}
          onClose={() => apply(filters)}
        />
      )}
    </>
  );
};
