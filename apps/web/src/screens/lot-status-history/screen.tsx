import { Breadcrumb, PageHeader, Tabs, type TabItem } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import type { LookupSource } from '../../patterns/lookup-display';
import {
  EMPTY_HISTORY_FILTERS,
  EMPTY_LOT_FILTERS,
  readHistoryFilters,
  readHistoryPage,
  readLotFilters,
  readLotPage,
  readMode,
  readSelectedLotId,
  toAppliedHistorySearchParams,
  toAppliedLotSearchParams,
  toModeSearchParams,
  withSelectedLot,
  type HistoryFilters,
  type LotFilters,
  type LotStatusSort,
  type ScreenMode,
} from './filters';
import { CurrentResults } from './current-results';
import { HistoryFilterBar } from './history-filter-bar';
import { HistoryResults } from './history-results';
import { LotDetailDialog } from './lot-detail-dialog';
import { LotFilterBar, type FilterOption } from './lot-filter-bar';
import { useLotStatusOptions, useLotTypeOptions, type LotCodeOption } from './options';
import {
  useItemReferenceOptions,
  useWarehouseReferenceOptions,
  type ReferenceOption,
} from './reference-options';
import { useLotActorOptions } from './queries';

const t = messages.lotStatusHistory;

const inactiveLabel = (label: string, isActive: boolean): string =>
  isActive ? label : t.values.inactive(label);

const toCodeOptions = (items: readonly LotCodeOption[] | undefined): FilterOption[] =>
  items?.map((item) => ({
    value: item.code,
    label: inactiveLabel(item.label, item.isActive),
  })) ?? [];

const toReferenceOptions = (items: readonly ReferenceOption[] | undefined): FilterOption[] =>
  items?.map((item) => ({
    value: item.value,
    label: inactiveLabel(item.label, item.isActive),
  })) ?? [];

interface OptionState {
  isPending: boolean;
  isError: boolean;
  data?: { isTruncated: boolean };
}

const optionNote = (state: OptionState, name: string): string | undefined => {
  if (state.isPending) return t.optionNotes.loading(name);
  if (state.isError) return t.optionNotes.failed(name);
  if (state.data?.isTruncated === true) return t.optionNotes.truncated(name);
  return undefined;
};

interface LotModeProps {
  filters: LotFilters;
  page: number;
  selectedLotId: number | null;
  onSearch: (filters: LotFilters) => void;
  onReset: () => void;
  onSortChange: (sort: LotStatusSort) => void;
  onPageChange: (page: number) => void;
  onSelectLot: (lotId: number | null) => void;
}

const LotMode = ({
  filters,
  page,
  selectedLotId,
  onSearch,
  onReset,
  onSortChange,
  onPageChange,
  onSelectLot,
}: LotModeProps) => {
  const lotTypes = useLotTypeOptions();
  const lotStatuses = useLotStatusOptions();
  const warehouses = useWarehouseReferenceOptions();
  const items = useItemReferenceOptions();
  const itemSource: LookupSource<ReferenceOption> = {
    entries: items.data?.entries ?? [],
    isLoading: items.isPending,
    isError: items.isError,
  };

  const lotTypeBlockReason = lotTypes.isPending
    ? t.lotFilter.reasons.lotTypeLoading
    : lotTypes.isError
      ? t.lotFilter.reasons.lotTypeFailed
      : lotTypes.data?.isSeeded === false
        ? t.lotFilter.reasons.lotTypeUnseeded
        : undefined;
  const lotStatusNote =
    lotStatuses.data?.isSeeded === false
      ? t.lotFilter.notes.lotStatusUnseeded
      : optionNote(lotStatuses, t.lotFilter.fields.status);

  return (
    <div className="lot-status-workspace">
      <section className="pane lot-status-pane" aria-label={t.lotFilter.pane}>
        <h2 className="pane-title">{t.lotFilter.pane}</h2>
        <LotFilterBar
          appliedFilters={filters}
          lotTypeOptions={toCodeOptions(lotTypes.data?.items)}
          lotStatusOptions={toCodeOptions(lotStatuses.data?.items)}
          warehouseOptions={toReferenceOptions(warehouses.data?.entries)}
          itemOptions={toReferenceOptions(items.data?.entries)}
          lotTypeNote={
            lotTypes.data?.isTruncated === true ? t.lotFilter.notes.lotTypeTruncated : undefined
          }
          lotStatusNote={lotStatusNote}
          warehouseNote={optionNote(warehouses, t.lotFilter.fields.warehouse)}
          itemNote={optionNote(items, t.lotFilter.fields.item)}
          lotTypeBlockReason={lotTypeBlockReason}
          onSearch={onSearch}
          onReset={onReset}
        />
      </section>
      <CurrentResults
        filters={filters}
        page={page}
        statusOptions={toCodeOptions(lotStatuses.data?.items)}
        itemOptions={toReferenceOptions(items.data?.entries)}
        isItemPending={items.isPending}
        isItemError={items.isError}
        onSortChange={onSortChange}
        onPageChange={onPageChange}
        onSelectLot={onSelectLot}
      />
      {selectedLotId !== null && (
        <LotDetailDialog
          lotId={selectedLotId}
          itemSource={itemSource}
          lotTypeOptions={toCodeOptions(lotTypes.data?.items)}
          statusOptions={toCodeOptions(lotStatuses.data?.items)}
          onClose={() => onSelectLot(null)}
        />
      )}
    </div>
  );
};

interface HistoryModeProps {
  filters: HistoryFilters;
  page: number;
  onSearch: (filters: HistoryFilters) => void;
  onReset: () => void;
  onPageChange: (page: number) => void;
}

const HistoryMode = ({ filters, page, onSearch, onReset, onPageChange }: HistoryModeProps) => {
  const actors = useLotActorOptions(true);
  const actorOptions: FilterOption[] =
    actors.data?.items.map((actor) => ({
      value: String(actor.appUserId),
      label: inactiveLabel(actor.userName === '' ? actor.loginId : actor.userName, actor.isActive),
    })) ?? [];
  const actorNote = actors.isPending
    ? t.optionNotes.loading(t.historyFilter.fields.actor)
    : actors.isError
      ? t.optionNotes.failed(t.historyFilter.fields.actor)
      : actors.data !== undefined && actors.data.page.total > actors.data.items.length
        ? t.optionNotes.truncated(t.historyFilter.fields.actor)
        : filters.actor !== '' && !actorOptions.some((option) => option.value === filters.actor)
          ? t.historyFilter.actorUnknownNote
          : undefined;

  return (
    <div className="lot-status-workspace">
      <section className="pane lot-status-pane" aria-label={t.historyFilter.pane}>
        <h2 className="pane-title">{t.historyFilter.pane}</h2>
        <HistoryFilterBar
          appliedFilters={filters}
          actorOptions={actorOptions}
          actorNote={actorNote}
          onSearch={onSearch}
          onReset={onReset}
        />
      </section>
      <HistoryResults
        filters={filters}
        page={page}
        offsetMinutes={-new Date().getTimezoneOffset()}
        onPageChange={onPageChange}
      />
    </div>
  );
};

export const LotStatusHistoryScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = readMode(searchParams);
  const filters = useMemo(() => readLotFilters(searchParams), [searchParams]);
  const historyFilters = useMemo(() => readHistoryFilters(searchParams), [searchParams]);
  const page = readLotPage(searchParams);
  const historyPage = readHistoryPage(searchParams);
  const selectedLotId = readSelectedLotId(searchParams);

  const apply = (next: LotFilters): void => {
    setSearchParams((current) => toAppliedLotSearchParams(current, next, 1));
  };
  const changePage = (nextPage: number): void => {
    setSearchParams((current) => toAppliedLotSearchParams(current, filters, nextPage));
  };
  const changeSort = (sort: LotStatusSort): void => {
    setSearchParams((current) => toAppliedLotSearchParams(current, { ...filters, sort }, 1));
  };
  const changeMode = (next: string): void => {
    setSearchParams((current) => toModeSearchParams(current, next as ScreenMode));
  };
  const applyHistory = (next: HistoryFilters): void => {
    setSearchParams((current) => toAppliedHistorySearchParams(current, next, 1));
  };
  const changeHistoryPage = (nextPage: number): void => {
    setSearchParams((current) => toAppliedHistorySearchParams(current, historyFilters, nextPage));
  };

  const lotContent =
    mode === 'lot' ? (
      <LotMode
        filters={filters}
        page={page}
        selectedLotId={selectedLotId}
        onSearch={apply}
        onReset={() => apply(EMPTY_LOT_FILTERS)}
        onSortChange={changeSort}
        onPageChange={changePage}
        onSelectLot={(lotId) => setSearchParams((current) => withSelectedLot(current, lotId))}
      />
    ) : null;
  const historyContent =
    mode === 'history' ? (
      <HistoryMode
        filters={historyFilters}
        page={historyPage}
        onSearch={applyHistory}
        onReset={() => applyHistory(EMPTY_HISTORY_FILTERS)}
        onPageChange={changeHistoryPage}
      />
    ) : null;
  const tabs: TabItem[] = [
    { value: 'lot', label: t.modes.lot, content: lotContent },
    { value: 'history', label: t.modes.history, content: historyContent },
  ];

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      <Tabs aria-label={t.modes.label} items={tabs} value={mode} onChange={changeMode} />
    </>
  );
};
