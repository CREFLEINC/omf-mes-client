import { AlertBanner, Button, Chip, DatePicker, EmptyState, Skeleton } from '@crefle/web-ui';
import type { ReplenishmentOriginCode, ReplenishmentSettings } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ItemSelect } from '../../patterns/item-select';
import { Select } from '../../patterns/select';
import { DetailPanel } from './detail-panel';
import type { ProgressFilters } from './filters';
import { PAGE_SIZE, replenishmentKeys, useProgressList } from './queries';
import {
  FILTER_STATUSES,
  formatQty,
  plantMinute,
  qtyWithUom,
  STATUS_TONE,
  statusLabel,
  type ReplenishmentRequestView,
  type ReplenishmentStatus,
} from './types';

const t = messages.productionWarehouseReplenishment;
const tp = t.progress;

const ORIGINS: readonly ReplenishmentOriginCode[] = ['DIRECT', 'AUTO'];

export interface ProgressViewProps {
  plantId: number;
  productionWarehouses: ReplenishmentSettings['warehouses'];
  filters: ProgressFilters;
  page: number;
  selectedId: number | null;
  onSearch: (filters: ProgressFilters) => void;
  onReset: () => void;
  onPage: (page: number) => void;
  onSelect: (id: number | null) => void;
}

/** 구분 칩 「직접」「자동」 — 회색 작은 칩(screens/W-02-12.md 「상태 표시」). */
export const OriginChip = ({ origin }: { origin: string | null }) =>
  origin === null ? null : (
    <Chip size="sm" status="idle">
      {(t.origin as Record<string, string>)[origin] ?? origin}
    </Chip>
  );

export const StatusChips = ({ request }: { request: ReplenishmentRequestView }) => (
  <span className="replenishment-chips">
    <Chip size="sm" status={STATUS_TONE[request.status]}>
      {statusLabel(request)}
    </Chip>
    {request.releaseFailed && (
      <Chip size="sm" status="error">
        {t.releaseFailed}
      </Chip>
    )}
  </span>
);

/**
 * 요청 · 출고 · 마감 칸 — 한 품목이면 서버 `qtySummary` 수량, 두 품목 이상이면 「N품목」 · 출고 「일부/전량」 · 마감 「—」
 * (계약 §1, 확정 시안 MIR-261104-0005).
 */
export const qtyCells = (request: ReplenishmentRequestView): [string, string, string] => {
  const none = t.common.none;
  if (request.qty !== null) {
    const { requestedQty, issuedQty, closedQty, uomCode } = request.qty;
    return [
      qtyWithUom(requestedQty, uomCode),
      formatQty(issuedQty),
      closedQty > 0 ? formatQty(closedQty) : none,
    ];
  }
  const issued =
    request.status === 'DONE'
      ? tp.issuedFull
      : request.status === 'IN_PROGRESS' || request.status === 'CLOSED'
        ? tp.issuedPartial
        : none;
  return [tp.itemCount(request.lineCount), issued, none];
};

/** 보기 2 — 진행(US3). 조건 카드 + 표 + 오른쪽 상세 덮개(W-02-11 본보기). */
export const ProgressView = ({
  plantId,
  productionWarehouses,
  filters,
  page,
  selectedId,
  onSearch,
  onReset,
  onPage,
  onSelect,
}: ProgressViewProps) => {
  const [draft, setDraft] = useState<ProgressFilters>(filters);
  const [source, setSource] = useState(filters);
  /* 주소가 바뀌면(뒤로가기 · 초기화) 조건 줄을 주소 값으로 다시 세운다 — 렌더 중 갱신. */
  if (JSON.stringify(source) !== JSON.stringify(filters)) {
    setSource(filters);
    setDraft(filters);
  }
  const list = useProgressList(plantId, filters, page, true);
  const queryClient = useQueryClient();
  /* [조회]는 조건이 같아도 목록 · 열린 상세 · 머리 숫자를 새로 받는다(G1 확인 4). */
  const search = (next: ProgressFilters): void => {
    void queryClient.invalidateQueries({ queryKey: replenishmentKeys.all });
    onSearch(next);
  };

  const toggleOrigin = (origin: ReplenishmentOriginCode): void =>
    onSearch({ ...filters, origin: filters.origin === origin ? '' : origin });
  const toggleStatus = (status: ReplenishmentStatus): void =>
    onSearch({
      ...filters,
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((value) => value !== status)
        : [...filters.statuses, status],
    });

  const filterBar = (
    <section className="replenishment-filters" aria-label={tp.filters.label}>
      <div className="replenishment-filter-row">
        <Select
          aria-label={tp.filters.productionWarehouse}
          value={draft.warehouse}
          options={[
            { value: '', label: t.common.all },
            ...productionWarehouses.map((row) => ({
              value: String(row.warehouseId),
              label: row.warehouseName,
            })),
          ]}
          onChange={(value) => setDraft({ ...draft, warehouse: value })}
        />
        <ItemSelect
          aria-label={tp.filters.item}
          placeholder={tp.filters.item}
          includeInactive
          value={draft.item === '' ? null : draft.item}
          onChange={(value) => setDraft({ ...draft, item: value })}
        />
        <DatePicker
          mode="range"
          clearable
          aria-label={tp.filters.period}
          placeholder={tp.filters.period}
          value={draft.from === '' ? null : [draft.from, draft.to]}
          onChange={(value) => setDraft({ ...draft, from: value?.[0] ?? '', to: value?.[1] ?? '' })}
        />
        <Button onClick={() => search(draft)}>{t.common.search}</Button>
        <Button variant="outlined" onClick={onReset}>
          {t.common.reset}
        </Button>
      </div>
      <div className="replenishment-filter-row">
        <span className="field-note">{tp.filters.origin}</span>
        <span role="group" aria-label={tp.filters.origin} className="replenishment-chips">
          {ORIGINS.map((origin) => (
            <Button
              key={origin}
              size="sm"
              variant={filters.origin === origin ? 'tonal' : 'outlined'}
              aria-pressed={filters.origin === origin}
              onClick={() => toggleOrigin(origin)}
            >
              {t.origin[origin]}
            </Button>
          ))}
        </span>
        <span className="field-note">{tp.filters.status}</span>
        <span role="group" aria-label={tp.filters.status} className="replenishment-chips">
          {FILTER_STATUSES.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={filters.statuses.includes(status) ? 'tonal' : 'outlined'}
              aria-pressed={filters.statuses.includes(status)}
              onClick={() => toggleStatus(status)}
            >
              {t.status[status]}
            </Button>
          ))}
        </span>
      </div>
    </section>
  );

  const body = (): ReactNode => {
    if (list.isError) {
      return (
        <AlertBanner
          variant="error"
          title={messages.httpError.loadTitle}
          action={
            <Button variant="outlined" size="sm" onClick={() => void list.refetch()}>
              {messages.common.retry}
            </Button>
          }
        >
          {messages.httpError.description}
        </AlertBanner>
      );
    }
    if (list.data === undefined) return <Skeleton variant="rect" height="16rem" />;
    if (list.data.items.length === 0) return <EmptyState size="sm" title={tp.empty} />;

    const total = list.data.page.total;
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return (
      <>
        <div className="replenishment-table-scroll">
          <table className="replenishment-table is-sticky-first" aria-label={tp.listLabel}>
            <thead>
              <tr>
                <th scope="col">{tp.columns.requestNo}</th>
                <th scope="col">{tp.columns.origin}</th>
                <th scope="col">{tp.columns.productionWarehouse}</th>
                <th scope="col">{tp.columns.source}</th>
                <th scope="col" className="is-number">
                  {tp.columns.lineCount}
                </th>
                <th scope="col" className="is-number">
                  {tp.columns.requested}
                </th>
                <th scope="col" className="is-number">
                  {tp.columns.issued}
                </th>
                <th scope="col" className="is-number">
                  {tp.columns.closed}
                </th>
                <th scope="col" className="is-number">
                  {tp.columns.shortage}
                </th>
                <th scope="col">{tp.columns.receipt}</th>
                <th scope="col">{tp.columns.status}</th>
                <th scope="col">{tp.columns.requestedAt}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((request) => (
                <tr key={request.id} aria-selected={request.id === selectedId}>
                  <td>
                    <button
                      type="button"
                      className="link-cell"
                      aria-current={request.id === selectedId ? 'true' : undefined}
                      onClick={() => onSelect(request.id)}
                    >
                      {request.no}
                    </button>
                  </td>
                  <td>
                    <OriginChip origin={request.origin} />
                  </td>
                  <td>{request.productionWarehouseName}</td>
                  <td>{request.sourceWarehouseName}</td>
                  <td className="is-number">{String(request.lineCount)}</td>
                  {qtyCells(request).map((text, index) => (
                    <td key={String(index)} className="is-number">
                      {text}
                    </td>
                  ))}
                  <td className="is-number">
                    {request.shortage > 0 ? formatQty(request.shortage) : t.common.none}
                  </td>
                  <td>
                    {request.receipt === null || request.receipt.issuedCount === 0
                      ? t.common.none
                      : tp.receipt(request.receipt.receivedCount, request.receipt.issuedCount)}
                  </td>
                  <td>
                    <StatusChips request={request} />
                  </td>
                  <td>{plantMinute(request.requestedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="replenishment-pager">
          <span className="field-note">{tp.pager.total(total)}</span>
          <Button
            variant="outlined"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            {tp.pager.previous}
          </Button>
          <Button
            variant="outlined"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => onPage(page + 1)}
          >
            {tp.pager.next}
          </Button>
        </div>
      </>
    );
  };

  return (
    <>
      {filterBar}
      {body()}
      {selectedId !== null && <DetailPanel requestId={selectedId} onClose={() => onSelect(null)} />}
    </>
  );
};
