import { AlertBanner, Button, Checkbox, Chip, EmptyState, Skeleton } from '@crefle/web-ui';
import type { ReplenishmentItem, ReplenishmentSettings } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

import { ItemSelect } from '../../patterns/item-select';
import { Select } from '../../patterns/select';
import type { ItemFilters } from './filters';
import { EMPTY_ITEMS } from './filters';
import { ItemDialog } from './items-dialog';
import { PAGE_SIZE, sourceOptions, useItemList, useWarehouses } from './queries';
import { RunTimePanel } from './run-time-panel';
import { formatQty } from './types';

const t = messages.productionWarehouseReplenishment;
const ti = t.items;

export interface ItemsViewProps {
  plantId: number;
  settings: ReplenishmentSettings;
  filters: ItemFilters;
  page: number;
  onSearch: (filters: ItemFilters) => void;
  onReset: () => void;
  onPage: (page: number) => void;
}

/** 상태 칩 — 기준 아래(진행 중 보충이 있으면 함께), 기준 이상. */
const StatusChip = ({ row }: { row: ReplenishmentItem }) =>
  row.belowPoint ? (
    <span className="replenishment-chips">
      <Chip size="sm" status={row.inProgressQty > 0 ? 'warning' : 'error'}>
        {ti.below}
      </Chip>
      {row.inProgressQty > 0 && (
        <Chip size="sm" status="warning">
          {t.status.IN_PROGRESS}
        </Chip>
      )}
    </span>
  ) : (
    <Chip size="sm" status="idle">
      {ti.above}
    </Chip>
  );

/** 보기 4 — 관리 품목과 자동 보충 시각(US4). */
export const ItemsView = ({
  plantId,
  settings,
  filters,
  page,
  onSearch,
  onReset,
  onPage,
}: ItemsViewProps) => {
  const [draft, setDraft] = useState<ItemFilters>(filters);
  const [draftSource, setDraftSource] = useState(filters);
  if (JSON.stringify(draftSource) !== JSON.stringify(filters)) {
    setDraftSource(filters);
    setDraft(filters);
  }
  /** 열린 창 — `null` 은 닫힘, `'new'` 는 추가. */
  const [editing, setEditing] = useState<ReplenishmentItem | 'new' | null>(null);
  const list = useItemList(plantId, filters, page, true);
  const warehouses = useWarehouses(plantId);

  const filterBar = (
    <section className="replenishment-filters" aria-label={ti.filters.label}>
      <div className="replenishment-filter-row">
        <Select
          aria-label={ti.filters.productionWarehouse}
          value={draft.warehouse}
          options={[
            { value: '', label: t.common.all },
            ...settings.warehouses.map((row) => ({
              value: String(row.warehouseId),
              label: row.warehouseName,
            })),
          ]}
          onChange={(value) => setDraft({ ...draft, warehouse: value })}
        />
        <ItemSelect
          aria-label={ti.filters.item}
          placeholder={ti.filters.item}
          includeInactive
          value={draft.item === '' ? null : draft.item}
          onChange={(value) => setDraft({ ...draft, item: value })}
        />
        <Select
          aria-label={ti.filters.source}
          value={draft.source}
          options={[
            { value: '', label: t.common.all },
            ...sourceOptions(warehouses.data ?? [], ''),
          ]}
          onChange={(value) => setDraft({ ...draft, source: value })}
        />
        <Checkbox
          checked={draft.belowOnly}
          onChange={(event) => onSearch({ ...draft, belowOnly: event.target.checked })}
        >
          {ti.filters.belowOnly}
        </Checkbox>
        <Button onClick={() => onSearch(draft)}>{t.common.search}</Button>
        <Button variant="outlined" onClick={onReset}>
          {t.common.reset}
        </Button>
        <span className="replenishment-actions-end">
          <Button variant="tonal" onClick={() => setEditing('new')}>
            {ti.add}
          </Button>
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
    if (list.data.items.length === 0) {
      const filtered = JSON.stringify(filters) !== JSON.stringify(EMPTY_ITEMS);
      return <EmptyState size="sm" title={filtered ? ti.emptyFiltered : ti.empty} />;
    }
    const total = list.data.page.total;
    const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
    return (
      <>
        <div className="replenishment-table-scroll">
          <table className="replenishment-table is-sticky-first" aria-label={ti.listLabel}>
            <thead>
              <tr>
                <th scope="col">{ti.columns.productionWarehouse}</th>
                <th scope="col">{ti.columns.item}</th>
                <th scope="col" className="is-number">
                  {ti.columns.point}
                </th>
                <th scope="col" className="is-number">
                  {ti.columns.target}
                </th>
                <th scope="col">{ti.columns.uom}</th>
                <th scope="col">{ti.columns.source}</th>
                <th scope="col" className="is-number">
                  {ti.columns.available}
                </th>
                <th scope="col" className="is-number">
                  {ti.columns.planned}
                </th>
                <th scope="col" className="is-number">
                  {ti.columns.usable}
                </th>
                <th scope="col" className="is-number">
                  {ti.columns.inProgress}
                </th>
                <th scope="col">{ti.columns.status}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((row) => (
                <tr key={row.replenishmentItemId}>
                  <td>{row.productionWarehouseName}</td>
                  <td>
                    <button type="button" className="link-cell" onClick={() => setEditing(row)}>
                      <span className="replenishment-code">{row.itemCode}</span> {row.itemName}
                    </button>
                  </td>
                  <td className="is-number">{formatQty(row.reorderPointQty)}</td>
                  <td className="is-number">{formatQty(row.targetQty)}</td>
                  <td>{row.uomCode}</td>
                  <td>{row.sourceWarehouseName}</td>
                  <td className="is-number">{formatQty(row.availableQty)}</td>
                  <td className="is-number">{formatQty(row.plannedQty)}</td>
                  <td className="is-number">{formatQty(row.usableQty)}</td>
                  <td className="is-number">
                    {row.inProgressQty > 0 ? formatQty(row.inProgressQty) : t.common.none}
                  </td>
                  <td>
                    <StatusChip row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="replenishment-pager">
          <span className="field-note">{t.progress.pager.total(total)}</span>
          <Button
            variant="outlined"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
          >
            {t.progress.pager.previous}
          </Button>
          <Button
            variant="outlined"
            size="sm"
            disabled={page >= lastPage}
            onClick={() => onPage(page + 1)}
          >
            {t.progress.pager.next}
          </Button>
        </div>
      </>
    );
  };

  return (
    <>
      <RunTimePanel plantId={plantId} settings={settings} />
      {filterBar}
      {body()}
      {editing !== null && (
        <ItemDialog
          item={editing === 'new' ? null : editing}
          settings={settings}
          warehouses={warehouses.data ?? []}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
};
