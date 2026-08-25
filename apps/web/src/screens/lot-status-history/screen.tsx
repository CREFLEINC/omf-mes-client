import { Breadcrumb, PageHeader, Tabs, type TabItem } from '@crefle/web-ui';
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

const inactiveLabel = (label: string, isActive: boolean): string =>
  isActive ? label : `${label} (미사용)`;

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
  if (state.isPending) return `${name} 목록을 불러오는 중입니다.`;
  if (state.isError) return `${name} 목록을 불러오지 못했습니다.`;
  if (state.data?.isTruncated === true) return `일부 ${name}만 표시됩니다.`;
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
    ? 'LOT 유형 기준값을 불러오는 중입니다.'
    : lotTypes.isError
      ? 'LOT 유형 기준값을 불러오지 못했습니다.'
      : lotTypes.data?.isSeeded === false
        ? 'LOT 유형 기준값이 준비되지 않았습니다.'
        : undefined;
  const lotStatusNote =
    lotStatuses.data?.isSeeded === false
      ? '현재 상태 기준값이 준비되지 않았습니다.'
      : optionNote(lotStatuses, '현재 상태');

  return (
    <section className="pane" aria-label="LOT으로 찾기">
      <LotFilterBar
        appliedFilters={filters}
        lotTypeOptions={toCodeOptions(lotTypes.data?.items)}
        lotStatusOptions={toCodeOptions(lotStatuses.data?.items)}
        warehouseOptions={toReferenceOptions(warehouses.data?.entries)}
        itemOptions={toReferenceOptions(items.data?.entries)}
        lotTypeNote={
          lotTypes.data?.isTruncated === true ? '일부 LOT 유형만 표시됩니다.' : undefined
        }
        lotStatusNote={lotStatusNote}
        warehouseNote={optionNote(warehouses, '창고')}
        itemNote={optionNote(items, '품목')}
        lotTypeBlockReason={lotTypeBlockReason}
        onSearch={onSearch}
        onReset={onReset}
      />
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
    </section>
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
    ? '행위자 목록을 불러오는 중입니다.'
    : actors.isError
      ? '행위자 목록을 불러오지 못했습니다.'
      : actors.data !== undefined && actors.data.page.total > actors.data.items.length
        ? '일부 행위자만 표시됩니다.'
        : filters.actor !== '' && !actorOptions.some((option) => option.value === filters.actor)
          ? '선택한 행위자 이름을 확인하지 못했습니다.'
          : undefined;

  return (
    <section className="pane" aria-label="이력으로 찾기">
      <HistoryFilterBar
        appliedFilters={filters}
        actorOptions={actorOptions}
        actorNote={actorNote}
        onSearch={onSearch}
        onReset={onReset}
      />
      <HistoryResults
        filters={filters}
        page={page}
        offsetMinutes={-new Date().getTimezoneOffset()}
        onPageChange={onPageChange}
      />
    </section>
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
    { value: 'lot', label: 'LOT으로 찾기', content: lotContent },
    { value: 'history', label: '이력으로 찾기', content: historyContent },
  ];

  return (
    <>
      <PageHeader
        title="Lot Status 현황·변경이력 조회"
        breadcrumb={
          <Breadcrumb items={[{ label: '품질관리' }, { label: 'Lot Status 현황·변경이력 조회' }]} />
        }
      />
      <Tabs aria-label="Lot Status 조회 모드" items={tabs} value={mode} onChange={changeMode} />
    </>
  );
};
