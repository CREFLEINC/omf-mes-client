import { Breadcrumb, Chip, PageHeader } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import { usePageHub } from '../../patterns/page-hub';
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
import { useWarehouseReferenceOptions, type ReferenceOption } from './reference-options';
import { useLotActorOptions } from './queries';

const t = messages.lotStatusHistory;

const MODES: readonly ScreenMode[] = ['lot', 'history'];

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

  const lotStatusNote =
    lotStatuses.data?.isSeeded === false
      ? t.lotFilter.notes.lotStatusUnseeded
      : optionNote(lotStatuses, t.lotFilter.fields.status);

  return (
    <>
      <LotFilterBar
        appliedFilters={filters}
        lotTypeOptions={toCodeOptions(lotTypes.data?.items)}
        lotStatusOptions={toCodeOptions(lotStatuses.data?.items)}
        warehouseOptions={toReferenceOptions(warehouses.data?.entries)}
        lotTypeNote={
          lotTypes.data?.isSeeded === false
            ? t.lotFilter.notes.lotTypeUnseeded
            : lotTypes.data?.isTruncated === true
              ? t.lotFilter.notes.lotTypeTruncated
              : optionNote(lotTypes, t.lotFilter.fields.lotType)
        }
        lotStatusNote={lotStatusNote}
        warehouseNote={optionNote(warehouses, t.lotFilter.fields.warehouse)}
        onSearch={onSearch}
        onReset={onReset}
      />
      <CurrentResults
        filters={filters}
        page={page}
        statusOptions={toCodeOptions(lotStatuses.data?.items)}
        onSortChange={onSortChange}
        onPageChange={onPageChange}
        onSelectLot={onSelectLot}
      />
      {selectedLotId !== null && (
        <LotDetailDialog
          lotId={selectedLotId}
          lotTypeOptions={toCodeOptions(lotTypes.data?.items)}
          statusOptions={toCodeOptions(lotStatuses.data?.items)}
          onClose={() => onSelectLot(null)}
        />
      )}
    </>
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
  const lotStatuses = useLotStatusOptions();
  const appUserName = (appUserId: number): string | null => {
    const actor = actors.data?.items.find((item) => item.appUserId === appUserId);
    if (actor === undefined) return null;
    return actor.userName === '' ? actor.loginId : actor.userName;
  };
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
    <>
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
        statusOptions={toCodeOptions(lotStatuses.data?.items)}
        appUserName={appUserName}
        onPageChange={onPageChange}
      />
    </>
  );
};

export const LotStatusHistoryScreen = () => {
  const hub = usePageHub();
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
  const changeMode = (next: ScreenMode): void => {
    setSearchParams((current) => toModeSearchParams(current, next));
  };
  const applyHistory = (next: HistoryFilters): void => {
    setSearchParams((current) => toAppliedHistorySearchParams(current, next, 1));
  };
  const changeHistoryPage = (nextPage: number): void => {
    setSearchParams((current) => toAppliedHistorySearchParams(current, historyFilters, nextPage));
  };

  return (
    <>
      {/* 탭 묶음 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(omf-all-around#210). */}
      {hub === null && (
        <PageHeader
          title={t.title}
          breadcrumb={
            <Breadcrumb
              items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}
      {/*
       * 조건과 결과를 한 카드에 담고, 조회 방식(LOT 번호 · 이력)은 카드 머리 오른쪽 단추로 고른다(사용자 시안 2026-10-30).
       * 고른 방식은 종전처럼 주소(`mode`)에 남는다.
       */}
      <section className="pane lot-status-pane" aria-labelledby="lot-query-title">
        <div className="lot-status-card-head">
          <h2 className="pane-title" id="lot-query-title">
            {t.query.title}
          </h2>
          <div className="lot-status-mode" role="group" aria-labelledby="lot-query-mode-label">
            <span className="field-label" id="lot-query-mode-label">
              {t.modes.label}
            </span>
            {MODES.map((value) => (
              <Chip
                key={value}
                variant="filter"
                size="sm"
                selected={mode === value}
                onSelectedChange={() => {
                  if (value !== mode) changeMode(value);
                }}
              >
                {t.modes[value]}
              </Chip>
            ))}
          </div>
        </div>
        {mode === 'lot' ? (
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
        ) : (
          <HistoryMode
            filters={historyFilters}
            page={historyPage}
            onSearch={applyHistory}
            onReset={() => applyHistory(EMPTY_HISTORY_FILTERS)}
            onPageChange={changeHistoryPage}
          />
        )}
      </section>
    </>
  );
};
